// CoinGecko API integration for WHISKEY token pricing
// WHISKEY token contract: 0x4f5f7ea7d5b7371e8fd46caeb750f1e1b8e39e8e8 (Ethereum)
// We'll use the CoinGecko API to get real-time pricing

export interface WhiskeyPriceData {
  usd: number;
  usd_24h_change: number;
  usd_24h_vol: number;
  usd_market_cap: number;
  last_updated_at: number;
}

export interface PriceCache {
  data: WhiskeyPriceData;
  timestamp: number;
}

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const API_BASE_URL = 'https://api.coingecko.com/api/v3';

// In-memory cache
let priceCache: PriceCache | null = null;

/**
 * Fetch real-time WHISKEY price from CoinGecko
 */
export async function fetchWhiskeyPrice(): Promise<WhiskeyPriceData> {
  try {
    // Check cache first
    if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
      console.log('[CoinGecko] Using cached price data');
      return priceCache.data;
    }

    console.log('[CoinGecko] Fetching fresh price data...');
    
    // CoinGecko API endpoint for WHISKEY token
    const response = await fetch(
      `${API_BASE_URL}/simple/price?ids=whiskey&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true&include_last_updated_at=true`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.whiskey) {
      throw new Error('WHISKEY price data not found in response');
    }

    const priceData: WhiskeyPriceData = {
      usd: data.whiskey.usd || 0,
      usd_24h_change: data.whiskey.usd_24h_change || 0,
      usd_24h_vol: data.whiskey.usd_24h_vol || 0,
      usd_market_cap: data.whiskey.usd_market_cap || 0,
      last_updated_at: data.whiskey.last_updated_at || Date.now() / 1000,
    };

    // Update cache
    priceCache = {
      data: priceData,
      timestamp: Date.now(),
    };

    console.log('[CoinGecko] Price data updated:', priceData);
    return priceData;

  } catch (error) {
    console.error('[CoinGecko] Error fetching WHISKEY price:', error);
    
    // Return cached data if available, even if expired
    if (priceCache) {
      console.log('[CoinGecko] Using expired cache as fallback');
      return priceCache.data;
    }
    
    // Return default price if no cache available
    return {
      usd: 0.01, // Default fallback price
      usd_24h_change: 0,
      usd_24h_vol: 0,
      usd_market_cap: 0,
      last_updated_at: Date.now() / 1000,
    };
  }
}

/**
 * Get current WHISKEY price in USD
 */
export async function getCurrentWhiskeyRate(): Promise<number> {
  const priceData = await fetchWhiskeyPrice();
  return priceData.usd;
}

/**
 * Convert USD amount to WHISKEY tokens
 */
export async function convertUsdToWhiskeyTokens(usdAmount: number): Promise<number> {
  const whiskeyRate = await getCurrentWhiskeyRate();
  if (whiskeyRate <= 0) {
    throw new Error('Invalid WHISKEY price');
  }
  return usdAmount / whiskeyRate;
}

/**
 * Convert WHISKEY tokens to USD amount
 */
export async function convertWhiskeyTokensToUsd(whiskeyAmount: number): Promise<number> {
  const whiskeyRate = await getCurrentWhiskeyRate();
  return whiskeyAmount * whiskeyRate;
}

/**
 * Format WHISKEY tokens with proper decimals
 */
export function formatWhiskeyTokens(tokens: number | undefined | null, decimals: number = 6): string {
  if (tokens === undefined || tokens === null || isNaN(tokens)) {
    return '0.00';
  }
  return tokens.toFixed(2);
}

/**
 * Format USD amounts with proper formatting
 */
export function formatUsdAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage changes
 */
export function formatPercentageChange(change: number | undefined | null): string {
  if (change === undefined || change === null || isNaN(change)) {
    return '+0.00%';
  }
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Get price change color for UI
 */
export function getPriceChangeColor(change: number | undefined | null): string {
  if (change === undefined || change === null || isNaN(change)) {
    return 'text-gray-500';
  }
  if (change > 0) return 'text-green-500';
  if (change < 0) return 'text-red-500';
  return 'text-gray-500';
}

/**
 * React hook for real-time WHISKEY price updates
 */
export function useRealTimeWhiskeyPrice(updateInterval: number = 30000) {
  const [priceData, setPriceData] = React.useState<WhiskeyPriceData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const fetchPrice = async () => {
      try {
        setError(null);
        const data = await fetchWhiskeyPrice();
        if (mounted) {
          setPriceData(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch price');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchPrice();

    // Set up interval for updates
    const interval = setInterval(fetchPrice, updateInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [updateInterval]);

  return { priceData, loading, error };
}

// Export React for the hook
import React from 'react';
