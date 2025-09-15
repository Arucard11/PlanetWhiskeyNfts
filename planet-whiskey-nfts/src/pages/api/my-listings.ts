import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MarketplaceListing from '@/models/MarketplaceListing';
import NftCollection from '@/models/NftCollection';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

// Global cache for metadata to prevent duplicate API calls
const globalMetadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Debounce mechanism to prevent rapid API calls
let pendingRequests = new Map<string, Promise<any>>();

// Fetch metadata using our server-side proxy (same as NftCollectionCard)
const fetchMetadataWithProxy = async (metadataUri: string): Promise<any | null> => {
  if (!metadataUri) return null;
  
  try {
    // Check global cache first
    const cached = globalMetadataCache.get(metadataUri);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[my-listings] Using cached metadata for: ${metadataUri}`);
      return cached.data;
    }

    // Check if there's already a pending request for this metadata
    if (pendingRequests.has(metadataUri)) {
      console.log(`[my-listings] Waiting for pending request for: ${metadataUri}`);
      return await pendingRequests.get(metadataUri);
    }

    // Create a new request promise
    const requestPromise = (async () => {
      try {
        // Add a small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Use our server-side proxy to avoid CORS issues (same as NftCollectionCard)
        // Since this is server-side, we need to use the full URL
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const apiUrl = `${baseUrl}/api/collections/metadata?metadataUri=${encodeURIComponent(metadataUri)}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          console.warn(`[my-listings] Failed to fetch metadata: ${response.status} ${response.statusText}`);
          return null;
        }

        const result = await response.json();
        if (!result.success) {
          console.warn(`[my-listings] API returned error: ${result.message}`);
          return null;
        }

        const metadata = result.data;
        console.log(`[my-listings] Fetched metadata:`, metadata);

        // Cache the result
        globalMetadataCache.set(metadataUri, { data: metadata, timestamp: Date.now() });

        return metadata;
      } catch (error) {
        console.error(`[my-listings] Error fetching metadata:`, error);
        return null;
      } finally {
        // Remove from pending requests
        pendingRequests.delete(metadataUri);
      }
    })();

    // Store the pending request
    pendingRequests.set(metadataUri, requestPromise);

    // Wait for the result
    return await requestPromise;
  } catch (error) {
    console.error(`[my-listings] Error in fetchMetadataWithProxy:`, error);
    return null;
  }
};

// Function to verify if a listing still exists on-chain
async function verifyListingExistsOnChain(
  sellerAddress: string, 
  nftMintAddress: string
): Promise<boolean> {
  try {
    const program = getMarketplaceProgram();
    const seller = new PublicKey(sellerAddress);
    const nftMint = new PublicKey(nftMintAddress);
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
      program.programId
    );
    
    await program.account.marketplaceListing.fetch(listingPda);
    return true;
  } catch (error) {
    return false;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { walletAddress } = req.query;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ success: false, message: 'Wallet address is required.' });
  }

  console.log(`[my-listings] Fetching listings for wallet: ${walletAddress}`);

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ success: false, message: 'Server configuration error: SOLANA_RPC_URL is not set.' });
  }

  try {
    await dbConnect();

    const connection = new Connection(rpcUrl, 'confirmed');
    const metaplex = Metaplex.make(connection);

    // Get all active listings for this wallet
    const listings = await MarketplaceListing.find({ 
      sellerWalletAddress: walletAddress,
      listingStatus: 'active'
    }).sort({ createdAt: -1 }).lean();

    console.log(`[my-listings] Found ${listings.length} active listings in database`);

    // Verify each listing still exists on-chain and get NFT metadata
    const verifiedListings = await Promise.all(
      listings.map(async (listing) => {
        try {
          // Verify the listing still exists on-chain
          const onChainExists = await verifyListingExistsOnChain(
            listing.sellerWalletAddress, 
            listing.nftMintAddress
          );

          if (!onChainExists) {
            console.log(`[my-listings] Listing ${listing.nftMintAddress} no longer exists on-chain, skipping`);
            // Optionally update the database to mark as cancelled
            await MarketplaceListing.findByIdAndUpdate(
              listing._id,
              { listingStatus: 'cancelled' }
            );
            return null;
          }

          // Use stored metadata from database instead of fetching from blockchain
          return {
            ...listing,
            _id: listing._id.toString(),
            nftName: listing.nftName || 'Unknown NFT',
            nftImageUrl: listing.nftImageUrl || '/placeholder-image.svg',
            collectionName: listing.collectionName || 'Unknown Collection',
            priceInWhiskey: listing.priceInWhiskey,
          };
        } catch (error) {
          console.error(`[my-listings] Error processing listing ${listing.nftMintAddress}:`, error);
          return null;
        }
      })
    );

    const validListings = verifiedListings.filter(listing => listing !== null);
    
    console.log(`[my-listings] Returning ${validListings.length} verified listings`);

    res.status(200).json({ 
      success: true, 
      data: validListings
    });

  } catch (error: any) {
    console.error(`[my-listings] Error fetching listings for wallet ${walletAddress}:`, error);
    res.status(500).json({ success: false, message: 'Failed to fetch listings.', error: error.message });
  }
}

export default handler; 