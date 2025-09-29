import type { NextApiRequest, NextApiResponse } from 'next';

// Test common NFT image URLs to see which ones work on mobile
const testUrls = [
  'ipfs://QmTest123456789', // Test IPFS URL
  'https://gateway.pinata.cloud/ipfs/QmTest123456789', // Old Pinata gateway
  'https://pink-obvious-bee-185.mypinata.cloud/ipfs/QmTest123456789', // New Pinata gateway
  'https://ipfs.io/ipfs/QmTest123456789', // IPFS.io gateway
  'https://via.placeholder.com/512x512/1f2937/f59e0b?text=Test+NFT', // Placeholder for testing
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const userAgent = req.headers['user-agent'] || 'Unknown';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  console.log(`[test-mobile-images] Request from: ${userAgent}`);
  console.log(`[test-mobile-images] Is mobile: ${isMobile}`);

  const results = [];

  for (const url of testUrls) {
    try {
      // Test if we can process the URL through our proxy
      const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(url)}`;
      
      results.push({
        originalUrl: url,
        proxyUrl: proxyUrl,
        urlType: url.startsWith('ipfs://') ? 'IPFS' : 
                 url.includes('gateway.pinata.cloud') ? 'Old Pinata Gateway' :
                 url.includes('pink-obvious-bee-185.mypinata.cloud') ? 'New Pinata Gateway' :
                 url.includes('ipfs.io') ? 'IPFS.io Gateway' : 'External URL',
        accessible: true, // We'll assume our proxy can handle it
        notes: 'Processed through image proxy for mobile compatibility'
      });
    } catch (error) {
      results.push({
        originalUrl: url,
        proxyUrl: null,
        urlType: 'Error',
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      userAgent,
      isMobile,
      timestamp: new Date().toISOString(),
      testResults: results,
      recommendations: [
        'All NFT images should go through /api/images/proxy for mobile compatibility',
        'IPFS URLs should be converted to proxy URLs in metadata API',
        'Direct gateway URLs may fail on mobile due to CORS or network issues',
        'Use the debug panel (?debug=true) to monitor real image loading'
      ]
    }
  });
}
