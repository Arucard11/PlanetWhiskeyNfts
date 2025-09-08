import { NextApiRequest, NextApiResponse } from 'next';
import connectToDatabase from '../../../lib/mongodb';
import WalletNftPurchase from '../../../models/WalletNftPurchase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const {
      walletAddress,
      nftMintAddress,
      collectionMintAddress,
      transactionSignature
    } = req.body;

    if (!walletAddress || !nftMintAddress || !collectionMintAddress || !transactionSignature) {
      return res.status(400).json({ 
        message: 'Missing required fields: walletAddress, nftMintAddress, collectionMintAddress, transactionSignature' 
      });
    }

    console.log('[RECORD_PURCHASE] Recording NFT purchase:', {
      walletAddress,
      nftMintAddress,
      collectionMintAddress,
      transactionSignature
    });

    // Connect to database
    await connectToDatabase();

    // Check if this purchase is already recorded (prevent duplicates)
    const existingPurchase = await WalletNftPurchase.findOne({
      nftMintAddress,
      transactionSignature
    });

    if (existingPurchase) {
      console.log('[RECORD_PURCHASE] Purchase already recorded, skipping');
      return res.status(200).json({
        success: true,
        message: 'Purchase already recorded',
        purchaseId: existingPurchase._id
      });
    }

    // Create new purchase record
    const newPurchase = new WalletNftPurchase({
      walletAddress,
      nftMintAddress,
      collectionMintAddress,
      transactionSignature,
      purchaseDate: new Date()
    });

    await newPurchase.save();

    console.log('[RECORD_PURCHASE] Purchase recorded successfully:', newPurchase._id);

    return res.status(200).json({
      success: true,
      message: 'Purchase recorded successfully',
      purchaseId: newPurchase._id
    });

  } catch (error: any) {
    console.error('[RECORD_PURCHASE] Error recording purchase:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record purchase',
      error: error.message
    });
  }
}
