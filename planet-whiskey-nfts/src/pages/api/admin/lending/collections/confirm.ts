import { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const { signedTransaction } = req.body;

    if (!signedTransaction) {
      return res.status(400).json({
        success: false,
        message: 'Missing signed transaction'
      });
    }

    // Setup Solana connection
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Deserialize the signed transaction
    const transactionBuffer = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(transactionBuffer);

    // Send and confirm the transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      return res.status(500).json({
        success: false,
        message: 'Transaction failed',
        error: confirmation.value.err,
        signature
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transaction confirmed successfully',
      signature,
      confirmation
    });

  } catch (error) {
    console.error('Error confirming collection transaction:', error);
    res.status(500).json({ 
      message: 'Failed to confirm transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withAdminAuth(handler);
