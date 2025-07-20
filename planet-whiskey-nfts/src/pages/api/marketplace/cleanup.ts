import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import MarketplaceListing from '../../../models/MarketplaceListing';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { Connection, PublicKey } from '@solana/web3.js';

// Function to verify if a listing still exists on-chain
async function verifyListingExistsOnChain(
  sellerAddress: string, 
  nftMintAddress: string
): Promise<boolean> {
  try {
    const program = getMarketplaceProgram();
    const seller = new PublicKey(sellerAddress);
    const nftMint = new PublicKey(nftMintAddress);
    
    // Derive the listing PDA
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
      program.programId
    );
    
    // Try to fetch the listing account
    await program.account.marketplaceListing.fetch(listingPda);
    return true; // If we get here, the listing exists
  } catch (error) {
    // If fetch fails, the listing doesn't exist on-chain
    return false;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    console.log(`[CLEANUP_API] 🧹 Starting marketplace cleanup...`);
    
    await dbConnect();
    
    // Get all active listings from database
    const activeListings = await MarketplaceListing.find({ listingStatus: 'active' }).lean();
    console.log(`[CLEANUP_API] 📊 Found ${activeListings.length} active listings in database`);
    
    if (activeListings.length === 0) {
      console.log(`[CLEANUP_API] ✅ No active listings to clean up`);
      return res.status(200).json({ 
        success: true, 
        message: 'No active listings found',
        cleaned: 0,
        verified: 0 
      });
    }
    
    let cleanedCount = 0;
    let verifiedCount = 0;
    
    console.log(`[CLEANUP_API] 🔍 Verifying ${activeListings.length} listings exist on-chain...`);
    
    // Check each listing
    for (const listing of activeListings) {
      const onChainExists = await verifyListingExistsOnChain(
        listing.sellerWalletAddress, 
        listing.nftMintAddress
      );
      
      if (onChainExists) {
        verifiedCount++;
        console.log(`[CLEANUP_API] ✅ Verified: ${listing.nftMintAddress}`);
      } else {
        // Listing doesn't exist on-chain, mark as sold/cancelled
        await MarketplaceListing.findByIdAndUpdate(
          listing._id,
          { listingStatus: 'cancelled' }
        );
        cleanedCount++;
        console.log(`[CLEANUP_API] 🧹 Cleaned up: ${listing.nftMintAddress} (no longer on-chain)`);
      }
    }
    
    console.log(`[CLEANUP_API] 🎉 Cleanup complete: ${cleanedCount} cleaned, ${verifiedCount} verified`);
    
    res.status(200).json({ 
      success: true, 
      message: `Cleanup complete: ${cleanedCount} listings cleaned, ${verifiedCount} verified`,
      cleaned: cleanedCount,
      verified: verifiedCount,
      total: activeListings.length
    });
    
  } catch (error: any) {
    console.error(`[CLEANUP_API] ❌ Error during cleanup:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Cleanup failed', 
      error: error.message 
    });
  }
} 