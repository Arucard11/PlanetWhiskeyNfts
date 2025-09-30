import type { NextApiRequest, NextApiResponse } from 'next';
import { getBestNftImageUri, isWalletCompatibleImageUrl, convertProxyToIpfsUri } from '@/lib/imageUrlUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Test various image URL conversions
  const testUrls = [
    '/api/images/proxy?imageUrl=ipfs://QmTestHash123456789',
    '/api/images/proxy?imageUrl=https://gateway.pinata.cloud/ipfs/QmTestHash123456789',
    'https://gateway.pinata.cloud/ipfs/QmTestHash123456789',
    'ipfs://QmTestHash123456789',
    'https://via.placeholder.com/512x512/1f2937/f59e0b?text=Test',
    '/placeholder-image.svg',
    ''
  ];

  const results = testUrls.map(url => {
    const convertedFromProxy = convertProxyToIpfsUri(url);
    const bestNftUri = getBestNftImageUri(url, 'Test NFT');
    const isCompatible = isWalletCompatibleImageUrl(bestNftUri);

    return {
      original: url,
      convertedFromProxy,
      bestNftUri,
      isWalletCompatible: isCompatible,
      urlType: url.startsWith('/api/images/proxy') ? 'Proxy URL' :
               url.startsWith('ipfs://') ? 'IPFS URI' :
               url.startsWith('http') ? 'HTTP URL' :
               url.startsWith('/') ? 'Local Path' : 'Empty/Other'
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      message: 'Image URL conversion test results',
      results,
      summary: {
        totalTested: testUrls.length,
        walletCompatible: results.filter(r => r.isWalletCompatible).length,
        proxyConverted: results.filter(r => r.original.startsWith('/api/images/proxy')).length
      }
    }
  });
}
