/**
 * Raydium API integration - Pool ID fetch only (the method that actually works)
 * Using Raydium API v3: https://api-v3.raydium.io/docs/
 */

import { PublicKey } from '@solana/web3.js';

// Cache for pool data to avoid repeated API calls
const poolDataCache = new Map<string, { data: RaydiumPoolInfo; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Known token mints
export const WHISKEY_TOKEN_MINT = process.env.NEXT_PUBLIC_WHISKEY_MINT!;
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT!;
export const WRAPPED_SOL_MINT = process.env.NEXT_PUBLIC_WRAPPED_SOL_MINT || 'So11111111111111111111111111111111111111112';

export interface RaydiumPoolInfo {
  type: string;
  programId: string;
  id: string;
  mintA: {
    chainId: number;
    address: string;
    programId: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
    tags: string[];
    extensions: any;
  };
  mintB: {
    chainId: number;
    address: string;
    programId: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
    tags: string[];
    extensions: any;
  };
  price: number;
  mintAmountA: number;
  mintAmountB: number;
  feeRate: number;
  openTime: string;
  tvl: number;
  day: any;
  week: any;
  month: any;
  pooltype: string[];
  rewardDefaultInfos: any[];
  farmUpcomingCount: number;
  farmOngoingCount: number;
  farmFinishedCount: number;
  marketId: string;
  lpMint: {
    chainId: number;
    address: string;
    programId: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
    tags: string[];
    extensions: any;
  };
  lpPrice: number;
  lpAmount: number;
  burnPercent: number;
  launchMigratePool: boolean;
}

export interface RaydiumLiquidityPoolKeys {
  // Pool info
  id: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  lpMint: PublicKey;
  version: number;
  programId: PublicKey;
  
  // Pool accounts
  authority: PublicKey;
  openOrders: PublicKey;
  targetOrders: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  withdrawQueue: PublicKey;
  lpVault: PublicKey;
  
  // Market info
  marketVersion: number;
  marketProgramId: PublicKey;
  marketId: PublicKey;
  marketAuthority: PublicKey;
  marketBaseVault: PublicKey;
  marketQuoteVault: PublicKey;
  marketBids: PublicKey;
  marketAsks: PublicKey;
  marketEventQueue: PublicKey;
  
  // Optional lookup table
  lookupTableAccount?: PublicKey;
}

// Known working pool IDs (AMM pools that actually work)
const KNOWN_POOL_IDS = {
  // WHISKEY/SOL AMM pool ID
  WHISKEY_SOL: '6vSXoRsZ4iPH1dW7LKu8CzAgv9AfvWXGXYnnkSrXtDLp',
  // SOL/USDC AMM pool ID  
  SOL_USDC: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2'
};

/**
 * Fetch specific pool by pool ID from Raydium API (THE ONLY METHOD THAT WORKS)
 */
async function fetchPoolById(poolId: string): Promise<RaydiumPoolInfo | null> {
  const cacheKey = `pool_id_${poolId}`;
  const cached = poolDataCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Using cached pool data for ID: ${poolId}`);
    return cached.data;
  }
  
  try {
    const url = `https://api-v3.raydium.io/pools/info/ids?ids=${poolId}`;
    console.log(`📡 Fetching pool by ID: ${poolId}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Pool ID query failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const pools = data.data || [];
    const pool = pools[0] || null;
    
    if (pool) {
      console.log(`✅ Successfully fetched pool by ID: ${poolId}`);
      console.log(`   Pool details: ${pool.baseMint?.slice(0,8)}.../${pool.quoteMint?.slice(0,8)}...`);
      
      // Cache the result
      poolDataCache.set(cacheKey, {
        data: pool,
        timestamp: Date.now()
      });
      
      return pool;
    } else {
      console.warn(`⚠️ No pool found for ID: ${poolId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching pool by ID (${poolId}):`, error);
    return null;
  }
}

/**
 * Convert pool info to liquidity pool keys format
 */
export function convertToLiquidityPoolKeys(poolInfo: RaydiumPoolInfo): RaydiumLiquidityPoolKeys {
  try {
    return {
      // Pool info
      id: new PublicKey(poolInfo.id),
      baseMint: new PublicKey(poolInfo.mintA.address),
      quoteMint: new PublicKey(poolInfo.mintB.address),
      lpMint: new PublicKey(poolInfo.lpMint.address),
      version: 4, // Standard AMM version
      programId: new PublicKey(poolInfo.programId),
      
      // Pool accounts - These would need to be fetched from the Raydium SDK
      // For actual swaps, use raydium.liquidity.getAmmPoolKeys(poolId)
      authority: new PublicKey('11111111111111111111111111111111'), // Placeholder
      openOrders: new PublicKey('11111111111111111111111111111111'), // Placeholder
      targetOrders: new PublicKey('11111111111111111111111111111111'), // Placeholder
      baseVault: new PublicKey('11111111111111111111111111111111'), // Placeholder
      quoteVault: new PublicKey('11111111111111111111111111111111'), // Placeholder
      withdrawQueue: new PublicKey('11111111111111111111111111111111'), // Placeholder
      lpVault: new PublicKey('11111111111111111111111111111111'), // Placeholder
      
      // Market info
      marketVersion: 3, // Standard Serum market version
      marketProgramId: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'), // Serum program
      marketId: new PublicKey(poolInfo.marketId),
      marketAuthority: new PublicKey('11111111111111111111111111111111'), // Placeholder
      marketBaseVault: new PublicKey('11111111111111111111111111111111'), // Placeholder
      marketQuoteVault: new PublicKey('11111111111111111111111111111111'), // Placeholder
      marketBids: new PublicKey('11111111111111111111111111111111'), // Placeholder
      marketAsks: new PublicKey('11111111111111111111111111111111'), // Placeholder
      marketEventQueue: new PublicKey('11111111111111111111111111111111'), // Placeholder
      
      // Optional lookup table
      lookupTableAccount: undefined,
    };
  } catch (error) {
    console.error('❌ Error converting pool info to liquidity pool keys:', error);
    throw error;
  }
}

/**
 * Get WHISKEY/SOL pool using known pool ID
 */
export async function getWhiskeySolPool(): Promise<RaydiumLiquidityPoolKeys | null> {
  try {
    console.log('🔄 Getting WHISKEY/SOL pool...');
    const poolInfo = await fetchPoolById(KNOWN_POOL_IDS.WHISKEY_SOL);
    
    if (!poolInfo) {
      console.error('❌ WHISKEY/SOL pool not found');
      return null;
    }
    
    const poolKeys = convertToLiquidityPoolKeys(poolInfo);
    console.log('✅ WHISKEY/SOL pool loaded successfully');
    return poolKeys;
  } catch (error) {
    console.error('❌ Failed to get WHISKEY/SOL pool:', error);
    return null;
  }
}

/**
 * Get SOL/USDC pool using known pool ID
 */
export async function getSolUsdcPool(): Promise<RaydiumLiquidityPoolKeys | null> {
  try {
    console.log('🔄 Getting SOL/USDC pool...');
    const poolInfo = await fetchPoolById(KNOWN_POOL_IDS.SOL_USDC);
    
    if (!poolInfo) {
      console.error('❌ SOL/USDC pool not found');
      return null;
    }
    
    const poolKeys = convertToLiquidityPoolKeys(poolInfo);
    console.log('✅ SOL/USDC pool loaded successfully');
    return poolKeys;
  } catch (error) {
    console.error('❌ Failed to get SOL/USDC pool:', error);
    return null;
  }
}

/**
 * Get both swap pools (WHISKEY->SOL and SOL->USDC)
 */
export async function getSwapPools(): Promise<{
  whiskeyToSol: RaydiumLiquidityPoolKeys | null;
  solToUsdc: RaydiumLiquidityPoolKeys | null;
}> {
  try {
    console.log('🔄 Loading both swap pools...');
    const [whiskeyToSol, solToUsdc] = await Promise.all([
      getWhiskeySolPool(),
      getSolUsdcPool()
    ]);
    
    console.log('📊 Swap pools status:', {
      whiskeyToSol: whiskeyToSol ? '✅ Loaded' : '❌ Failed',
      solToUsdc: solToUsdc ? '✅ Loaded' : '❌ Failed'
    });
    
    return { whiskeyToSol, solToUsdc };
  } catch (error) {
    console.error('❌ Failed to load swap pools:', error);
    return { whiskeyToSol: null, solToUsdc: null };
  }
}

/**
 * Extract all relevant account PublicKeys from pool keys for transaction building
 */
export function extractPoolAccounts(poolKeys: RaydiumLiquidityPoolKeys): PublicKey[] {
  return [
    poolKeys.id,
    poolKeys.authority,
    poolKeys.baseMint,
    poolKeys.quoteMint,
    poolKeys.baseVault,
    poolKeys.quoteVault,
    poolKeys.lpMint,
    poolKeys.openOrders,
    poolKeys.targetOrders,
    poolKeys.marketId,
    poolKeys.marketBids,
    poolKeys.marketAsks,
    poolKeys.marketEventQueue,
    poolKeys.marketBaseVault,
    poolKeys.marketQuoteVault,
    poolKeys.marketAuthority
  ].filter(Boolean); // Remove any undefined values
}

/**
 * Helper function to validate pool ID format
 */
export function isValidPoolId(poolId: string): boolean {
  try {
    new PublicKey(poolId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update known pool IDs (call this when you get the actual working pool IDs)
 */
export function updateKnownPoolIds(whiskeysolPoolId: string, solUsdcPoolId: string) {
  if (!isValidPoolId(whiskeysolPoolId) || !isValidPoolId(solUsdcPoolId)) {
    throw new Error('Invalid pool ID format provided');
  }
  
  KNOWN_POOL_IDS.WHISKEY_SOL = whiskeysolPoolId;
  KNOWN_POOL_IDS.SOL_USDC = solUsdcPoolId;
  
  console.log('✅ Updated known pool IDs:', KNOWN_POOL_IDS);
}