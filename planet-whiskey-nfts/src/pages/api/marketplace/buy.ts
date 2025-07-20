import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MarketplaceListing from '@/models/MarketplaceListing';
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { getMarketplaceProgram } from '@/lib/solanaUtils';

// Verify that the transaction was a successful `buy_nft` call for the specific NFT
async function verifyBuyTransaction(
    connection: Connection,
    signature: string,
    expectedNftMint: string,
    expectedBuyer: string, // The wallet address of the buyer
): Promise<boolean> {
    const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

    if (!tx || tx.meta?.err) {
        console.error("Purchase transaction failed or not found", tx?.meta?.err);
        return false;
    }

    const program = getMarketplaceProgram();
    const buyInstruction = tx.transaction.message.instructions.find(
        (ix) => ix.programId.equals(program.programId)
    );

    if (!buyInstruction) {
        console.error("No marketplace 'buy' instruction found in the transaction.");
        return false;
    }

    // Verify the buyer was a signer
    const buyerPubkey = new PublicKey(expectedBuyer);
    const isSigner = tx.transaction.message.accountKeys.some(
        (key) => {
            // Handle both parsed and regular transaction formats
            const keyPubkey = key.pubkey || key;
            return keyPubkey.equals(buyerPubkey) && key.signer;
        }
    );

    if (!isSigner) {
        console.error("Buyer was not a signer on the purchase transaction.");
        return false;
    }

    // We can also check logs for success message, e.g., using a regex
    const successLog = tx.meta.logMessages?.some(log => 
        log.includes(`NFT ${expectedNftMint} bought by ${expectedBuyer}`)
    );

    if (!successLog) {
        console.error("Success log for purchase not found in transaction.");
        return false;
    }
    
    console.log(`Purchase transaction ${signature} verified for buyer ${expectedBuyer}.`);
    return true;
}


// This endpoint is called AFTER a purchase transaction is successful
// to update the listing's status in the database.
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { transactionSignature, nftMintAddress, buyerWalletAddress } = req.body;

    if (!transactionSignature || !nftMintAddress || !buyerWalletAddress) {
        return res.status(400).json({ success: false, message: 'Transaction signature, NFT mint address, and buyer address are required.' });
    }

    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      return res.status(500).json({ success: false, message: "Server configuration error: SOLANA_RPC_URL is not set." });
    }
    const connection = new Connection(rpcUrl, 'confirmed');

    // Verify the transaction before updating the database
    const isVerified = await verifyBuyTransaction(
        connection,
        transactionSignature,
        nftMintAddress,
        buyerWalletAddress,
    );

    if (!isVerified) {
        return res.status(400).json({ success: false, message: "On-chain purchase transaction could not be verified." });
    }


    await dbConnect();
    
    const updatedListing = await MarketplaceListing.findOneAndUpdate(
      { nftMintAddress: nftMintAddress, listingStatus: 'active' },
      { $set: { listingStatus: 'sold' } },
      { new: true } // Return the updated document
    );

    if (!updatedListing) {
        return res.status(404).json({ success: false, message: 'Could not find an active listing for this NFT to update.' });
    }

    res.status(200).json({ success: true, message: 'Listing status updated to sold.', data: updatedListing });

  } catch (error: any) {
    console.error("Error updating listing status:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

export default handler; 