import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory cache to prevent rate limiting
const metadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const ipfsToPinataUrl = (uri: string): string => {
  if (!uri || typeof uri !== 'string') return '';
  if (uri.startsWith('http')) return uri;
  if (!uri.startsWith('ipfs://')) {
    return uri;
  }
  const hash = uri.substring(7);
  const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud';
  return `${pinataGateway}/ipfs/${hash}`;
};

// Fallback IPFS gateways
const ipfsGateways = [
  `${process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud'}/ipfs/`,
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.ipfs.io/ipfs/'
];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { metadataUri } = req.query;

  if (!metadataUri || typeof metadataUri !== 'string') {
    return res.status(400).json({ message: 'metadataUri is required' });
  }

  try {
    console.log(`[metadata-api] Fetching metadata for: ${metadataUri}`);
    
    // Check cache first
    const cached = metadataCache.get(metadataUri);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[metadata-api] Returning cached metadata for: ${metadataUri}`);
      return res.status(200).json({ 
        success: true, 
        data: cached.data 
      });
    }
    
    // Convert IPFS URI to gateway URLs
    let hash;
    if (metadataUri.startsWith('ipfs://')) {
      // Extract hash from ipfs:// URI, handling .json extensions
      const uriPath = metadataUri.substring(7);
      // Remove .json extension if present
      hash = uriPath.endsWith('.json') ? uriPath.slice(0, -5) : uriPath;
    } else if (metadataUri.includes('/ipfs/')) {
      // Extract hash from existing gateway URL (handles all gateways including new Pinata)
      const parts = metadataUri.split('/ipfs/');
      if (parts.length > 1) {
        hash = parts[parts.length - 1]; // Get the last part after /ipfs/
        // Remove .json extension if present
        hash = hash.endsWith('.json') ? hash.slice(0, -5) : hash;
      } else {
        hash = metadataUri;
      }
    } else {
      hash = metadataUri;
    }
    console.log(`[metadata-api] IPFS hash: ${hash}`);
    
    // Try multiple gateways
    let response;
    let lastError;
    let successfulGateway = '';
    
    for (const gateway of ipfsGateways) {
      const metadataUrl = gateway + hash;
      console.log(`[metadata-api] Trying gateway: ${metadataUrl}`);
      
      try {
        response = await fetch(metadataUrl, {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout per gateway
        });
        
        if (response.ok) {
          successfulGateway = gateway;
          console.log(`[metadata-api] Success with gateway: ${gateway}`);
          break; // Success, exit gateway loop
        }
        
        if (response.status === 429) {
          console.log(`[metadata-api] Rate limited by ${gateway}, trying next gateway`);
          continue; // Try next gateway
        }
        
        console.log(`[metadata-api] Failed with ${gateway}: ${response.status} ${response.statusText}`);
        
      } catch (error) {
        console.log(`[metadata-api] Error with ${gateway}:`, error.message);
        lastError = error;
        continue; // Try next gateway
      }
    }
    
    if (!response || !response.ok) {
      console.error(`❌ [metadata-api] Failed to fetch metadata from all gateways: ${response?.status} ${response?.statusText}`);
      console.error(`🔍 [metadata-api] Hash that failed: ${hash}`);
      console.error(`🔍 [metadata-api] Original URI: ${metadataUri}`);
      console.error(`🔍 [metadata-api] This might indicate:`);
      console.error(`   - The metadata was not successfully uploaded to IPFS`);
      console.error(`   - The IPFS hash is incorrect or malformed`);
      console.error(`   - There are widespread IPFS gateway issues`);
      console.error(`   - The content hasn't propagated across IPFS network yet`);
      
      // Generate fallback metadata instead of failing
      console.log(`🔄 [metadata-api] Generating fallback metadata for broken URI: ${metadataUri}`);
      
      // Try to extract collection info from the URI pattern
      let collectionName = 'Three Gold Treasury NFT';
      let nftName = 'Treasury NFT';
      
      // If the URI contains a number at the end, it's likely an individual NFT
      const numberMatch = hash.match(/(\d+)$/);
      if (numberMatch) {
        const nftNumber = numberMatch[1];
        nftName = `${collectionName} #${nftNumber}`;
      }
      
      const fallbackMetadata = {
        name: nftName,
        symbol: 'PWN',
        description: `${nftName} - A premium treasury-backed NFT from Three Gold Treasury`,
        image: `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(collectionName)}`,
        attributes: [
          { trait_type: 'Type', value: 'Treasury NFT' },
          { trait_type: 'Collection', value: collectionName },
          { trait_type: 'Status', value: 'Metadata Recovered' },
          { trait_type: 'Rarity', value: 'Legendary' }
        ],
        collection: {
          name: collectionName,
          family: 'Three Gold Treasury NFTs'
        },
        properties: {
          files: [
            {
              uri: `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(collectionName)}`,
              type: 'image/png'
            }
          ],
          category: 'image',
          creators: [
            {
              address: process.env.NEXT_PUBLIC_ADMIN_WALLET || 'F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X',
              share: 100
            }
          ]
        }
      };
      
      console.log(`✅ [metadata-api] Generated fallback metadata:`, fallbackMetadata);
      
      // Cache the fallback result with shorter cache time
      metadataCache.set(metadataUri, { data: fallbackMetadata, timestamp: Date.now() });
      
      return res.status(200).json({ 
        success: true, 
        data: fallbackMetadata,
        fallback: true,
        message: 'Generated fallback metadata due to IPFS unavailability'
      });
    }

    const metadata = await response.json();
    console.log(`[metadata-api] Successfully fetched metadata:`, metadata);

    // Convert any image URLs to use our proxy for mobile compatibility
    if (metadata.image) {
      if (metadata.image.startsWith('ipfs://')) {
        const hash = metadata.image.substring(7);
        metadata.image = `/api/images/proxy?imageUrl=ipfs://${hash}`;
        console.log(`[metadata-api] Converted IPFS URL to proxy: ${metadata.image}`);
      } else if (metadata.image.includes('/ipfs/') || metadata.image.includes('gateway.pinata.cloud') || metadata.image.includes('pink-obvious-bee-185.mypinata.cloud')) {
        // Convert any IPFS gateway URL to use our proxy for mobile compatibility
        metadata.image = `/api/images/proxy?imageUrl=${encodeURIComponent(metadata.image)}`;
        console.log(`[metadata-api] Converted gateway URL to proxy: ${metadata.image}`);
      } else if (metadata.image.startsWith('http') && !metadata.image.includes(req.headers.host || '')) {
        // Convert external URLs to use proxy for mobile compatibility
        metadata.image = `/api/images/proxy?imageUrl=${encodeURIComponent(metadata.image)}`;
        console.log(`[metadata-api] Converted external URL to proxy for mobile: ${metadata.image}`);
      }
    }

    // Cache the result
    metadataCache.set(metadataUri, { data: metadata, timestamp: Date.now() });

    res.status(200).json({ 
      success: true, 
      data: metadata 
    });

  } catch (error) {
    console.error(`[metadata-api] Error fetching metadata:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch metadata',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default handler; 