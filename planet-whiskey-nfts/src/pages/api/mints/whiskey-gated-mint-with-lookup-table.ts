import { NextApiRequest, NextApiResponse } from 'next';
import { Connection } from '@solana/web3.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      walletAddress,
      nftMintAddress,
      collectionMintAddress,
      transactionSignature,
      requiredWhiskeyAmount
    } = req.body;

    if (!walletAddress || !nftMintAddress || !collectionMintAddress || !transactionSignature) {
      return res.status(400).json({ 
        error: 'Missing required fields: walletAddress, nftMintAddress, collectionMintAddress, transactionSignature' 
      });
    }

    console.log('[WHISKEY-GATED-PURCHASE] Recording whiskey-gated NFT purchase:', {
      walletAddress,
      nftMintAddress,
      collectionMintAddress,
      transactionSignature
    });

    // Validate the transaction exists on-chain
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!, 'confirmed');
    try {
      const txInfo = await connection.getTransaction(transactionSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });
      
      if (!txInfo) {
        return res.status(400).json({ error: 'Transaction not found on blockchain' });
      }
      
      if (txInfo.meta?.err) {
        return res.status(400).json({ error: 'Transaction failed on blockchain' });
      }
      
      console.log('[WHISKEY-GATED-PURCHASE] ✅ Transaction verified on blockchain');
    } catch (txError) {
      console.error('[WHISKEY-GATED-PURCHASE] Failed to verify transaction:', txError);
      return res.status(400).json({ error: 'Failed to verify transaction on blockchain' });
    }

    // Connect to database and record purchase
    const { default: dbConnect } = await import('../../../lib/mongodb');
    const { default: WalletNftPurchase } = await import('../../../models/WalletNftPurchase');
    
    await dbConnect();
    
    // Check if this wallet has already minted from this collection (prevent duplicates)
    const existingPurchase = await WalletNftPurchase.findOne({
      walletAddress: walletAddress,
      collectionMintAddress: collectionMintAddress
    });

    if (existingPurchase) {
      console.log('[WHISKEY-GATED-PURCHASE] ❌ Wallet has already minted from this collection');
      return res.status(400).json({ 
        error: 'Wallet has already minted from this whiskey-gated collection. Only 1 NFT per wallet allowed.',
        existingPurchase: existingPurchase._id
      });
    }

    // Check if this specific transaction is already recorded
    const existingTransaction = await WalletNftPurchase.findOne({
      nftMintAddress: nftMintAddress,
      transactionSignature: transactionSignature
    });

    if (existingTransaction) {
      console.log('[WHISKEY-GATED-PURCHASE] ℹ️ Transaction already recorded');
      return res.status(200).json({
        success: true,
        message: 'Purchase already recorded',
        purchaseId: existingTransaction._id
      });
    }

    // Record the new purchase
    const newPurchase = new WalletNftPurchase({
      walletAddress: walletAddress,
      nftMintAddress: nftMintAddress,
      collectionMintAddress: collectionMintAddress,
      transactionSignature: transactionSignature,
      purchaseDate: new Date()
    });

    await newPurchase.save();
    console.log('[WHISKEY-GATED-PURCHASE] ✅ Purchase recorded successfully:', newPurchase._id);

    return res.status(200).json({
      success: true,
      message: 'Whiskey-gated NFT purchase recorded successfully',
      purchaseId: newPurchase._id
    });

  } catch (error) {
    console.error('[WHISKEY-GATED-PURCHASE] Error:', error);
    return res.status(500).json({
      error: 'Failed to record whiskey-gated NFT purchase',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}