import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex, Metadata } from '@metaplex-foundation/js';
import dbConnect from '@/lib/mongodb';
import NftCollection, { INftCollection } from '@/models/NftCollection';

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
      console.log(`[my-nfts] Using cached metadata for: ${metadataUri}`);
      return cached.data;
    }

    // Check if there's already a pending request for this metadata
    if (pendingRequests.has(metadataUri)) {
      console.log(`[my-nfts] Waiting for pending request for: ${metadataUri}`);
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
          console.warn(`[my-nfts] Failed to fetch metadata: ${response.status} ${response.statusText}`);
          return null;
        }

        const result = await response.json();
        if (!result.success) {
          console.warn(`[my-nfts] API returned error: ${result.message}`);
          return null;
        }

        const metadata = result.data;
        console.log(`[my-nfts] Fetched metadata:`, metadata);

        // Cache the result
        globalMetadataCache.set(metadataUri, { data: metadata, timestamp: Date.now() });

        return metadata;
      } catch (error) {
        console.error(`[my-nfts] Error fetching metadata:`, error);
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
    console.error(`[my-nfts] Error in fetchMetadataWithProxy:`, error);
    return null;
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { walletAddress } = req.query;
  console.log(`[my-nfts] Received request for wallet: ${walletAddress}`);


  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ success: false, message: 'Wallet address is required.' });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  if (!rpcUrl) {
    return res.status(500).json({ success: false, message: 'Server configuration error: SOLANA_RPC_URL is not set.' });
  }

  try {
    await dbConnect();
    console.log('[my-nfts] Database connected.');

    const connection = new Connection(rpcUrl, 'confirmed');
    const ownerPublicKey = new PublicKey(walletAddress);
    const metaplex = Metaplex.make(connection);
    console.log(`[my-nfts] Metaplex initialized for wallet ${walletAddress}.`);

    const allOwnedNftMetadata = await metaplex.nfts().findAllByOwner({ owner: ownerPublicKey });
    console.log(`[my-nfts] Found ${allOwnedNftMetadata.length} metadata accounts for wallet.`);


    const allOwnedNfts = await Promise.all(
        allOwnedNftMetadata
            .filter(metadata => metadata !== null)
            .map(metadata => metaplex.nfts().load({ metadata: metadata as Metadata }))
    );
    console.log(`[my-nfts] Loaded ${allOwnedNfts.length} full NFT objects.`);


    // Exclude whiskey-gated collections from lending page
    const allCollectionsInDB = await NftCollection.find({
      isWhiskeyGated: { $ne: true } // Only show non-whiskey-gated collections for lending
    }).lean() as INftCollection[];
    console.log(`[my-nfts] Found ${allCollectionsInDB.length} collections in the database.`);

    const allNfts = (await Promise.all(allOwnedNfts.map(async (nft) => {
      if (!nft) {
        console.log('[my-nfts] Encountered a null NFT object after loading, skipping.');
        return null;
      }

      console.log(`[my-nfts] Processing NFT: ${nft.name} (${nft.address.toBase58()})`);

      let loadedJson = nft.json;

      // If the JSON wasn't loaded by Metaplex, fetch it using our proxy (same as NftCollectionCard)
      if (!loadedJson) {
        console.log(`[my-nfts] NFT JSON not pre-loaded for ${nft.name}. Fetching from URI: ${nft.uri}`);
        try {
          loadedJson = await fetchMetadataWithProxy(nft.uri);
          if (loadedJson) {
            console.log(`[my-nfts] Successfully fetched metadata for ${nft.name}. Image URL: ${loadedJson?.image}`);
          } else {
            console.warn(`[my-nfts] Failed to fetch metadata for ${nft.name} using proxy`);
          }
        } catch (e) {
          console.error(`[my-nfts] Error fetching metadata for ${nft.name} from ${nft.uri}`, e);
        }
      } else {
         console.log(`[my-nfts] NFT JSON was pre-loaded for ${nft.name}. Image URL: ${loadedJson?.image}`);
      }

      if (!nft.collection) {
        console.log(`[my-nfts] NFT ${nft.name} has no collection info.`);
        return {
          address: nft.address.toBase58(),
          name: nft.name,
          uri: nft.uri,
          json: loadedJson,
          collection: null,
          collectionName: 'Unknown Collection',
          collectionMintAddress: '',
          isOwnedCollection: false
        };
      }

      const collectionAddress = nft.collection.address.toBase58();
      const collectionData = allCollectionsInDB.find(c => c.collectionMintAddress === collectionAddress);
      
      if (collectionData) {
        console.log(`[my-nfts] NFT ${nft.name} belongs to known collection: ${collectionData.name}`);
      } else {
        console.log(`[my-nfts] NFT ${nft.name} belongs to an UNKNOWN collection with mint: ${collectionAddress}`);
      }

      // Convert image URL to use our proxy to avoid CORS issues
      let imageUrl = loadedJson?.image || '';
      
      // If the image URL is an IPFS URI, we need to check if it's actually an image or metadata
      if (imageUrl && imageUrl.startsWith('ipfs://')) {
        // Check if this is actually an image by looking at the file extension or content
        const hash = imageUrl.substring(7);
        
        // Try to fetch the actual image URL from the metadata first
        try {
          const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud';
          const baseMetadataUrl = imageUrl.startsWith('ipfs://') 
            ? imageUrl.replace('ipfs://', `${pinataGateway}/ipfs/`)
            : imageUrl;
            
          const baseMetadataResponse = await fetch(baseMetadataUrl);
          if (baseMetadataResponse.ok) {
            const baseMetadata = await baseMetadataResponse.json();
            
            // If the metadata has an image field, use that instead
            if (baseMetadata.image) {
              imageUrl = baseMetadata.image;
              console.log(`[my-nfts] Found actual image URL in metadata: ${imageUrl}`);
            }
          }
        } catch (error) {
          console.warn(`[my-nfts] Could not fetch base metadata for image URL: ${imageUrl}`, error);
        }
      }
      
      // Now convert the final image URL to use our proxy
      if (imageUrl && imageUrl.startsWith('ipfs://')) {
        const hash = imageUrl.substring(7);
        imageUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
        console.log(`[my-nfts] Converted image URL to proxy: ${imageUrl}`);
      } else if (imageUrl && (imageUrl.includes('gateway.pinata.cloud/ipfs/') || imageUrl.includes('pink-obvious-bee-185.mypinata.cloud/ipfs/'))) {
        imageUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(imageUrl)}`;
        console.log(`[my-nfts] Converted Pinata URL to proxy: ${imageUrl}`);
      }
      
      // If we still don't have a valid image URL, use a placeholder
      if (!imageUrl) {
        imageUrl = '/placeholder-image.svg';
        console.log(`[my-nfts] No valid image URL found, using placeholder for ${nft.name}`);
      }

      // Create a copy of loadedJson with the converted image URL
      const processedJson = loadedJson ? { ...loadedJson, image: imageUrl } : loadedJson;

      const finalNftData = {
        address: nft.address.toBase58(),
        name: nft.name,
        uri: nft.uri,
        json: processedJson,
        collection: {
          address: collectionAddress,
          verified: nft.collection.verified,
        },
        collectionMintAddress: collectionAddress,
        collectionName: collectionData?.name || `Unknown (${collectionAddress.substring(0, 4)}...)`,
        isOwnedCollection: !!collectionData
      };

      console.log(`[my-nfts] Final data for ${nft.name}: Image from json is ${finalNftData.json?.image}`);
      console.log(`[my-nfts] Full json object for ${nft.name}:`, finalNftData.json);
      return finalNftData;

    }))).filter(nft => nft !== null);

    const ownedCollectionNfts = allNfts.filter(nft => nft.isOwnedCollection);
    const unknownCollectionNfts = allNfts.filter(nft => !nft.isOwnedCollection);

    console.log(`[my-nfts] Responding with ${allNfts.length} total NFTs processed.`);

    res.status(200).json({ 
      success: true, 
      data: allNfts,
      ownedCollectionNfts: ownedCollectionNfts, // Add this for lending page
      unknownCollectionNfts: unknownCollectionNfts,
      debug: {
        totalAssetsFound: allOwnedNfts.length,
        ownedCollectionCount: ownedCollectionNfts.length,
        unknownCollectionCount: unknownCollectionNfts.length,
        collectionsInDatabase: allCollectionsInDB.length
      }
    });

  } catch (error: any) {
    console.error(`[my-nfts] CRITICAL ERROR fetching NFTs for wallet ${walletAddress}:`, error);
    res.status(500).json({ success: false, message: 'Failed to fetch NFTs.', error: error.message });
  }
}

export default handler; 