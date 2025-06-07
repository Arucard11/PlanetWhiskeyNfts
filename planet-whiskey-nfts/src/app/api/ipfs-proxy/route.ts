import { NextRequest, NextResponse } from 'next/server';

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');
  
  if (!hash) {
    return NextResponse.json({ error: 'IPFS hash is required' }, { status: 400 });
  }

  // Try multiple gateways for better reliability
  for (const gateway of IPFS_GATEWAYS) {
    try {
      console.log(`[IPFS_PROXY] Attempting to fetch from: ${gateway}${hash}`);
      
      const response = await fetch(`${gateway}${hash}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WhiskeyPlanetNFTs/1.0)',
        },
        // Add timeout
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const content = await response.arrayBuffer();
        
        console.log(`[IPFS_PROXY] Successfully fetched ${hash} from ${gateway} (${contentType})`);
        
        return new NextResponse(content, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      } else {
        console.warn(`[IPFS_PROXY] Gateway ${gateway} returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`[IPFS_PROXY] Gateway ${gateway} failed:`, error);
      continue;
    }
  }

  console.error(`[IPFS_PROXY] All gateways failed for hash: ${hash}`);
  return NextResponse.json({ error: 'Failed to fetch from IPFS' }, { status: 502 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 