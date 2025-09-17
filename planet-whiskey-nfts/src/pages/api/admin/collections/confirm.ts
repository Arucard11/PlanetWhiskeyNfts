import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Transaction, Keypair } from '@solana/web3.js';
import connectToDatabase from '../../../../lib/mongodb';
import NftCollection from '../../../../models/NftCollection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { signedTransaction, collectionData } = req.body;

    if (!signedTransaction || !collectionData) {
      return res.status(400).json({ message: 'Missing signed transaction or collection data' });
    }

    // Connect to database
    await connectToDatabase();

    // Get fresh connection
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    const transaction = Transaction.from(Buffer.from(signedTransaction, 'base64'));
    
    console.log('[ADMIN_CONFIRM_COLLECTION] Using existing blockhash from signed transaction...');
    console.log('[ADMIN_CONFIRM_COLLECTION] Transaction blockhash:', transaction.recentBlockhash);
    
    // Don't change the blockhash - use the one that was used when the admin signed
    // Get the blockhash info for confirmation tracking
    const { lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    console.log('[ADMIN_CONFIRM_COLLECTION] Sending transaction with existing signatures...');
    
    try {
      // Send with optimized settings for better reliability
      const signature = await connection.sendRawTransaction(
        transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false
        }),
        {
          skipPreflight: false,
          preflightCommitment: 'processed', // Use 'processed' for faster preflight
          maxRetries: 5, // Increase retry count
        }
      );
      console.log('[ADMIN_CONFIRM_COLLECTION] Transaction sent successfully:', signature);
      
      console.log('[ADMIN_CONFIRM_COLLECTION] Confirming transaction...');
      
      // Use a timeout to prevent hanging on confirmation
      const confirmationPromise = connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash!,
        lastValidBlockHeight
      }, 'confirmed');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
      );
      
      await Promise.race([confirmationPromise, timeoutPromise]);

      // Save collection to MongoDB after successful transaction
      const newCollection = new NftCollection(collectionData);
      await newCollection.save();

      console.log('[ADMIN_CONFIRM_COLLECTION] Collection saved to database');

      return res.status(200).json({
        message: 'Collection created successfully!',
        transactionSignature: signature,
        collectionId: newCollection._id
      });
      
    } catch (error: any) {
      // Enhanced error handling with specific error types
      if (error.message?.includes('Blockhash not found') || error.message?.includes('block height exceeded')) {
        console.log('[ADMIN_CONFIRM_COLLECTION] Blockhash expired, need client retry');
        return res.status(400).json({
          message: 'Transaction blockhash expired. Please try creating the collection again.',
          error: 'BLOCKHASH_EXPIRED'
        });
      }
      
      if (error.message?.includes('insufficient funds')) {
        return res.status(400).json({
          message: 'Insufficient SOL for transaction fees. Please add SOL to your wallet.',
          error: 'INSUFFICIENT_FUNDS'
        });
      }
      
      if (error.message?.includes('confirmation timeout')) {
        return res.status(408).json({
          message: 'Transaction confirmation timed out. The transaction may still succeed. Please check your wallet.',
          error: 'CONFIRMATION_TIMEOUT'
        });
      }
      
      // Re-throw other errors
      throw error;
    }

  } catch (error: any) {
    console.error('[ADMIN_CONFIRM_COLLECTION] Error:', error);
    res.status(500).json({ 
      message: 'Failed to confirm collection creation', 
      error: error.message,
      details: error.toString()
    });
  }
}
