import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY');

// Simple direct metadata fetching (same as minting page)
const fetchMetadataDirectly = async (metadataUri: string): Promise<any | null> => {
  if (!metadataUri) {
    console.log(`[my-nfts] No metadata URI provided`);
    return null;
  }

  try {
    console.log(`[my-nfts] Fetching metadata DIRECTLY from: ${metadataUri}`);
    
    // Convert IPFS to gateway URL (same as NftCollectionCard)
    let metadataUrl = metadataUri;
    if (metadataUri.startsWith('ipfs://')) {
      const ipfsHash = metadataUri.replace('ipfs://', '');
      const pinataGateway = 'https://pink-obvious-bee-185.mypinata.cloud';
      metadataUrl = `${pinataGateway}/ipfs/${ipfsHash}`;
      console.log(`[my-nfts] Converted IPFS to gateway: ${metadataUrl}`);
    }

    const response = await fetch(metadataUrl);
    
    if (!response.ok) {
      console.warn(`[my-nfts] Failed to fetch metadata: ${response.status} ${response.statusText}`);
      return null;
    }

    const metadata = await response.json();
    console.log(`[my-nfts] ✅ Successfully fetched metadata:`, metadata);

    // Convert image URLs to use proxy for mobile compatibility
    if (metadata.image) {
      if (metadata.image.startsWith('ipfs://')) {
        const hash = metadata.image.substring(7);
        metadata.image = `/api/images/proxy?imageUrl=ipfs://${hash}`;
        console.log(`[my-nfts] Converted IPFS URL to proxy: ${metadata.image}`);
      } else if (metadata.image.includes('/ipfs/') || metadata.image.includes('gateway.pinata.cloud') || metadata.image.includes('pink-obvious-bee-185.mypinata.cloud')) {
        metadata.image = `/api/images/proxy?imageUrl=${encodeURIComponent(metadata.image)}`;
        console.log(`[my-nfts] Converted gateway URL to proxy: ${metadata.image}`);
      } else if (metadata.image.startsWith('http')) {
        metadata.image = `/api/images/proxy?imageUrl=${encodeURIComponent(metadata.image)}`;
        console.log(`[my-nfts] Converted external URL to proxy: ${metadata.image}`);
      }
    }

    return metadata;
  } catch (error) {
    console.error(`[my-nfts] Error fetching metadata:`, error);
    return null;
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { walletAddress } = req.query;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ success: false, message: 'Wallet address is required' });
  }

  try {
    console.log(`[my-nfts] Fetching NFTs for wallet: ${walletAddress}`);

    const metaplex = Metaplex.make(connection);
    const publicKey = new PublicKey(walletAddress);

    // Get all NFTs owned by the wallet
    const nfts = await metaplex.nfts().findAllByOwner({ owner: publicKey });
    console.log(`[my-nfts] Found ${nfts.length} NFTs`);

    const processedNfts: any[] = [];
    const ownedCollectionNfts: any[] = [];
    const unknownCollectionNfts: any[] = [];

    for (const nft of nfts) {
      if (!nft.uri) {
        console.log(`[my-nfts] Skipping NFT ${nft.name} - no URI`);
        continue;
      }

      // 🔍 DEBUG: Log both addresses to understand the Metaplex NFT object structure
      console.log(`[my-nfts] Processing NFT: ${nft.name}`);
      console.log(`[my-nfts] 🔍 nft.address (metadata account): ${nft.address.toBase58()}`);
      console.log(`[my-nfts] 🔍 nft.mintAddress (NFT mint): ${(nft as any).mintAddress?.toBase58() || 'NOT FOUND'}`);
      console.log(`[my-nfts] 🔍 nft object keys:`, Object.keys(nft));
      console.log(`[my-nfts] 🔍 nft full object:`, JSON.stringify(nft, null, 2));

      // Fetch metadata directly (same as minting page)
      const metadata = await fetchMetadataDirectly(nft.uri);
      
      let imageUrl = '';
      if (metadata && metadata.image) {
        imageUrl = metadata.image; // Already converted to gateway URL in fetchMetadataDirectly
        console.log(`[my-nfts] ✅ Got real image URL for ${nft.name}: ${imageUrl}`);
      } else {
        console.warn(`[my-nfts] No image found for ${nft.name}, using placeholder`);
        imageUrl = '/placeholder-image.svg';
      }

      // Get collection info
      let collectionAddress = 'unknown';
      let collectionName = 'Unknown Collection';
      
      if (nft.collection) {
        collectionAddress = nft.collection.address.toBase58();
        collectionName = 'Collection'; // Simplified for now
      }

      // 🚨 FIX: Use the NFT mint address, not the metadata account address
      const nftMintAddress = (nft as any).mintAddress?.toBase58() || nft.address.toBase58();
      
      console.log(`[my-nfts] 🎯 Using NFT mint address: ${nftMintAddress}`);
      if (nftMintAddress === nft.address.toBase58()) {
        console.warn(`[my-nfts] ⚠️ WARNING: Could not find nft.mint.address, falling back to nft.address (metadata account)`);
      }

      // Determine if this is an owned collection NFT
      const isOwnedCollection = collectionAddress !== 'unknown';

      const nftData = {
        address: nftMintAddress, // 🔧 FIXED: Now using mint address instead of metadata address
        name: nft.name,
        uri: nft.uri,
        json: metadata, // Include the full metadata
        hasJson: !!metadata,
        jsonImage: imageUrl, // This is what the frontend expects
        collection: {
          address: collectionAddress,
          verified: nft.collection?.verified || false,
        },
        collectionName,
        collectionMintAddress: collectionAddress,
        isOwnedCollection, // Set based on whether collection is known
      };

      console.log(`[my-nfts] Final NFT data for ${nft.name}:`, {
        name: nftData.name,
        address: nftData.address, // 🔧 Now shows the correct mint address
        hasJson: nftData.hasJson,
        jsonImage: nftData.jsonImage,
        collectionName: nftData.collectionName
      });

      processedNfts.push(nftData);

      // Categorize NFTs
      if (isOwnedCollection) {
        ownedCollectionNfts.push(nftData);
      } else {
        unknownCollectionNfts.push(nftData);
      }
    }

    console.log(`[my-nfts] ✅ Successfully processed ${processedNfts.length} NFTs`);

    return res.status(200).json({
      success: true,
      data: processedNfts,
      ownedCollectionNfts,
      unknownCollectionNfts,
      debug: {
        totalNfts: processedNfts.length,
        withImages: processedNfts.filter(nft => nft.jsonImage && nft.jsonImage !== '/placeholder-image.svg').length,
        withPlaceholders: processedNfts.filter(nft => nft.jsonImage === '/placeholder-image.svg').length
      }
    });

  } catch (error) {
    console.error('[my-nfts] Error fetching NFTs:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch NFTs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default handler;