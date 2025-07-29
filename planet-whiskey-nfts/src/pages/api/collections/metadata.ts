import type { NextApiRequest, NextApiResponse } from 'next';

const ipfsToPinataUrl = (uri: string): string => {
  if (!uri || typeof uri !== 'string') return '';
  if (uri.startsWith('http')) return uri;
  if (!uri.startsWith('ipfs://')) {
    return uri;
  }
  const hash = uri.substring(7);
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
};

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
    
    // Convert IPFS URI to Pinata gateway URL
    const metadataUrl = ipfsToPinataUrl(metadataUri);
    console.log(`[metadata-api] Converted URL: ${metadataUrl}`);
    
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      console.warn(`[metadata-api] Failed to fetch metadata: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        message: `Failed to fetch metadata: ${response.statusText}` 
      });
    }

    const metadata = await response.json();
    console.log(`[metadata-api] Successfully fetched metadata:`, metadata);

    // Convert any IPFS image URLs in the metadata to Pinata URLs
    if (metadata.image && metadata.image.startsWith('ipfs://')) {
      metadata.image = ipfsToPinataUrl(metadata.image);
      console.log(`[metadata-api] Converted image URL: ${metadata.image}`);
    }

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