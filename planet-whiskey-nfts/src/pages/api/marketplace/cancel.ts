import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MarketplaceListing from '@/models/MarketplaceListing';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { BorshInstructionCoder } from '@coral-xyz/anchor';

// Verify that the transaction was a successful `cancel_listing` call for the specific NFT
async function verifyCancelTransaction(
    connection: Connection,
    signature: string,
    expectedSeller: string,
    expectedNftMint: string,
): Promise<boolean> {
    try {
        console.log(`[CANCEL_VERIFY] 🔍 Verifying cancel transaction: ${signature}`);
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

        if (!tx || tx.meta?.err) {
            console.error("Cancel transaction failed or not found", tx?.meta?.err);
            return false;
        }

        console.log(`[CANCEL_VERIFY] ✅ Transaction found and successful`);
        const program = getMarketplaceProgram();
        const instructionCoder = new BorshInstructionCoder(program.idl);
        
        console.log(`[CANCEL_VERIFY] 📋 Looking for instructions from program: ${program.programId.toBase58()}`);
        console.log(`[CANCEL_VERIFY] 📋 Transaction has ${tx.transaction.message.instructions.length} instructions`);
        
        const cancelInstruction = tx.transaction.message.instructions.find(
            (ix) => ix.programId.equals(program.programId)
        );

        if (!cancelInstruction) {
            console.error("No marketplace instruction found in the transaction.");
            console.log(`[CANCEL_VERIFY] 📋 Available program IDs:`, tx.transaction.message.instructions.map(ix => ix.programId.toBase58()));
            return false;
        }

        console.log(`[CANCEL_VERIFY] ✅ Found marketplace instruction`);

        // Decode the instruction to verify it's a cancel_listing instruction
        if (!('data' in cancelInstruction)) {
            console.error("Instruction has no data field");
            return false;
        }

        console.log(`[CANCEL_VERIFY] 📋 Instruction data:`, cancelInstruction.data);
        
        let decodedInstruction;
        try {
            decodedInstruction = instructionCoder.decode(cancelInstruction.data, 'base58');
        } catch (decodeError) {
            console.error(`[CANCEL_VERIFY] ❌ Failed to decode instruction:`, decodeError);
            return false;
        }
        
        if (!decodedInstruction) {
            console.error("Failed to decode instruction");
            return false;
        }
        
        console.log(`[CANCEL_VERIFY] 🔍 Decoded instruction details:`, {
            name: decodedInstruction.name,
            data: decodedInstruction.data
        });
        
        // Check for both possible instruction names
        if (decodedInstruction.name !== 'cancel_listing' && decodedInstruction.name !== 'cancelListing') {
            console.error(`Wrong instruction type: ${decodedInstruction.name}. Expected 'cancel_listing' or 'cancelListing'`);
            return false;
        }

        console.log(`✅ Cancel instruction verified: ${decodedInstruction.name}`);

        // Verify the seller was a signer
        const sellerPubkey = new PublicKey(expectedSeller);
        const isSigner = tx.transaction.message.accountKeys.some(
            (key) => {
                const keyPubkey = key.pubkey || key;
                return keyPubkey.equals(sellerPubkey) && key.signer;
            }
        );

        if (!isSigner) {
            console.error("Seller was not a signer on the cancel transaction.");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error verifying cancel transaction:", error);
        return false;
    }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { transactionSignature, nftMintAddress, sellerWalletAddress } = req.body;

    if (!transactionSignature || !nftMintAddress || !sellerWalletAddress) {
        return res.status(400).json({ 
            success: false, 
            message: 'Transaction signature, NFT mint address, and seller address are required.' 
        });
    }

    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return res.status(500).json({ 
          success: false, 
          message: "Server configuration error: SOLANA_RPC_URL is not set." 
      });
    }
    
    const connection = new Connection(rpcUrl, 'confirmed');

    // Verify the transaction before updating the database
    const isVerified = await verifyCancelTransaction(
        connection,
        transactionSignature,
        sellerWalletAddress,
        nftMintAddress,
    );

    if (!isVerified) {
        return res.status(400).json({ 
            success: false, 
            message: "On-chain cancel transaction could not be verified." 
        });
    }

    await dbConnect();
    
    const updatedListing = await MarketplaceListing.findOneAndUpdate(
      { 
        nftMintAddress: nftMintAddress, 
        sellerWalletAddress: sellerWalletAddress,
        listingStatus: 'active' 
      },
      { $set: { listingStatus: 'cancelled' } },
      { new: true }
    );

    if (!updatedListing) {
        return res.status(404).json({ 
            success: false, 
            message: 'Could not find an active listing for this NFT to cancel.' 
        });
    }

    console.log(`[CANCEL_API] Successfully cancelled listing for NFT ${nftMintAddress}`);

    res.status(200).json({ 
        success: true, 
        message: 'Listing cancelled successfully.', 
        data: updatedListing 
    });

  } catch (error: any) {
    console.error("Error cancelling listing:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

export default handler; 