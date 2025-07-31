import type { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import dbConnect from '@/lib/mongodb';
import NftCollection from '@/models/NftCollection';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { collectionId } = req.query;

  if (!collectionId || typeof collectionId !== 'string') {
    return res.status(400).json({ message: 'Collection ID is required' });
  }

  try {
    await dbConnect();

    const collection = await NftCollection.findById(collectionId);
    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    // Check if any NFTs have been minted
    if (collection.itemsMintedOnChain && collection.itemsMintedOnChain > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete collection that has minted NFTs. Please deactivate it instead.' 
      });
    }

    await NftCollection.findByIdAndDelete(collectionId);

    res.status(200).json({ 
      success: true, 
      message: 'Collection deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete collection',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withAdminAuth(handler); 