import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import WalletNftPurchase from '../../../models/WalletNftPurchase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Support both GET (query params) and POST (body params)
    const { walletAddress, collectionMintAddress } = req.method === 'GET' ? req.query : req.body;

    if (!walletAddress || !collectionMintAddress) {
      return res.status(400).json({ 
        message: 'Missing required parameters: walletAddress and collectionMintAddress' 
      });
    }

    console.log('[WALLET_NFT_COUNT] Checking NFT count for:', {
      walletAddress,
      collectionMintAddress
    });

    await dbConnect();

    // Count NFTs from this collection owned by this wallet
    const nftCount = await WalletNftPurchase.countDocuments({
      walletAddress: walletAddress as string,
      collectionMintAddress: collectionMintAddress as string
    });

    console.log('[WALLET_NFT_COUNT] Found', nftCount, 'NFTs for wallet');

    return res.status(200).json({
      success: true,
      walletAddress,
      collectionMintAddress,
      count: nftCount
    });

  } catch (error) {
    console.error('[WALLET_NFT_COUNT] Error checking wallet NFT count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check wallet NFT count',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
