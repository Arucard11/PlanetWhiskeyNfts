import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import MarketplaceListing from '../../../models/MarketplaceListing';
import NftCollection from '../../../models/NftCollection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { action } = req.query;

  await dbConnect();

  switch (method) {
    case 'GET':
      try {
        console.log(`[DEBUG_API] 🔍 Starting marketplace debug inspection...`);
        
        // Get all listings
        const allListings = await MarketplaceListing.find({}).lean();
        console.log(`[DEBUG_API] 📊 Found ${allListings.length} total listings`);
        
        // Count by status
        const statusCounts = await MarketplaceListing.aggregate([
          { $group: { _id: "$listingStatus", count: { $sum: 1 } } }
        ]);
        console.log(`[DEBUG_API] 📊 Status breakdown:`, statusCounts);
        
        // Test the aggregation that's failing in the main API
        const collectionGroups = await MarketplaceListing.aggregate([
          { $match: { listingStatus: 'active' } },
          { $group: { _id: "$collectionMintAddress", count: { $sum: 1 } } }
        ]);
        console.log(`[DEBUG_API] 📊 Collection groups:`, collectionGroups);
        
        // Get sample collections
        const sampleCollections = await NftCollection.find({}).limit(5).lean();
        
        const debugInfo = {
          totalListings: allListings.length,
          statusBreakdown: statusCounts,
          collectionGroups: collectionGroups,
          sampleListings: allListings.slice(0, 5).map(listing => ({
            _id: listing._id.toString(),
            nftMintAddress: listing.nftMintAddress,
            sellerWalletAddress: listing.sellerWalletAddress,
            collectionMintAddress: listing.collectionMintAddress,
            priceInWhiskey: listing.priceInWhiskey,
            listingStatus: listing.listingStatus,
            transactionSignature: listing.transactionSignature ? `${listing.transactionSignature.substring(0, 20)}...` : 'undefined',
            createdAt: listing.createdAt
          })),
          sampleCollections: sampleCollections.map(col => ({
            _id: col._id.toString(),
            name: col.name,
            collectionMintAddress: col.collectionMintAddress,
            isActive: col.isActive
          }))
        };
        
        res.status(200).json({ 
          success: true, 
          debug: debugInfo 
        });
        
      } catch (error) {
        console.error(`[DEBUG_API] ❌ Error during debug inspection:`, error);
        res.status(500).json({ success: false, message: 'Debug inspection failed', error: error.message });
      }
      break;

    case 'DELETE':
      if (action === 'clear-listings') {
        try {
          const deleteResult = await MarketplaceListing.deleteMany({});
          console.log(`[DEBUG_API] 🗑️ Cleared ${deleteResult.deletedCount} listings from database`);
          res.status(200).json({ 
            success: true, 
            message: `Deleted ${deleteResult.deletedCount} listings`,
            deletedCount: deleteResult.deletedCount 
          });
        } catch (error) {
          console.error(`[DEBUG_API] ❌ Error clearing listings:`, error);
          res.status(500).json({ success: false, message: 'Failed to clear listings', error: error.message });
        }
      } else {
        res.status(400).json({ success: false, message: 'Invalid action. Use ?action=clear-listings' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'DELETE']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
} 