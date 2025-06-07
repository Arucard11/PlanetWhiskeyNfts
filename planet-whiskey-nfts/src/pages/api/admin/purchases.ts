import type { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '../../../lib/adminAuth'; // Check/adjust path as necessary
import dbConnect from '../../../lib/mongodb';       // Check/adjust path as necessary
import WalletNftPurchase, { IWalletNftPurchase } from '../../../models/WalletNftPurchase'; // Check/adjust path

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();

    // Fetch all purchases, sort by purchaseDate descending (newest first)
    const purchases: IWalletNftPurchase[] = await WalletNftPurchase.find({})
      .sort({ purchaseDate: -1 })
      .lean(); // Use .lean() for performance if you only need plain JS objects

    return res.status(200).json({ success: true, data: purchases });
  } catch (error: any) {
    console.error('[ADMIN_GET_PURCHASES_ERROR]', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error fetching purchases.', error: error.message });
  }
}

export default withAdminAuth(handler); 