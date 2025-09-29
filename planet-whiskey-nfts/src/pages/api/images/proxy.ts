import type { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory cache for images to prevent duplicate requests
const imageCache = new Map<string, { data: Buffer; contentType: string; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

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

// Fallback IPFS gateways for images
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

  const { imageUrl } = req.query;

  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ message: 'imageUrl is required' });
  }

  try {
    console.log(`[image-proxy] Fetching image for: ${imageUrl}`);
    
    // Check cache first
    const cached = imageCache.get(imageUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`[image-proxy] Returning cached image for: ${imageUrl}`);
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes
      return res.status(200).send(cached.data);
    }
    
    // Extract IPFS hash from either ipfs:// URI or gateway URL
    let hash;
    if (imageUrl.startsWith('ipfs://')) {
      hash = imageUrl.substring(7);
    } else if (imageUrl.includes('/ipfs/')) {
      // Extract hash from gateway URL (handles all gateways including new Pinata)
      const parts = imageUrl.split('/ipfs/');
      if (parts.length > 1) {
        hash = parts[parts.length - 1]; // Get the last part after /ipfs/
      } else {
        return res.status(422).json({ message: 'Invalid IPFS URL format' });
      }
    } else {
      return res.status(422).json({ message: 'Not an IPFS URL' });
    }
    
    console.log(`[image-proxy] Extracted IPFS hash: ${hash}`);
    
    // Try multiple gateways
    let response;
    let lastError;
    let successfulGateway = '';
    
    for (const gateway of ipfsGateways) {
      const gatewayUrl = gateway + hash;
      console.log(`[image-proxy] Trying gateway: ${gatewayUrl}`);
      
      try {
        // Mobile-friendly fetch with longer timeout for slower connections
        response = await fetch(gatewayUrl, {
          signal: AbortSignal.timeout(15000), // 15 second timeout for mobile
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NFT-Image-Proxy/1.0)',
            'Accept': 'image/*,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive'
          }
        });
      
      if (response.ok) {
        successfulGateway = gateway;
        console.log(`[image-proxy] Success with gateway: ${gateway}`);
        break; // Success, exit gateway loop
      }
      
      if (response.status === 429) {
        console.log(`[image-proxy] Rate limited by ${gateway}, trying next gateway`);
        continue; // Try next gateway
      }
      
      console.log(`[image-proxy] Failed with ${gateway}: ${response.status} ${response.statusText}`);
      
    } catch (error) {
      console.log(`[image-proxy] Error with ${gateway}:`, error.message);
      lastError = error;
      continue; // Try next gateway
    }
    }
    
    if (!response || !response.ok) {
      console.warn(`[image-proxy] Failed to fetch image from all gateways: ${response?.status} ${response?.statusText}`);
      return res.status(response?.status || 500).json({ 
        message: `Failed to fetch image from all IPFS gateways: ${response?.statusText || lastError?.message || 'Unknown error'}` 
      });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`[image-proxy] Successfully fetched image: ${contentType}, ${imageBuffer.byteLength} bytes`);

    // Cache the result
    imageCache.set(imageUrl, { 
      data: Buffer.from(imageBuffer), 
      contentType, 
      timestamp: Date.now() 
    });

    // Set appropriate headers with mobile optimization
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Mobile-specific headers for better compatibility
    res.setHeader('Vary', 'Accept-Encoding, User-Agent');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    res.status(200).send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error(`[image-proxy] Error fetching image:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch image',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default handler; 