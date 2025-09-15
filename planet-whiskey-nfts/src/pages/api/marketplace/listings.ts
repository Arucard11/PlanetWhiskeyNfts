import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import MarketplaceListing from '../../../models/MarketplaceListing';
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
      console.log(`[marketplace-listings] Using cached metadata for: ${metadataUri}`);
      return cached.data;
    }

    // Check if there's already a pending request for this metadata
    if (pendingRequests.has(metadataUri)) {
      console.log(`[marketplace-listings] Waiting for pending request for: ${metadataUri}`);
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
          console.warn(`[marketplace-listings] Failed to fetch metadata: ${response.status} ${response.statusText}`);
          return null;
        }

        const result = await response.json();
        if (!result.success) {
          console.warn(`[marketplace-listings] API returned error: ${result.message}`);
          return null;
        }

        const metadata = result.data;
        console.log(`[marketplace-listings] Fetched metadata:`, metadata);

        // Cache the result
        globalMetadataCache.set(metadataUri, { data: metadata, timestamp: Date.now() });

        return metadata;
      } catch (error) {
        console.error(`[marketplace-listings] Error fetching metadata:`, error);
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
    console.error(`[marketplace-listings] Error in fetchMetadataWithProxy:`, error);
    return null;
  }
};

async function verifyListingExistsOnChain(
  connection: Connection, 
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
    const listingAccount = await program.account.marketplaceListing.fetch(listingPda);
    return !!listingAccount;
  } catch (error) {
    return false;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { collectionMint } = req.query;

  await dbConnect();
  
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ success: false, message: 'Server configuration error: SOLANA_RPC_URL is not set.' });
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const metaplex = Metaplex.make(connection);

  if (method === 'GET') {
    if (collectionMint) {
      try {
        const listings = await MarketplaceListing.find({ 
          listingStatus: 'active',
          collectionMintAddress: collectionMint as string 
        }).sort({ createdAt: -1 }).lean();

        const collection = await NftCollection.findOne({ collectionMintAddress: collectionMint as string }).lean();

        const augmentedListings = await Promise.all(
          listings.map(async (listing) => {
            try {
              const onChainExists = await verifyListingExistsOnChain(connection, listing.sellerWalletAddress, listing.nftMintAddress);
              if (!onChainExists) return null;
              
              // Use stored metadata from database instead of fetching from blockchain
              let imageUrl = listing.nftImageUrl || '/placeholder-image.svg';
              
              // Convert IPFS URLs to use our proxy (same as my-nfts API)
              if (imageUrl && imageUrl.startsWith('ipfs://')) {
                const hash = imageUrl.substring(7);
                imageUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
                console.log(`[marketplace-listings] Converted IPFS URL to proxy: ${imageUrl}`);
              } else if (imageUrl && imageUrl.includes('gateway.pinata.cloud/ipfs/')) {
                imageUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(imageUrl)}`;
                console.log(`[marketplace-listings] Converted Pinata URL to proxy: ${imageUrl}`);
              }
              
              return {
                ...listing,
                _id: listing._id.toString(),
                nftName: listing.nftName || 'Unknown NFT',
                nftImageUrl: imageUrl,
                collectionName: listing.collectionName || collection?.name || 'Unknown Collection',
              };
            } catch (e) {
              console.error(`Error processing listing for ${listing.nftMintAddress}:`, e);
              return null;
            }
          })
        );

        const validListings = augmentedListings.filter(listing => listing !== null);
        
        let collectionImageUrl;
        if (collection?.metadataUri) {
            try {
                // Use our server-side proxy to avoid CORS issues
                const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
                const apiUrl = `${baseUrl}/api/collections/metadata?metadataUri=${encodeURIComponent(collection.metadataUri)}`;
                const metadataResponse = await fetch(apiUrl);
                if (metadataResponse.ok) {
                    const result = await metadataResponse.json();
                    if (result.success && result.data && result.data.image) {
                        collectionImageUrl = result.data.image;
                        
                        // Convert IPFS URLs to use our proxy
                        if (collectionImageUrl && collectionImageUrl.startsWith('ipfs://')) {
                          const hash = collectionImageUrl.substring(7);
                          collectionImageUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
                        } else if (collectionImageUrl && collectionImageUrl.includes('gateway.pinata.cloud/ipfs/')) {
                          collectionImageUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(collectionImageUrl)}`;
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching collection metadata:', error);
            }
        }
        
        res.status(200).json({ 
          success: true, 
          data: {
            listings: validListings,
            collectionInfo: {
              name: collection?.name,
              imageUrl: collectionImageUrl || '/placeholder-image.svg'
            }
          } 
        });
      } catch (error) {
        res.status(400).json({ success: false, message: "Could not fetch collection listings." });
      }
    } else {
      try {
        const allActiveListings = await MarketplaceListing.find({ listingStatus: 'active' }).lean();
        
        const verifiedCollectionCounts = new Map<string, number>();
        for (const listing of allActiveListings) {
          const onChainExists = await verifyListingExistsOnChain(connection, listing.sellerWalletAddress, listing.nftMintAddress);
          if (onChainExists) {
            const currentCount = verifiedCollectionCounts.get(listing.collectionMintAddress) || 0;
            verifiedCollectionCounts.set(listing.collectionMintAddress, currentCount + 1);
          }
        }
        
        const collectionsWithVerifiedListings = [];
        for (const [collectionMintAddress, count] of verifiedCollectionCounts.entries()) {
          const collectionDetails = await NftCollection.findOne({ collectionMintAddress: collectionMintAddress }).lean();
          if (collectionDetails) {
            collectionsWithVerifiedListings.push({
              collectionMintAddress,
              name: collectionDetails.name,
              metadataUri: collectionDetails.metadataUri,
              listingCount: count,
            });
          }
        }

        const augmentedCollections = await Promise.all(collectionsWithVerifiedListings.map(async (col) => {
            let imageUrl;
            if (col.metadataUri) {
                try {
                    // Use our server-side proxy to avoid CORS issues
                    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
                    const apiUrl = `${baseUrl}/api/collections/metadata?metadataUri=${encodeURIComponent(col.metadataUri)}`;
                    const metadataResponse = await fetch(apiUrl);
                    if (metadataResponse.ok) {
                        const result = await metadataResponse.json();
                        if (result.success && result.data && result.data.image) {
                            imageUrl = result.data.image;
                            
                            // Convert IPFS URLs to use our proxy
                            if (imageUrl && imageUrl.startsWith('ipfs://')) {
                              const hash = imageUrl.substring(7);
                              imageUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
                            } else if (imageUrl && imageUrl.includes('gateway.pinata.cloud/ipfs/')) {
                              imageUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(imageUrl)}`;
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error fetching collection metadata:', error);
                }
            }
            return { ...col, imageUrl: imageUrl || '/placeholder-image.svg' };
        }));

        res.status(200).json({ success: true, data: augmentedCollections });
      } catch (error) {
        res.status(400).json({ success: false, message: "Could not fetch collections." });
      }
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}

export default handler; 