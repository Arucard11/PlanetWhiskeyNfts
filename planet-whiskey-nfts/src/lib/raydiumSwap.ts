/**
 * Raydium API Integration for WHISKEY->USDC Direct Swap
 * Using Raydium's API instead of SDK to avoid pagination issues
 */

import { 
  Connection, 
  PublicKey, 
  VersionedTransaction, 
  Transaction
} from '@solana/web3.js'

// Token mints
const WHISKEY_MINT = process.env.NEXT_PUBLIC_WHISKEY_MINT!
const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT!

// Raydium API response interfaces
interface SwapCompute {
    id: string
    success: true
    version: 'V0' | 'V1'
    openTime?: undefined
    msg: undefined
    data: {
        swapType: 'BaseIn' | 'BaseOut'
        inputMint: string
        inputAmount: string
        outputMint: string
        outputAmount: string
        otherAmountThreshold: string
        slippageBps: number
        priceImpactPct: number
        routePlan: {
            poolId: string
            inputMint: string
            outputMint: string
            feeMint: string
            feeRate: number
            feeAmount: string
        }[]
  }
}

/**
 * Create WHISKEY->USDC direct swap using Raydium API
 * This bypasses the SDK pagination issues by using pre-built API endpoints
 */
export async function createWhiskeyToUsdcDirectSwap(
  connection: Connection,
  userPublicKey: PublicKey,
  whiskeyAmount: number, // Amount in WHISKEY tokens (with decimals)
    slippage: number = 0.005 // 0.5% slippage
): Promise<(Transaction | VersionedTransaction)[]> {
    try {
        console.log(`[API_SWAP] Creating WHISKEY->USDC swap via Raydium API for ${whiskeyAmount} WHISKEY`);
        
        // Import required modules
        const { API_URLS } = await import('@raydium-io/raydium-sdk-v2');
        const axios = (await import('axios')).default;
        
        // Define mints
        const inputMint = WHISKEY_MINT; // WHISKEY
        const outputMint = USDC_MINT; // USDC
        
        console.log(`[API_SWAP] Input: ${inputMint} (WHISKEY)`);
        console.log(`[API_SWAP] Output: ${outputMint} (USDC)`);
    
    // Convert WHISKEY amount to lamports (WHISKEY has 6 decimals)
        const inputAmountLamports = Math.floor(whiskeyAmount * Math.pow(10, 6));
        
        console.log(`[API_SWAP] Input amount: ${whiskeyAmount} WHISKEY (${inputAmountLamports} lamports)`);
        
        const slippageBps = Math.floor(slippage * 10000); // Convert to basis points
        const txVersion = 'V0'; // Use V0 for more transaction space
        
        console.log(`[API_SWAP] Slippage: ${slippage * 100}% (${slippageBps} bps)`);
        
        // Step 1: Get priority fee
        console.log('[API_SWAP] Fetching priority fee...');
        const { data: feeData } = await axios.get<{
            id: string
            success: boolean
            data: { default: { vh: number; h: number; m: number } }
        }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
        
        console.log(`[API_SWAP] Priority fees:`, feeData.data.default);
        
        // Step 2: Compute swap route
        console.log('[API_SWAP] Computing swap route...');
        const swapComputeUrl = `${API_URLS.SWAP_HOST}/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmountLamports}&slippageBps=${slippageBps}&txVersion=${txVersion}`;
        console.log(`[API_SWAP] Swap compute URL: ${swapComputeUrl}`);
        
        const { data: swapResponse } = await axios.get<SwapCompute>(swapComputeUrl);
        
        if (!swapResponse.success) {
            throw new Error('Failed to compute swap route via Raydium API');
        }
        
        console.log('[API_SWAP] Swap route computed:', {
            inputAmount: swapResponse.data.inputAmount,
            outputAmount: swapResponse.data.outputAmount,
            priceImpact: `${swapResponse.data.priceImpactPct}%`,
            routePlan: swapResponse.data.routePlan.length + ' hops'
        });
        
        // Get user's token accounts
        const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');
        const inputTokenAcc = getAssociatedTokenAddressSync(new PublicKey(inputMint), userPublicKey);
        const outputTokenAcc = getAssociatedTokenAddressSync(new PublicKey(outputMint), userPublicKey);
        
        console.log(`[API_SWAP] Input token account: ${inputTokenAcc.toString()}`);
        console.log(`[API_SWAP] Output token account: ${outputTokenAcc.toString()}`);
        
        // Step 3: Get swap transactions
        console.log('[API_SWAP] Fetching swap transactions...');
        const { data: swapTransactions } = await axios.post<{
            id: string
            version: string
            success: boolean
            data: { transaction: string }[]
        }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
            computeUnitPriceMicroLamports: String(feeData.data.default.h), // Use high priority
            swapResponse,
            txVersion,
            wallet: userPublicKey.toBase58(),
            wrapSol: false, // WHISKEY input, not SOL
            unwrapSol: false, // USDC output, not SOL
            inputAccount: inputTokenAcc.toBase58(),
            outputAccount: outputTokenAcc.toBase58(),
        });
        
        if (!swapTransactions.success) {
            throw new Error('Failed to get swap transactions from Raydium API');
        }
        
        console.log(`[API_SWAP] Received ${swapTransactions.data.length} transactions from API`);
        
        // Step 4: Deserialize transactions
        const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'));
        const allTransactions = allTxBuf.map((txBuf) => 
            txVersion === 'V0' ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
        );
        
        // Ensure user's wallet is the first signer for all transactions
        const { TransactionMessage } = await import('@solana/web3.js');
        const processedTransactions = await Promise.all(allTransactions.map(async (tx, index) => {
            if (tx instanceof VersionedTransaction) {
                // For VersionedTransaction, check if wallet is first signer
                const message = tx.message;
                const staticAccountKeys = message.staticAccountKeys;
                
                // Check if user's wallet is the first account (fee payer)
                const isFirstSigner = staticAccountKeys.length > 0 && staticAccountKeys[0].equals(userPublicKey);
                
                if (isFirstSigner) {
                    console.log(`[API_SWAP] Transaction ${index + 1}: Wallet is first signer ✅`);
                    return tx;
                } else {
                    // Wallet is not first, rebuild transaction with wallet as payer
                    console.log(`[API_SWAP] Transaction ${index + 1}: Rebuilding with wallet as first signer`);
                    
                    // Extract instructions from the message (keys are already resolved)
                    const instructions = message.instructions.map(ix => ({
                        programId: ix.programId,
                        keys: ix.keys,
                        data: ix.data
                    }));
                    
                    // Get fresh blockhash
                    const { blockhash } = await connection.getLatestBlockhash();
                    
                    // Rebuild with user as payer (first signer)
                    // The TransactionMessage will automatically place the payerKey as the first account
                    const newMessage = new TransactionMessage({
                        payerKey: userPublicKey,
                        recentBlockhash: blockhash,
                        instructions: instructions
                    }).compileToV0Message(message.addressTableLookups);
                    
                    return new VersionedTransaction(newMessage);
                }
            } else {
                // For legacy Transaction, set fee payer
                if (!tx.feePayer || !tx.feePayer.equals(userPublicKey)) {
                    console.log(`[API_SWAP] Transaction ${index + 1}: Setting feePayer to wallet`);
                    tx.feePayer = userPublicKey;
                    // Get fresh blockhash for legacy transaction
                    const { blockhash } = await connection.getLatestBlockhash();
                    tx.recentBlockhash = blockhash;
                } else {
                    console.log(`[API_SWAP] Transaction ${index + 1}: FeePayer is already wallet ✅`);
                }
            }
            return tx;
        }));
        
        console.log(`[API_SWAP] ✅ Created ${processedTransactions.length} swap transactions via API`);
        console.log(`[API_SWAP] Expected USDC output: ${parseFloat(swapResponse.data.outputAmount) / Math.pow(10, 6)} USDC`);
        console.log(`[API_SWAP] This represents the lending portion of the total payment`);
        
        // Log transaction sizes
        processedTransactions.forEach((tx, index) => {
            const serialized = tx.serialize();
            const isVersioned = tx instanceof VersionedTransaction;
            console.log(`[API_SWAP] Transaction ${index + 1} size: ${serialized.length} bytes (${isVersioned ? 'V0' : 'Legacy'})`);
            
            if (serialized.length > 1000) {
                console.warn(`[API_SWAP] ⚠️ Transaction ${index + 1} is large: ${serialized.length} bytes (limit: ~1232 bytes)`);
            }
        });
        
        return processedTransactions;
    
  } catch (error) {
        console.error('[API_SWAP] Error creating WHISKEY->USDC swap via API:', error);
    throw error;
  }
}
