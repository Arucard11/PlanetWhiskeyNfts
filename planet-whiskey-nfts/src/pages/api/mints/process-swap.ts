import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
// Types are optional at runtime; import IDL only
import whiskeyProgramIdl from '@/lib/idl/whiskeyprogram.json';
import fs from 'fs';
import path from 'path';

// Environment constants
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const WHISKEY_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!);
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
const WHISKEY_TOKEN_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WRAPPED_SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Raydium Pool IDs
const WHISKEY_SOL_POOL_ID = new PublicKey('6vSXoRsZ4iPH1dW7LKu8CzAgv9AfvWXGXYnnkSrXtDLp');
const SOL_USDC_POOL_ID = new PublicKey('58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2');
const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

// PDA Seeds
const LENDING_POOL_SEED = Buffer.from('lending_pool');
const CAPITAL_VAULT_SEED = Buffer.from('capital_vault_usdc');
const GLOBAL_MARKET_SEED = Buffer.from('global_market');

interface SwapRequest {
    // Optional - for verification
    nftMintAddress?: string;
    transactionSignature?: string;
}

interface SwapResponse {
    success: boolean;
    message: string;
    transactionSignatures?: string[];
    whiskeyAmount?: number;
    usdcAmount?: number;
    error?: string;
    steps?: StepResult[];
}

function loadSwapKeypair(): Keypair {
    try {
        // Try to load from environment variable first
        if (process.env.SWAP_KEYPAIR_JSON) {
            const keypairData = JSON.parse(process.env.SWAP_KEYPAIR_JSON);
            return Keypair.fromSecretKey(new Uint8Array(keypairData));
        }

        // Fallback to file-based loading
        const keypairPath = path.join(process.cwd(), 'scripts', 'swap-keypair.json');
        if (fs.existsSync(keypairPath)) {
            const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
            return Keypair.fromSecretKey(new Uint8Array(keypairData));
        }

        throw new Error('Swap keypair not found');
    } catch (error) {
        console.error('Failed to load swap keypair:', error);
        throw error;
    }
}

interface StepResult {
    success: boolean;
    message: string;
    transactionSignature?: string;
    error?: string;
}

async function executeWithRetry<T>(
    stepName: string,
    operation: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 ${stepName} - Attempt ${attempt}/${maxRetries}`);
            const result = await operation();
            console.log(`✅ ${stepName} - Success on attempt ${attempt}`);
            return result;
        } catch (error) {
            lastError = error as Error;
            console.error(`❌ ${stepName} - Failed on attempt ${attempt}:`, error);
            
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error(`${stepName} failed after ${maxRetries} attempts`);
}

async function processWhiskeySwapAndTransfer(): Promise<{
    success: boolean;
    message: string;
    transactionSignatures?: string[];
    whiskeyAmount?: number;
    usdcAmount?: number;
    error?: string;
    steps?: StepResult[];
}> {
    const steps: StepResult[] = [];
    const transactionSignatures: string[] = [];
    
    try {
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
        const swapKeypair = loadSwapKeypair();

        console.log('🔄 Starting multi-step whiskey swap and transfer process...');
        console.log('📍 Swap authority:', swapKeypair.publicKey.toString());

        // Set up Anchor program
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(swapKeypair),
            { commitment: 'confirmed' }
        );
        const program = new Program(whiskeyProgramIdl as any, provider);

        // Calculate PDAs
        const lendingPoolConfigPda = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_LENDING_POOL_CONFIG!);
        const whiskeyVaultPda = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_VAULT!);
        const usdcVaultPda = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_USDC_VAULT!);
        const intermediateSolPda = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_INTERMEDIATE_SOL!);

        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [GLOBAL_MARKET_SEED],
            LENDING_PROGRAM_ID
        );

        const [capitalVaultPda] = PublicKey.findProgramAddressSync(
            [CAPITAL_VAULT_SEED],
            LENDING_PROGRAM_ID
        );

        // Check initial balances
        let whiskeyAmount = 0;
        try {
            const whiskeyVaultInfo = await connection.getTokenAccountBalance(whiskeyVaultPda);
            whiskeyAmount = whiskeyVaultInfo.value.uiAmount || 0;
            console.log(`💰 Initial whiskey vault balance: ${whiskeyAmount} WHISKEY tokens`);
        } catch (error) {
            const errorMsg = 'Whiskey vault account not found - may need initialization';
            steps.push({ success: false, message: errorMsg, error: 'Account not found' });
            return {
                success: false,
                message: errorMsg,
                error: 'Account not found',
                steps
            };
        }

        if (whiskeyAmount < 0.001) {
            const msg = 'No significant whiskey balance to swap';
            steps.push({ success: true, message: msg });
            return {
                success: true,
                message: msg,
                whiskeyAmount: 0,
                usdcAmount: 0,
                steps
            };
        }

        // Check SOL balance for transaction fees
        const solBalance = await connection.getBalance(swapKeypair.publicKey);
        const solBalanceSOL = solBalance / 1e9;
        console.log(`💰 Swap wallet SOL balance: ${solBalanceSOL} SOL`);
        
        if (solBalance < 50000000) { // 0.05 SOL minimum for multiple transactions
            const errorMsg = 'Insufficient SOL balance for multiple transactions';
            steps.push({ success: false, message: errorMsg, error: `Need at least 0.05 SOL, have ${solBalanceSOL}` });
            return {
                success: false,
                message: errorMsg,
                error: `Swap wallet has ${solBalanceSOL} SOL, needs at least 0.05 SOL`,
                steps
            };
        }

        // Load Raydium pool and serum accounts from env (must be exact)
        const whiskeyPoolAuthority = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_POOL_AUTHORITY!);
        const whiskeyPoolOpenOrders = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_POOL_OPEN_ORDERS!);
        const whiskeyPoolTargetOrders = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_POOL_TARGET_ORDERS!);
        const whiskeyPoolTokenVaultA = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_POOL_TOKEN_VAULT_A!);
        const whiskeyPoolTokenVaultB = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_POOL_TOKEN_VAULT_B!);
        const whiskeySerumProgramId = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_PROGRAM_ID!);
        const whiskeySerumMarket = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_MARKET!);
        const whiskeySerumBids = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_BIDS!);
        const whiskeySerumAsks = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_ASKS!);
        const whiskeySerumEventQueue = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_EVENT_QUEUE!);
        const whiskeySerumCoinVault = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_BASE_VAULT!);
        const whiskeySerumPcVault = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_QUOTE_VAULT!);
        const whiskeySerumVaultSigner = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_SOL_SERUM_AUTHORITY!);

        const solPoolAuthority = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_POOL_AUTHORITY!);
        const solPoolOpenOrders = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_POOL_OPEN_ORDERS!);
        const solPoolTargetOrders = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_POOL_TARGET_ORDERS!);
        const solPoolTokenVaultA = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_POOL_TOKEN_VAULT_A!);
        const solPoolTokenVaultB = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_POOL_TOKEN_VAULT_B!);
        const solSerumProgramId = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_PROGRAM_ID!);
        const solSerumMarket = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_MARKET!);
        const solSerumBids = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_BIDS!);
        const solSerumAsks = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_ASKS!);
        const solSerumEventQueue = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_EVENT_QUEUE!);
        const solSerumCoinVault = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_BASE_VAULT!);
        const solSerumPcVault = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_QUOTE_VAULT!);
        const solSerumVaultSigner = new PublicKey(process.env.NEXT_PUBLIC_SOL_USDC_SERUM_AUTHORITY!);

        const whiskeyAmountLamports = Math.floor(whiskeyAmount * 1_000_000);

        // Step 1: WHISKEY → SOL (Raydium CPI)
        const swapWsSig = await executeWithRetry('Swap WHISKEY → SOL', async () => {
            const sig = await program.methods
                .swapWhiskeyToSolRaydium(new anchor.BN(whiskeyAmountLamports))
                .accounts({
                    user: swapKeypair.publicKey,
                    lendingPoolConfig: lendingPoolConfigPda,
                    lendingPoolWhiskeyVault: whiskeyVaultPda,
                    intermediateSolAccount: intermediateSolPda,
                    whiskeySolPool: WHISKEY_SOL_POOL_ID,
                    whiskeySolPoolAuthority: whiskeyPoolAuthority,
                    whiskeySolPoolOpenOrders: whiskeyPoolOpenOrders,
                    whiskeySolPoolTargetOrders: whiskeyPoolTargetOrders,
                    whiskeySolPoolTokenVaultA: whiskeyPoolTokenVaultA,
                    whiskeySolPoolTokenVaultB: whiskeyPoolTokenVaultB,
                    whiskeySolSerumProgramId: whiskeySerumProgramId,
                    whiskeySolSerumMarket: whiskeySerumMarket,
                    whiskeySolSerumBids: whiskeySerumBids,
                    whiskeySolSerumAsks: whiskeySerumAsks,
                    whiskeySolSerumEventQueue: whiskeySerumEventQueue,
                    whiskeySolSerumCoinVault: whiskeySerumCoinVault,
                    whiskeySolSerumPcVault: whiskeySerumPcVault,
                    whiskeySolSerumVaultSigner: whiskeySerumVaultSigner,
                    wrappedSolMint: WRAPPED_SOL_MINT,
                    raydiumAmmProgram: RAYDIUM_AMM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            return sig;
        });
        steps.push({ success: true, message: 'WHISKEY → SOL swap completed', transactionSignature: swapWsSig });
        transactionSignatures.push(swapWsSig);

        // Step 2: SOL → USDC (Raydium CPI)
        const swapSuSig = await executeWithRetry('Swap SOL → USDC', async () => {
            const sig = await program.methods
                .swapSolToUsdcRaydium()
                .accounts({
                    user: swapKeypair.publicKey,
                    lendingPoolConfig: lendingPoolConfigPda,
                    intermediateSolAccount: intermediateSolPda,
                    lendingPoolUsdcVault: usdcVaultPda,
                    solUsdcPool: SOL_USDC_POOL_ID,
                    solUsdcPoolAuthority: solPoolAuthority,
                    solUsdcPoolOpenOrders: solPoolOpenOrders,
                    solUsdcPoolTargetOrders: solPoolTargetOrders,
                    solUsdcPoolTokenVaultA: solPoolTokenVaultA,
                    solUsdcPoolTokenVaultB: solPoolTokenVaultB,
                    solUsdcSerumProgramId: solSerumProgramId,
                    solUsdcSerumMarket: solSerumMarket,
                    solUsdcSerumBids: solSerumBids,
                    solUsdcSerumAsks: solSerumAsks,
                    solUsdcSerumEventQueue: solSerumEventQueue,
                    solUsdcSerumCoinVault: solSerumCoinVault,
                    solUsdcSerumPcVault: solSerumPcVault,
                    solUsdcSerumVaultSigner: solSerumVaultSigner,
                    raydiumAmmProgram: RAYDIUM_AMM_PROGRAM_ID,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            return sig;
        });
        steps.push({ success: true, message: 'SOL → USDC swap completed', transactionSignature: swapSuSig });
        transactionSignatures.push(swapSuSig);

        // Step 3: PDA transfer USDC → Lending Capital Vault
        const currentUsdcInfo = await connection.getTokenAccountBalance(usdcVaultPda);
        const currentUsdcAmount = currentUsdcInfo.value.amount; // raw string
        if (currentUsdcAmount !== '0') {
            const transferSig = await executeWithRetry('PDA transfer USDC → Lending Vault', async () => {
                const sig = await program.methods
                    .pdaTransferToLendingVault(new anchor.BN(currentUsdcAmount))
                    .accounts({
                        lendingPoolConfig: lendingPoolConfigPda,
                        whiskeyUsdcVault: usdcVaultPda,
                        lendingCapitalVault: capitalVaultPda,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .rpc();
                return sig;
            });
            steps.push({ success: true, message: 'USDC transferred to lending capital vault', transactionSignature: transferSig });
            transactionSignatures.push(transferSig);
        } else {
            steps.push({ success: true, message: 'No USDC to transfer' });
        }

        // Get final balances
        const finalUsdcVaultInfo = await connection.getTokenAccountBalance(capitalVaultPda);
        const finalUsdcAmount = finalUsdcVaultInfo.value.uiAmount || 0;

        return {
            success: true,
            message: `Successfully completed multi-step swap: ${whiskeyAmount} WHISKEY → USDC → Lending Pool`,
            transactionSignatures,
            whiskeyAmount,
            usdcAmount: finalUsdcAmount,
            steps
        };

    } catch (error) {
        console.error('❌ Swap process failed:', error);
        
        // Log more details about the error
        if (error instanceof Error) {
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        
        // Check if it's an Anchor error
        if (error && typeof error === 'object' && 'logs' in error) {
            console.error('Transaction logs:', (error as any).logs);
        }
        
        // Add error to steps
        steps.push({
            success: false,
            message: 'Process failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        return {
            success: false,
            message: 'Failed to process whiskey swap and transfer',
            error: error instanceof Error ? error.message : 'Unknown error',
            transactionSignatures,
            steps
        };
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SwapResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    try {
        const result = await processWhiskeySwapAndTransfer();
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('API handler error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
