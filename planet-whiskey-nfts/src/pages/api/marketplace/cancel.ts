import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MarketplaceListing from '@/models/MarketplaceListing';
import { Connection, PublicKey } from '@solana/web3.js';
import { getMarketplaceProgram } from '@/lib/solanaUtils';

// Verify that the transaction was a successful `cancel_listing` call for the specific NFT
async function verifyCancelTransaction(
    connection: Connection,
    signature: string,
    expectedSeller: string,
    expectedNftMint: string,
): Promise<boolean> {
    try {
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

        if (!tx || tx.meta?.err) {
            console.error("Cancel transaction failed or not found", tx?.meta?.err);
            return false;
        }

        const program = getMarketplaceProgram();
        const cancelInstruction = tx.transaction.message.instructions.find(
            (ix) => ix.programId.equals(program.programId)
        );

        if (!cancelInstruction) {
            console.error("No marketplace 'cancel' instruction found in the transaction.");
            return false;
        }

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