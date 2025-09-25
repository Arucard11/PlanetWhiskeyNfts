import { PublicKey } from '@solana/web3.js';

// Jupiter Quote API types
export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot: number;
  timeTaken: number;
}

export interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
  feeBps?: number;
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
}

// Mainnet token addresses
export const WHISKEY_MINT = '9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';


/**
 * Get Jupiter quote for WHISKEY → USDC swap with multi-hop routing
 * Uses Jupiter Lite API with progressive multi-hop strategy to find routes
 * through intermediate tokens (e.g., WHISKEY → SOL → USDC)
 * @param whiskeyAmount Amount of WHISKEY tokens (in lamports/smallest unit)
 * @param slippageBps Slippage tolerance in basis points (default: 500 = 5%)
 * @returns Jupiter quote response
 */
export async function getJupiterQuote(
  whiskeyAmount: number,
  slippageBps: number = 500
): Promise<JupiterQuoteResponse> {
  const params: JupiterQuoteParams = {
    inputMint: WHISKEY_MINT,
    outputMint: USDC_MINT,
    amount: whiskeyAmount,
    slippageBps,
    onlyDirectRoutes: false,
    asLegacyTransaction: false,
  };

  // Multi-hop routing strategy - prioritize finding any route through intermediate tokens
  const apiAttempts = [
    // First: Multi-hop with stable intermediates (SOL, USDT, RAY, etc.)
    { 
      url: `https://lite-api.jup.ag/swap/v1/quote`,
      params: {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: '500', // 5% slippage for multi-hop
        onlyDirectRoutes: 'false', // Allow multi-hop routing
        swapMode: 'ExactIn',
        restrictIntermediateTokens: 'true', // Use stable intermediate tokens like SOL
        maxAccounts: '48', // Allow more accounts for multi-hop
      }
    },
    // Second: Multi-hop with more intermediate tokens allowed
    { 
      url: `https://lite-api.jup.ag/swap/v1/quote`,
      params: {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: '600', // 6% slippage
        onlyDirectRoutes: 'false',
        swapMode: 'ExactIn',
        restrictIntermediateTokens: 'false', // Allow any intermediate tokens
        maxAccounts: '56', // More accounts for complex routes
      }
    },
    // Third: Higher slippage multi-hop for better discovery
    { 
      url: `https://lite-api.jup.ag/swap/v1/quote`,
      params: {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: '800', // 8% slippage
        onlyDirectRoutes: 'false',
        swapMode: 'ExactIn',
        restrictIntermediateTokens: 'false',
        maxAccounts: '64', // Maximum accounts for complex multi-hop
      }
    },
    // Fourth: Try direct routes as fallback (in case multi-hop fails)
    { 
      url: `https://lite-api.jup.ag/swap/v1/quote`,
      params: {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: '700', // 7% slippage for direct routes
        onlyDirectRoutes: 'true', // Direct only as fallback
        swapMode: 'ExactIn',
        restrictIntermediateTokens: 'true',
        maxAccounts: '32',
      }
    },
    // Fifth: Standard v6 API with maximum flexibility
    { 
      url: `https://quote-api.jup.ag/v6/quote`,
      params: {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: '1000', // 10% slippage - last resort
        onlyDirectRoutes: 'false', // Allow multi-hop
        asLegacyTransaction: 'false',
      }
    }
  ];

  for (const attempt of apiAttempts) {
    try {
      // Filter out undefined values and ensure all params are strings
      const cleanParams = Object.entries(attempt.params)
        .filter(([_, value]) => value !== undefined)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
      
      const queryParams = new URLSearchParams(cleanParams);

      const apiType = attempt.url.includes('lite-api') ? 'Lite API' : 'Standard API';
      const routeType = attempt.params.onlyDirectRoutes === 'true' ? 'direct routes' : 'multi-hop routing';
      const intermediateTokens = attempt.params.restrictIntermediateTokens === 'true' ? 'stable intermediates' : 'any intermediates';
      const maxAccounts = attempt.params.maxAccounts || 'unlimited';
      
      console.log(`🔄 Trying Jupiter ${apiType}: ${attempt.params.slippageBps}bps slippage, ${routeType} (${intermediateTokens}, max ${maxAccounts} accounts)...`);
      const response = await fetch(`${attempt.url}?${queryParams}`);
      
      if (response.ok) {
        const quote: JupiterQuoteResponse = await response.json();
        
        // Extract route information for multi-hop display
        const routeInfo = quote.routePlan.map((route, index) => {
          const ammKey = route.swapInfo?.ammKey || 'unknown';
          const inputMint = route.swapInfo?.inputMint || 'unknown';
          const outputMint = route.swapInfo?.outputMint || 'unknown';
          return `Route ${index + 1}: ${inputMint.slice(0, 8)}...→${outputMint.slice(0, 8)}... (${ammKey.slice(0, 8)}...)`;
        }).join(', ');

        console.log('✅ Multi-hop Jupiter Quote Found:', {
          inputAmount: `${whiskeyAmount / 1_000_000} WHISKEY`,
          outputAmount: `${parseInt(quote.outAmount) / 1_000_000} USDC`,
          priceImpact: `${quote.priceImpactPct}%`,
          slippage: `${quote.slippageBps / 100}%`,
          hops: quote.routePlan.length,
          routePath: routeInfo,
        });

        return quote;
      } else {
        const errorText = await response.text();
        console.warn(`Jupiter API ${attempt.url} failed:`, response.status, errorText);
      }
    } catch (error) {
      console.warn(`Jupiter API ${attempt.url} error:`, error);
    }
  }

  // If all API attempts fail, throw error
  throw new Error('All Jupiter API attempts failed - WHISKEY token may be temporarily unavailable for quotes');
}

/**
 * Convert Jupiter route plan to the format expected by our Solana program
 * @param routePlan Jupiter route plan from quote response
 * @returns Serialized route plan as Buffer
 */
export function serializeRoutePlan(routePlan: RoutePlan[]): Buffer {
  // Full Jupiter route plan serialization - keep all route data for proper Jupiter CPI
  const serialized: number[] = [];
  
  console.log(`📊 Serializing full Jupiter route plan: ${routePlan.length} routes`);
  
  // Add route plan length
  serialized.push(routePlan.length);
  
  for (const route of routePlan) {
    // Full route info for proper Jupiter CPI compatibility
    const ammKeyBytes = new PublicKey(route.swapInfo.ammKey).toBytes();
    const inputMintBytes = new PublicKey(route.swapInfo.inputMint).toBytes();
    const outputMintBytes = new PublicKey(route.swapInfo.outputMint).toBytes();
    
    // Add complete route data (full format for Jupiter CPI)
    serialized.push(...Array.from(ammKeyBytes));      // 32 bytes
    serialized.push(...Array.from(inputMintBytes));   // 32 bytes  
    serialized.push(...Array.from(outputMintBytes));  // 32 bytes
    
    // Add amounts as full 8-byte values for accuracy
    const inAmount = BigInt(route.swapInfo.inAmount);
    const outAmount = BigInt(route.swapInfo.outAmount);
    
    // 8-byte little-endian encoding for precise amounts
    for (let i = 0; i < 8; i++) {
      serialized.push(Number((inAmount >> BigInt(i * 8)) & BigInt(0xff)));
    }
    for (let i = 0; i < 8; i++) {
      serialized.push(Number((outAmount >> BigInt(i * 8)) & BigInt(0xff)));
    }
  }
  
  // Convert to Buffer for Anchor bytes type
  const buffer = Buffer.from(serialized);
  console.log(`📊 Full Jupiter route plan serialized: ${buffer.length} bytes for ${routePlan.length} routes`);
  console.log(`📊 Average bytes per route: ${(buffer.length - 1) / routePlan.length} bytes`);
  
  return buffer;
}

/**
 * Create minimal route plan for fallback scenarios when Jupiter quote fails
 * This creates a stub route that allows the transaction to proceed without actual swapping
 */
export function createMinimalRoutePlan(): Buffer {
  // Minimal route plan that indicates "no swap" or "stub swap"
  // This is used when Jupiter can't find a route but we still want the transaction to succeed
  const serialized: number[] = [];
  
  // Route count: 0 (no routes - indicates stub/bypass mode to Solana program)
  serialized.push(0);
  
  const buffer = Buffer.from(serialized);
  console.log('📊 Using minimal route plan for Jupiter fallback (1 byte - no swap mode)');
  return buffer;
}


/**
 * Validate Jupiter quote response
 * @param quote Jupiter quote response
 * @param expectedInputAmount Expected input amount
 * @returns true if valid
 */
export function validateJupiterQuote(
  quote: JupiterQuoteResponse,
  expectedInputAmount: number
): boolean {
  // Check if input amounts match
  if (parseInt(quote.inAmount) !== expectedInputAmount) {
    console.error('Quote input amount mismatch:', {
      expected: expectedInputAmount,
      received: parseInt(quote.inAmount),
    });
    return false;
  }

  // Check if we have a valid output amount
  if (parseInt(quote.outAmount) <= 0) {
    console.error('Invalid output amount:', quote.outAmount);
    return false;
  }

  // Check if route plan exists
  if (!quote.routePlan || quote.routePlan.length === 0) {
    console.error('No route plan in quote');
    return false;
  }

  // Check price impact (warn if > 5%)
  const priceImpact = parseFloat(quote.priceImpactPct);
  if (priceImpact > 5) {
    console.warn('High price impact detected:', `${priceImpact}%`);
  }

  return true;
}


/**
 * Get Jupiter quote with validation - real quotes only
 * @param whiskeyAmount Amount of WHISKEY tokens
 * @param slippageBps Slippage tolerance
 * @returns Jupiter quote or throws error
 */
export async function getJupiterQuoteWithValidation(
  whiskeyAmount: number,
  slippageBps: number = 500
): Promise<JupiterQuoteResponse> {
  console.log(`🔄 Getting Jupiter quote for ${whiskeyAmount / 1_000_000} WHISKEY...`);
  
  const quote = await getJupiterQuote(whiskeyAmount, slippageBps);
  
  if (validateJupiterQuote(quote, whiskeyAmount)) {
    console.log('✅ Jupiter quote validated successfully');
    return quote;
  } else {
    throw new Error('Jupiter quote validation failed');
  }
}
