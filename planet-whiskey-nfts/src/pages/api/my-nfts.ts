import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex, Metadata } from '@metaplex-foundation/js';
import dbConnect from '@/lib/mongodb';
import NftCollection, { INftCollection } from '@/models/NftCollection';

// Multiple IPFS gateways as fallbacks
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',  // Primary gateway
  'https://ipfs.io/ipfs/',              // Public IPFS gateway
  'https://cloudflare-ipfs.com/ipfs/',  // Cloudflare IPFS gateway
  'https://dweb.link/ipfs/',            // Protocol Labs gateway
];

const ipfsToPinataUrl = (uri: string): string => {
  if (!uri || !uri.startsWith('ipfs://')) {
    return uri; // Return original if not an IPFS URI or if it's already a URL
  }
  const hash = uri.substring(7);
  return `${IPFS_GATEWAYS[0]}${hash}`;  // Use primary gateway
};

// Try multiple IPFS gateways if one fails
const fetchMetadataWithFallback = async (uri: string): Promise<any | null> => {
  if (!uri || !uri.startsWith('ipfs://')) {
    try {
      const response = await fetch(uri);
      if (response.ok) return await response.json();
    } catch (error) {
      console.error(`Failed to fetch non-IPFS metadata: ${uri}`, error);
    }
    return null;
  }

  const hash = uri.substring(7);
  
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gatewayUrl = `${IPFS_GATEWAYS[i]}${hash}`;
    try {
      console.log(`[my-nfts] Trying gateway ${i + 1}/${IPFS_GATEWAYS.length}: ${gatewayUrl}`);
      const response = await fetch(gatewayUrl, {
        headers: {
          'Accept': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[my-nfts] Successfully fetched metadata from gateway ${i + 1}`);
        return data;
      }
    } catch (error) {
      console.warn(`[my-nfts] Gateway ${i + 1} failed for ${uri}:`, error);
      continue;
    }
  }
  
  console.error(`[my-nfts] All gateways failed for ${uri}`);
  return null;
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

  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
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


    const allCollectionsInDB = await NftCollection.find({}).lean() as INftCollection[];
    console.log(`[my-nfts] Found ${allCollectionsInDB.length} collections in the database.`);

    const allNfts = (await Promise.all(allOwnedNfts.map(async (nft) => {
      if (!nft) {
        console.log('[my-nfts] Encountered a null NFT object after loading, skipping.');
        return null;
      }

      console.log(`[my-nfts] Processing NFT: ${nft.name} (${nft.address.toBase58()})`);

      let loadedJson = nft.json;

      // If the JSON wasn't loaded by Metaplex, fetch it directly from the URI
      if (!loadedJson) {
        console.log(`[my-nfts] NFT JSON not pre-loaded for ${nft.name}. Fetching from URI: ${nft.uri}`);
        try {
          loadedJson = await fetchMetadataWithFallback(nft.uri);
          if (loadedJson) {
            console.log(`[my-nfts] Successfully fetched metadata for ${nft.name}. Image URL: ${loadedJson?.image}`);
          } else {
            console.warn(`[my-nfts] Failed to fetch metadata for ${nft.name} from all gateways`);
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

      const finalNftData = {
        address: nft.address.toBase58(),
        name: nft.name,
        uri: nft.uri,
        json: loadedJson,
        collection: {
          address: collectionAddress,
          verified: nft.collection.verified,
        },
        collectionMintAddress: collectionAddress,
        collectionName: collectionData?.name || `Unknown (${collectionAddress.substring(0, 4)}...)`,
        isOwnedCollection: !!collectionData
      };

      console.log(`[my-nfts] Final data for ${nft.name}: Image from json is ${finalNftData.json?.image}`);
      return finalNftData;

    }))).filter(nft => nft !== null);

    const ownedCollectionNfts = allNfts.filter(nft => nft.isOwnedCollection);
    const unknownCollectionNfts = allNfts.filter(nft => !nft.isOwnedCollection);

    console.log(`[my-nfts] Responding with ${allNfts.length} total NFTs processed.`);

    res.status(200).json({ 
      success: true, 
      data: allNfts,
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