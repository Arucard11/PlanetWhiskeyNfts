import { NextApiRequest, NextApiResponse } from 'next';
import { getBestNftImageUri } from '@/lib/imageUrlUtils';

// Cache for metadata to avoid repeated fetches
const metadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// IPFS gateways for metadata fetching
const ipfsGateways = [
  `${process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud'}/ipfs/`,
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.ipfs.io/ipfs/'
];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { metadataUri } = req.query;

  if (!metadataUri || typeof metadataUri !== 'string') {
    return res.status(400).json({ success: false, message: 'metadataUri is required' });
  }

  try {
    console.log(`[wallet-metadata-api] Fetching wallet-compatible metadata from: ${metadataUri}`);

    // Check cache first
    const cached = metadataCache.get(metadataUri);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[wallet-metadata-api] Returning cached metadata for: ${metadataUri}`);
      return res.status(200).json({ success: true, data: cached.data });
    }

    // Try multiple IPFS gateways for metadata
    let metadata = null;
    let lastError = null;

    if (metadataUri.startsWith('ipfs://')) {
      const hash = metadataUri.substring(7);
      
      for (const gateway of ipfsGateways) {
        try {
          const gatewayUrl = `${gateway}${hash}`;
          console.log(`[wallet-metadata-api] Trying gateway: ${gatewayUrl}`);
          
          const response = await fetch(gatewayUrl, {
            signal: AbortSignal.timeout(10000)
          });
          
          if (response.ok) {
            metadata = await response.json();
            console.log(`[wallet-metadata-api] Successfully fetched from: ${gatewayUrl}`);
            break;
          }
        } catch (error) {
          lastError = error;
          console.log(`[wallet-metadata-api] Gateway ${gateway} failed:`, error.message);
          continue;
        }
      }
    } else {
      // Direct HTTP URL
      try {
        const response = await fetch(metadataUri, {
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          metadata = await response.json();
          console.log(`[wallet-metadata-api] Successfully fetched from direct URL`);
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!metadata) {
      console.error(`[wallet-metadata-api] Failed to fetch metadata from all sources:`, lastError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch metadata',
        error: lastError?.message || 'Unknown error'
      });
    }

    console.log(`[wallet-metadata-api] Successfully fetched metadata:`, metadata);

    // Convert image URL to wallet-compatible IPFS URI
    if (metadata.image) {
      const originalImageUrl = metadata.image;
      metadata.image = getBestNftImageUri(originalImageUrl, metadata.name || 'NFT');
      
      console.log(`[wallet-metadata-api] Image URI conversion for wallet compatibility:`, {
        original: originalImageUrl,
        walletCompatible: metadata.image
      });
    }

    // Cache the result
    metadataCache.set(metadataUri, { data: metadata, timestamp: Date.now() });

    res.status(200).json({ 
      success: true, 
      data: metadata 
    });

  } catch (error) {
    console.error(`[wallet-metadata-api] Error fetching metadata:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch metadata',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default handler;
