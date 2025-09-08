import { NextApiRequest, NextApiResponse } from 'next';
import { fetchWhiskeyPrice } from '@/lib/coingeckoPricing';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('[WHISKEY_PRICE_API] Fetching WHISKEY price from CoinGecko...');
    
    const priceData = await fetchWhiskeyPrice();
    
    console.log('[WHISKEY_PRICE_API] Price data retrieved:', priceData);
    
    // Set cache headers for client-side caching
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return res.status(200).json({
      success: true,
      data: priceData,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('[WHISKEY_PRICE_API] Error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch WHISKEY price',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
