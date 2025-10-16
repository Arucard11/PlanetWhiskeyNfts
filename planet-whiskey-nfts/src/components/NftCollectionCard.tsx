import React, { useState, useEffect} from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
    PublicKey, 
    Transaction, 
    VersionedTransaction,
    SystemProgram, 
    TransactionInstruction,
    LAMPORTS_PER_SOL,
    Keypair,
    SYSVAR_RENT_PUBKEY,
    AddressLookupTableAccount,
    TransactionMessage
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction,
    createCloseAccountInstruction,
    createTransferInstruction
} from '@solana/spl-token';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

// Raydium SDK Integration
import { Liquidity, LiquidityPoolKeys, Percent, Token, TokenAmount } from '@raydium-io/raydium-sdk';

// Import IDL and types
import { Whiskeyprogram } from '@/lib/idl/whiskeyprogram';
import whiskeyIdl from '@/lib/idl/whiskeyprogram.json';
import MediaWithFallback from './MediaWithFallback';
import { convertUsdToWhiskeyTokens, formatWhiskeyTokens, formatUsdAmount, useRealTimeWhiskeyPrice, getPriceChangeColor, formatPercentageChange, getCurrentWhiskeyRate, getCurrentSolRate } from '@/lib/coingeckoPricing';
import { getSwapPools, extractPoolAccounts, type RaydiumLiquidityPoolKeys } from '@/lib/raydiumApi';
import { createVersionedTransaction, getMintingLookupTableAddress, fetchLookupTable } from '@/lib/addressLookupTable';
import { getSolanaConnection } from '@/lib/solanaUtils';

// Token addresses
const WHISKEY_MINT = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!);
const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
const DEV_WALLET = new PublicKey("CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n"); // Dev wallet for fees

// Jito tip accounts (mainnet)


export interface NftCollectionCardProps {
    _id: string; 
    collectionOnChainAddress: string; 
    name: string;                     
    symbol: string;                   
    metadataUri: string;              
    nftBaseMetadataUri: string;       // Base URI for individual NFTs
    mintPriceLamports: number; 
    mintPriceWhiskeyTokens: number;
    mintPriceUsd?: number;
    itemLimit: number; 
    itemsMintedOnChain?: number; 
    onMintSuccess?: () => void;
    isWhiskeyGated?: boolean;
    requiredWhiskeyAmount?: number;
}

const NftCollectionCard: React.FC<NftCollectionCardProps> = ({ 
    _id, 
    collectionOnChainAddress, 
    name,
    symbol,
    metadataUri, 
    nftBaseMetadataUri,
    mintPriceLamports,
    mintPriceWhiskeyTokens,
    mintPriceUsd,
    itemLimit,
    itemsMintedOnChain = 0,
    onMintSuccess,
    isWhiskeyGated = false,
    requiredWhiskeyAmount = 0
}) => {
    const { connection } = useConnection();
    const { publicKey, connected, signAllTransactions, signTransaction, sendTransaction, wallet } = useWallet();

    // State management
    const [isMinting, setIsMinting] = useState(false);
    const [mintMessage, setMintMessage] = useState('');
    
    // Two-step mint flow state
    const [step1Complete, setStep1Complete] = useState(false);
    const [step2Complete, setStep2Complete] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [walletImageUrl, setWalletImageUrl] = useState(''); // Wallet-compatible image URL for minting
    const [imageLoading, setImageLoading] = useState(true);
    const [walletNftCount, setWalletNftCount] = useState<number>(0);
    const [userWhiskeyBalance, setUserWhiskeyBalance] = useState<number>(0);
    const [whiskeyBalanceLoading, setWhiskeyBalanceLoading] = useState<boolean>(true);
    const [userSolBalance, setUserSolBalance] = useState<number>(0);
    const [solBalanceLoading, setSolBalanceLoading] = useState<boolean>(true);
    // Real-time WHISKEY price data
    const { priceData: whiskeyPriceData, loading: priceLoadingState } = useRealTimeWhiskeyPrice();
    const whiskeyRate = whiskeyPriceData?.usd || 1;

    // Display values
    const displayName = name;
    const displaySymbol = symbol;
    const displayItemLimit = itemLimit;
    const displayItemsMinted = itemsMintedOnChain;
    
    // Calculate WHISKEY tokens needed based on USD price
    const usdPrice = mintPriceUsd || 0;
    const whiskeyTokensNeeded = whiskeyRate && whiskeyRate > 0 ? (usdPrice / whiskeyRate) : 0;
    const displayMintPriceWhiskeyTokens = whiskeyTokensNeeded;
    
    const hasRequiredWhiskey = userWhiskeyBalance >= (requiredWhiskeyAmount || 0);

    // Fetch collection image on mount
    useEffect(() => {
        const fetchCollectionImage = async () => {
            if (!metadataUri) {
                setImageLoading(false);
                return;
            }

            try {
                setImageLoading(true);
                
                // Fetch both display image (with proxy) and wallet-compatible image
                console.log(`[NftCollectionCard] Fetching metadata for display and wallet compatibility`);
                
                // For web display (with proxy for mobile compatibility)
                const displayApiUrl = `/api/collections/metadata?metadataUri=${encodeURIComponent(metadataUri)}`;
                const displayResponse = await fetch(displayApiUrl);
                
                // For wallet compatibility (public URLs only)
                const walletApiUrl = `/api/collections/wallet-metadata?metadataUri=${encodeURIComponent(metadataUri)}`;
                const walletResponse = await fetch(walletApiUrl);
                
                if (displayResponse.ok) {
                    const displayResult = await displayResponse.json();
                    if (displayResult.success && displayResult.data.image) {
                        console.log(`[NftCollectionCard] Setting display image URL for ${name}:`, displayResult.data.image);
                        setImageUrl(displayResult.data.image);
                    }
                }
                
                if (walletResponse.ok) {
                    const walletResult = await walletResponse.json();
                    if (walletResult.success && walletResult.data.image) {
                        console.log(`[NftCollectionCard] Setting wallet-compatible image URL for ${name}:`, walletResult.data.image);
                        setWalletImageUrl(walletResult.data.image);
                    }
                }
                
                if (!displayResponse.ok && !walletResponse.ok) {
                    console.warn(`[NftCollectionCard] Both metadata APIs failed for ${name}`);
                }
                
                    } catch (error) {
                console.error('Error fetching collection metadata:', error);
                    } finally {
                setImageLoading(false);
            }
        };

        fetchCollectionImage();
    }, [metadataUri]);

    // Function to check wallet NFT count for any collection
        const checkWalletNftCount = async () => {
        if (!connected || !publicKey) {
                setWalletNftCount(0);
                return;
            }

            try {
            console.log('[WALLET_CHECK] Checking NFT count for collection...');
                const response = await fetch(`/api/wallet/nft-count?walletAddress=${publicKey.toString()}&collectionMintAddress=${collectionOnChainAddress}`);
                
                if (!response.ok) {
                    console.error('[WALLET_CHECK] Failed to fetch wallet NFT count:', response.status);
                    setWalletNftCount(0);
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    console.log(`[WALLET_CHECK] Wallet has ${data.count} NFTs from this collection`);
                    setWalletNftCount(data.count);
                } else {
                    console.error('[WALLET_CHECK] API returned error:', data.message);
                    setWalletNftCount(0);
                }
            } catch (error) {
                console.error('[WALLET_CHECK] Error checking wallet NFT count:', error);
                setWalletNftCount(0);
            }
        };

    // Check wallet NFT count when dependencies change
    useEffect(() => {
        if (isWhiskeyGated || !isWhiskeyGated) { // Check for both whiskey-gated and regular collections
        checkWalletNftCount();
        }
    }, [connected, publicKey, isWhiskeyGated, collectionOnChainAddress]);

    // Check user WHISKEY balance
    useEffect(() => {
        const checkUserWhiskeyBalance = async () => {
            if (!connected || !publicKey) {
                setWhiskeyBalanceLoading(false);
                setUserWhiskeyBalance(0);
                return;
            }

            setWhiskeyBalanceLoading(true);
            try {
                const whiskeyTokenAccount = getAssociatedTokenAddressSync(WHISKEY_MINT, publicKey);
                const accountInfo = await connection.getAccountInfo(whiskeyTokenAccount);
                
                if (accountInfo) {
                    const balance = await connection.getTokenAccountBalance(whiskeyTokenAccount);
                    setUserWhiskeyBalance(parseFloat(balance.value.uiAmount?.toString() || '0'));
                } else {
                    setUserWhiskeyBalance(0);
                }
            } catch (error) {
                console.error('Error checking WHISKEY balance:', error);
                setUserWhiskeyBalance(0);
            } finally {
                setWhiskeyBalanceLoading(false);
            }
        };

        checkUserWhiskeyBalance();
    }, [connected, publicKey, connection]);

    // Check SOL balance
    useEffect(() => {
        const checkUserSolBalance = async () => {
            if (!connected || !publicKey) {
                setSolBalanceLoading(false);
                setUserSolBalance(0);
                return;
            }

            setSolBalanceLoading(true);
            try {
                const balance = await connection.getBalance(publicKey);
                setUserSolBalance(balance / LAMPORTS_PER_SOL); // Convert lamports to SOL
            } catch (error) {
                console.error('Error checking SOL balance:', error);
                setUserSolBalance(0);
            } finally {
                setSolBalanceLoading(false);
            }
        };

        checkUserSolBalance();
    }, [connected, publicKey, connection]);

 

 

    // Step 1: Swap WHISKEY to USDC and deposit to vault
    const handleStep1SwapAndDeposit = async (): Promise<void> => {
        if (!connected || !publicKey || !signAllTransactions) {
            throw new Error('Wallet not connected');
        }

        console.log('[STEP1] Starting WHISKEY->USDC swap...');
        console.log(`[STEP1] Using RPC endpoint: ${connection.rpcEndpoint}`);
        
        try {
            console.log('[STEP1] 🚀 Starting Step 1 - Swap Only (New Atomic Flow)');
            
            // Calculate swap amount (lending portion + dev fee portion that needs to be USDC)
            const lendingShareBps = 8000; // 80% to lending
            const devFeePercentage = 0.02; // 2% dev fee
            const treasuryPercentageStep1 = 0.20; // 20% to treasury (unchanged)
            const lendingPercentage = lendingShareBps / 10000; // e.g., 8000/10000 = 0.80
            
            const baseLendingWhiskey = displayMintPriceWhiskeyTokens * lendingPercentage;
            const devFeeWhiskey = displayMintPriceWhiskeyTokens * devFeePercentage;
            const baseWhiskeyToSwap = baseLendingWhiskey + devFeeWhiskey;
            
            // Add 4% buffer to account for swap fees, slippage, and dev fee
            const whiskeyToSwap = baseWhiskeyToSwap * 1.04;
            const whiskeyToKeepForTreasury = displayMintPriceWhiskeyTokens * treasuryPercentageStep1;
            
            console.log(`[STEP1] Payment breakdown:`);
            console.log(`  - Total WHISKEY payment: ${displayMintPriceWhiskeyTokens} WHISKEY`);
            console.log(`  - Lending portion (${(lendingPercentage * 100).toFixed(1)}%): ${baseLendingWhiskey} WHISKEY`);
            
            console.log(`  - Base amount to swap: ${baseWhiskeyToSwap} WHISKEY`);
            console.log(`  - Total with 8% buffer: ${whiskeyToSwap} WHISKEY → USDC (Step 1)`);
            console.log(`  - Treasury portion (${(treasuryPercentageStep1 * 100).toFixed(1)}%): ${whiskeyToKeepForTreasury} WHISKEY → Treasury (Step 2)`);
            
            // Import the direct swap function
            console.log('[STEP1] Importing raydium swap function...');
            const { createWhiskeyToUsdcDirectSwap } = await import('../lib/raydiumSwap');
            console.log('[STEP1] ✅ Raydium swap function imported');
            
            // Create direct WHISKEY->USDC swap transactions (only for lending portion)
            console.log(`[STEP1] Creating swap for ${whiskeyToSwap} WHISKEY (${(lendingPercentage * 100).toFixed(1)}% of total)`);
            
            let swapTransactions;
            try {
                console.log('[STEP1] Calling createWhiskeyToUsdcDirectSwap...');
                swapTransactions = await createWhiskeyToUsdcDirectSwap(
                    connection,
                    publicKey,
                    whiskeyToSwap, // ✅ Only swap the lending percentage
                    0.005 // 0.5% slippage
                );
                console.log('[STEP1] ✅ Swap transactions created successfully');
            } catch (swapError) {
                console.error('[STEP1] ❌ Error in createWhiskeyToUsdcDirectSwap:', swapError);
                console.error('[STEP1] Swap error details:', {
                    message: swapError.message,
                    stack: swapError.stack,
                    whiskeyToSwap,
                    publicKey: publicKey.toString()
                });
                throw swapError;
            }
            
            console.log(`[STEP1] Created ${swapTransactions.length} swap transactions`);
            
            // Check transaction types from Raydium
            swapTransactions.forEach((tx, index) => {
                console.log(`[STEP1] Swap transaction ${index + 1} type: ${tx.constructor.name}`);
                if ('version' in tx) {
                    console.log(`[STEP1] Swap transaction ${index + 1} version: ${(tx as any).version}`);
                }
            });
            
            // Sign and send swap transactions only (no payment processing in Step 1 anymore)
            console.log('[STEP1] Requesting wallet signatures for swap transactions...');
            const signedTransactions = await signAllTransactions(swapTransactions);
            console.log('[STEP1] ✅ All swap transactions signed by wallet');
            
            // Log transaction sizes after signing
            signedTransactions.forEach((tx, index) => {
                const serializedSize = tx.serialize().length;
                console.log(`[STEP1] Signed Swap Transaction ${index + 1}: ${serializedSize} bytes`);
                
                if (serializedSize > 1000) {
                    console.warn(`[STEP1] ⚠️ Transaction ${index + 1} is large: ${serializedSize} bytes`);
                }
            });
            
            // Send swap transactions sequentially
            console.log('[STEP1] Sending swap transactions to blockchain...');
            for (let i = 0; i < signedTransactions.length; i++) {
                const tx = signedTransactions[i];
                
                try {
                    console.log(`[STEP1] Sending swap transaction ${i + 1}...`);
                    const signature = await connection.sendRawTransaction(tx.serialize());
                    console.log(`[STEP1] Swap transaction ${i + 1} sent: ${signature}`);
                    
                    console.log(`[STEP1] Confirming swap transaction ${i + 1}...`);
                    await connection.confirmTransaction(signature, 'confirmed');
                    console.log(`[STEP1] ✅ Swap transaction ${i + 1} confirmed: ${signature}`);
                    
                } catch (sendError) {
                    console.error(`[STEP1] ❌ Error sending swap transaction ${i + 1}:`, sendError);
                    throw sendError;
                }
            }
            
            console.log('[STEP1] 🎉 All swap transactions completed successfully!');
            console.log('[STEP1] ✅ Step 1 complete: WHISKEY swapped to USDC. Ready for Step 2 (Atomic Mint + Payment)');
            
        } catch (error) {
            console.error('[STEP1] Error in swap:', error);
            throw error;
        }
    };

    // Step 2: Mint NFT with Address Lookup Table support
    const handleStep2MintNftWithLookupTable = async (): Promise<void> => {
        if (!connected || !publicKey || !sendTransaction) {
            throw new Error('Wallet not connected or does not support sendTransaction');
        }

        console.log('[STEP2_ALT] Starting NFT mint with lookup table...');
        
        try {
            // Create individual NFT metadata and upload to IPFS
            console.log(`[STEP2_ALT] Creating individual NFT metadata...`);
            const nftName = `${displayName} #${(displayItemsMinted || 0) + 1}`;
            
            // Determine the NFT image URL - prioritize wallet-compatible URL for Phantom display
            console.log(`[STEP2_ALT] 🔍 Image URL Debug:`, {
                walletImageUrl,
                imageUrl,
                displayName
            });
            
            let nftImageUrl = '';
            if (walletImageUrl && walletImageUrl !== '' && !walletImageUrl.includes('placeholder')) {
                nftImageUrl = walletImageUrl;
                console.log(`[STEP2_ALT] ✅ Using wallet-compatible image: ${nftImageUrl}`);
            } else if (imageUrl && imageUrl !== '' && imageUrl !== '/placeholder-image.svg' && !imageUrl.includes('placeholder')) {
                nftImageUrl = imageUrl;
                console.log(`[STEP2_ALT] ⚠️ Using display image (may not work in wallets): ${nftImageUrl}`);
            } else {
                // No valid image available - skip minting
                throw new Error('No collection image available. Please upload a collection image before minting.');
            }

            setMintMessage('Creating NFT metadata...');
            
            // Debug log the metadata request
            const metadataRequestBody = {
                nftName: nftName,
                nftSymbol: displaySymbol,
                nftDescription: `${displayName} - Edition #${(displayItemsMinted || 0) + 1}`,
                nftImageUrl: nftImageUrl,
                attributes: [
                    { trait_type: 'Edition', value: ((displayItemsMinted || 0) + 1).toString() },
                    { trait_type: 'Collection', value: displayName },
                    { trait_type: 'Type', value: 'Treasury NFT' },
                    { trait_type: 'Rarity', value: 'Legendary' },
                    { trait_type: 'Mint Timestamp', value: Date.now().toString() }
                ],
                collectionName: displayName,
                collectionFamily: displayName,
                mintNumber: (displayItemsMinted || 0) + 1,
                mintTimestamp: Date.now(),
                creatorAddress: publicKey.toString()
            };
            
            console.log(`[STEP2_ALT] 📝 Metadata request body:`, metadataRequestBody);
            
            const metadataResponse = await fetch('/api/mints/create-nft-metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(metadataRequestBody),
            });

            if (!metadataResponse.ok) {
                const errorData = await metadataResponse.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || metadataResponse.statusText || 'Failed to create NFT metadata';
                console.error(`[STEP2_ALT] ❌ Metadata API error:`, errorData);
                throw new Error(errorMessage);
            }

            const metadataResult = await metadataResponse.json();
            const nftMetadataUri = metadataResult.metadataUri;
            console.log(`[STEP2_ALT] ✅ NFT metadata created: ${nftMetadataUri}`);

            // Calculate payment amounts (same as regular minting)
            setMintMessage('Calculating payment amounts...');
            
            const whiskeyRate = await getCurrentWhiskeyRate();
            const lendingShareBps = 8000; // 80% to lending
            const devFeePercentage = 0.02; // 2% dev fee
            const treasuryShareBps = 2000; // 20% to treasury (unchanged)
            
            const lendingPercentage = lendingShareBps / 10000;
            const treasuryPercentage = treasuryShareBps / 10000;
            
            const whiskeyToTreasury = displayMintPriceWhiskeyTokens * treasuryPercentage;
            const usdcToVault = (mintPriceUsd || 0) * lendingPercentage;
            const usdcToDevWallet = (mintPriceUsd || 0) * devFeePercentage;
            
            // Convert to lamports/micro-units
            const whiskeyToTreasuryLamports = Math.floor(whiskeyToTreasury * 1000000); // WHISKEY has 6 decimals
            const usdcToVaultLamports = Math.floor(usdcToVault * 1000000); // USDC has 6 decimals
            const usdcToDevWalletLamports = Math.floor(usdcToDevWallet * 1000000); // USDC has 6 decimals
            const currentWhiskeyPriceUsdMicro = Math.floor(whiskeyRate * 1000000); // Price in micro-USD
            
            console.log(`[STEP2_ALT] Payment calculation:`);
            console.log(`  - WHISKEY to treasury: ${whiskeyToTreasury} tokens (${whiskeyToTreasuryLamports} lamports)`);
            console.log(`  - USDC to vault: ${usdcToVault} USDC (${usdcToVaultLamports} lamports)`);
            console.log(`  - Current WHISKEY price: $${whiskeyRate} (${currentWhiskeyPriceUsdMicro} micro-USD)`);

            // Build minting transaction on frontend
            setMintMessage('Building transaction on frontend...');
            console.log(`[STEP2_ALT] 🔧 Building transaction on frontend...`);
            
            // Setup program connection
            console.log(`[STEP2_ALT] 🔗 Setting up program connection...`);
            const provider = new AnchorProvider(connection, { publicKey: publicKey } as any, { commitment: 'confirmed' });
            const program = new Program(whiskeyIdl as Whiskeyprogram, provider);
            console.log(`[STEP2_ALT] ✅ Program connected: ${program.programId.toString()}`);

            // Generate new NFT mint keypair
            const nftMintKeypair = Keypair.generate();
            console.log(`[STEP2_ALT] 🔑 Generated NFT mint: ${nftMintKeypair.publicKey.toString()}`);

            // Derive collection config PDA
            const [collectionConfigPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("collection"), Buffer.from(displayName)],
                new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!)
            );

            // Get user's token accounts
            const userUsdcAccount = getAssociatedTokenAddressSync(
                new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!),
                publicKey
            );
            const userWhiskeyAccount = getAssociatedTokenAddressSync(
                new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!),
                publicKey
            );
            const nftTokenAccount = getAssociatedTokenAddressSync(nftMintKeypair.publicKey, publicKey);

            // Derive metadata and master edition accounts
            const [nftMetadataAccount] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
                    nftMintKeypair.publicKey.toBuffer()
                ],
                new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
            );

            const [nftMasterEditionAccount] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
                    nftMintKeypair.publicKey.toBuffer(),
                    Buffer.from("edition")
                ],
                new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
            );

            // Get treasury and vault accounts
            const capitalVault = new PublicKey("DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs");
            const treasuryWhiskeyAccount = getAssociatedTokenAddressSync(
                new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!),
                new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!)
            );

            // Create instructions array
            const instructions: TransactionInstruction[] = [];
            console.log(`[STEP2_ALT] 📋 Starting with ${instructions.length} instructions`);

            // Note: NFT token account will be created by the program itself
            // No need to manually create it as it's defined as a PDA in the IDL
            console.log(`[STEP2_ALT] ℹ️ NFT token account will be created by program (PDA): ${nftTokenAccount.toString()}`);

            // Create the mint instruction
            console.log(`[STEP2_ALT] 🏗️ Creating mint instruction...`);
            const mintInstruction = await program.methods
                .mintWithPaymentValidation(
                    nftName,
                    displaySymbol,
                    nftMetadataUri,
                    new BN(currentWhiskeyPriceUsdMicro),
                    new BN(whiskeyToTreasuryLamports),
                    new BN(usdcToVaultLamports)
                )
                .accounts({
                    user: publicKey,
                    collectionConfig: collectionConfigPda,
                    nftMint: nftMintKeypair.publicKey,
                    nftTokenAccount: nftTokenAccount,
                    nftMetadataAccount: nftMetadataAccount,
                    nftMasterEditionAccount: nftMasterEditionAccount,
                    userUsdcAccount: userUsdcAccount,
                    userWhiskeyAccount: userWhiskeyAccount,
                    capitalVault: capitalVault,
                    treasuryWhiskeyAccount: treasuryWhiskeyAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    tokenMetadataProgram: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY
                })
                .instruction();

            console.log(`[STEP2_ALT] ✅ Mint instruction created successfully`);
            instructions.push(mintInstruction);
            console.log(`[STEP2_ALT] 📋 Instructions after mint: ${instructions.length}`);

            // Add dev wallet transfer instructions (2% USDC + 3% SOL)
            const devWallet = DEV_WALLET;
            const devUsdcAccount = getAssociatedTokenAddressSync(
                new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!),
                devWallet
            );
            
            // Check if dev USDC account exists, create if needed
            const devUsdcAccountInfo = await connection.getAccountInfo(devUsdcAccount);
            if (devUsdcAccountInfo === null) {
                const createDevUsdcAtaIx = createAssociatedTokenAccountInstruction(
                    publicKey, // payer (user pays for creation)
                    devUsdcAccount, // ata
                    devWallet, // owner (dev wallet)
                    new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!) // mint
                );
                instructions.push(createDevUsdcAtaIx);
            }
            
            // Create dev USDC transfer instruction (2% to dev wallet)
            const devUsdcTransferIx = createTransferInstruction(
                userUsdcAccount, // source
                devUsdcAccount, // destination
                publicKey, // authority
                usdcToDevWalletLamports // amount
            );
            instructions.push(devUsdcTransferIx);
            
            // Create dev SOL transfer instruction (3% to dev wallet)
            const solFeePercentage = 0.03; // 3% SOL fee
            const currentSolPrice = await getCurrentSolRate();
            const mintPriceUsdValue = mintPriceUsd || 0;
            const solFeeUsd = mintPriceUsdValue * solFeePercentage;
            const solToDevWallet = solFeeUsd / currentSolPrice; // Convert USD to SOL
            const solToDevWalletLamports = Math.floor(solToDevWallet * LAMPORTS_PER_SOL);
            
            const devSolTransferIx = SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: devWallet,
                lamports: solToDevWalletLamports,
            });
            instructions.push(devSolTransferIx);
            console.log(`[STEP2_ALT] 📋 Total instructions: ${instructions.length}`);

            // Get lookup table and create versioned transaction
            const lookupTableAddress = getMintingLookupTableAddress();
            if (!lookupTableAddress) {
                throw new Error('Lookup table address not found');
            }

            const lookupTableAccount = await fetchLookupTable(connection, lookupTableAddress);
            if (!lookupTableAccount) {
                throw new Error('Failed to fetch lookup table');
            }

            // Create versioned transaction
            console.log(`[STEP2_ALT] 📦 Creating versioned transaction...`);
            const versionedTx = await createVersionedTransaction(
                connection,
                instructions,
                publicKey,
                [lookupTableAccount]
            );
            console.log(`[STEP2_ALT] ✅ Versioned transaction created`);

            // PHANTOM COMPATIBILITY: Sign with Phantom first (single signer)
            setMintMessage('Please sign the transaction...');
            console.log(`[STEP2_ALT] 📝 Requesting Phantom signature first (single signer)...`);
            
            if (!signTransaction) {
                throw new Error('Wallet does not support signTransaction');
            }
            
            // Sign with Phantom first (single signer to avoid malicious site warning)
            const phantomSignedTx = await signTransaction(versionedTx);
            console.log(`[STEP2_ALT] ✅ Phantom signature collected`);
            
            // Now add NFT mint keypair signature
            console.log(`[STEP2_ALT] ✍️ Adding NFT mint keypair signature...`);
            phantomSignedTx.sign([nftMintKeypair]);
            console.log(`[STEP2_ALT] ✅ NFT mint keypair signature added`);
            
            // Send the fully signed transaction
            console.log(`[STEP2_ALT] 📤 Sending fully signed transaction...`);
            const signature = await connection.sendRawTransaction(phantomSignedTx.serialize(), {
                maxRetries: 3,
                preflightCommitment: 'confirmed'
            });

            console.log(`[STEP2_ALT] ✅ Transaction sent: ${signature}`);
            
            // Wait for confirmation
            setMintMessage('Confirming transaction...');
            await connection.confirmTransaction(signature, 'confirmed');
            
            console.log(`[STEP2_ALT] ✅ NFT minted successfully: ${nftMintKeypair.publicKey.toString()}`);
            
            // Record the purchase in the database
            setMintMessage('Recording purchase...');
            console.log(`[STEP2_ALT] 💾 Recording purchase in database...`);
            const recordResponse = await fetch('/api/mints/mint-with-lookup-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: publicKey.toString(),
                    nftMintAddress: nftMintKeypair.publicKey.toString(),
                    collectionMintAddress: collectionOnChainAddress,
                    transactionSignature: signature
                })
            });

            if (!recordResponse.ok) {
                console.warn(`[STEP2_ALT] ⚠️ Failed to record purchase, but NFT was minted successfully`);
            } else {
                console.log(`[STEP2_ALT] ✅ Purchase recorded successfully`);
            }

            // Wait a moment for on-chain state to be fully updated
            setMintMessage('Waiting for on-chain confirmation...');
            console.log(`[STEP2_ALT] ⏳ Waiting 3 seconds for on-chain state to update...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Refresh the supply count and wallet NFT count
            setMintMessage('Refreshing collection data...');
            console.log(`[STEP2_ALT] 🔄 Refreshing collection supply and wallet NFT count...`);
            
            // Trigger a refresh of the collection data
            if (onMintSuccess) {
                console.log(`[STEP2_ALT] 📞 Calling onMintSuccess callback...`);
                onMintSuccess();
            } else {
                console.warn(`[STEP2_ALT] ⚠️ No onMintSuccess callback provided`);
            }
            
            // Also refresh the wallet NFT count for this collection
            try {
                await checkWalletNftCount();
            } catch (refreshError) {
                console.warn(`[STEP2_ALT] ⚠️ Failed to refresh wallet NFT count:`, refreshError);
            }
            
            console.log(`[STEP2_ALT] ✅ Collection data refresh triggered`);
            
        } catch (error) {
            console.error('[STEP2_ALT] Error minting NFT:', error);
            throw error;
        }
    };

    // Step 2: Mint NFT after deposit is confirmed (Legacy version)
    const handleStep2MintNft = async (): Promise<void> => {
        if (!connected || !publicKey || !signAllTransactions) {
            throw new Error('Wallet not connected');
        }

        console.log('[STEP2] Starting NFT mint...');
        console.log(`[STEP2] Using RPC endpoint: ${connection.rpcEndpoint}`);
        
        try {
            console.log('[STEP2] Setting up Anchor program...');
            
            // Setup Anchor program with proper wallet interface
            const walletInterface = {
                publicKey,
                signTransaction: signTransaction!,
                signAllTransactions: signAllTransactions!
            };
            
            const provider = new AnchorProvider(connection, walletInterface as any, {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed'
            });
            
            console.log('[STEP2] Loading program IDL...');
            const idl = await import('../lib/idl/whiskeyprogram.json');
            const program = new Program(idl as any, provider);
            console.log('[STEP2] ✅ Anchor program setup complete');

            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash('confirmed');

            // Create NFT mint keypair
            const nftMint = Keypair.generate();
            
            // Get collection config PDA
            const [collectionConfigPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("collection"), Buffer.from(displayName)],
                program.programId
            );

            // Get token account for NFT
            const nftTokenAccount = getAssociatedTokenAddressSync(nftMint.publicKey, publicKey);
            
            // Get metadata PDA
            const [nftMetadataAccount] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    nftMint.publicKey.toBuffer(),
                ],
                MPL_TOKEN_METADATA_PROGRAM_ID
            );
            
            // Get master edition PDA  
            const [nftMasterEditionAccount] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    nftMint.publicKey.toBuffer(),
                    Buffer.from("edition"),
                ],
                MPL_TOKEN_METADATA_PROGRAM_ID
            );
            
            // Create individual NFT metadata and upload to IPFS
            console.log(`[STEP2] Creating individual NFT metadata...`);
            const nftName = `${displayName} #${(displayItemsMinted || 0) + 1}`;
            const mintNumber = (displayItemsMinted || 0) + 1;
            
            let nftMetadataUri: string;
            try {
                // Ensure we have a valid collection image URL before creating metadata
                console.log(`[STEP2] Checking collection image URL:`, { imageUrl, imageLoading });
                
                // Wait for collection image to load if it's still loading
                if (imageLoading) {
                    console.log(`[STEP2] ⏳ Collection image still loading, waiting...`);
                    setMintMessage('Loading collection image...');
                    
                    // Wait up to 10 seconds for image to load
                    let waitTime = 0;
                    while (imageLoading && waitTime < 10000) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        waitTime += 500;
                        console.log(`[STEP2] Still waiting for image... (${waitTime}ms)`);
                    }
                }
                
                // Determine the NFT image URL - prioritize wallet-compatible URL for Phantom display
                let nftImageUrl = '';
                if (walletImageUrl && walletImageUrl !== '' && !walletImageUrl.includes('placeholder')) {
                    nftImageUrl = walletImageUrl;
                    console.log(`[STEP2] ✅ Using wallet-compatible image: ${nftImageUrl}`);
                } else if (imageUrl && imageUrl !== '' && imageUrl !== '/placeholder-image.svg' && !imageUrl.includes('placeholder')) {
                    nftImageUrl = imageUrl;
                    console.log(`[STEP2] ⚠️ Using display image (may not work in wallets): ${nftImageUrl}`);
                } else {
                    // Create a proper branded placeholder that won't be rejected by the API
                    nftImageUrl = `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(displayName)}`;
                    console.log(`[STEP2] ⚠️ No collection image available, using branded placeholder: ${nftImageUrl}`);
                }

                // Create individual NFT metadata using the API
                const metadataResponse = await fetch('/api/mints/create-nft-metadata', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        nftName,
                        nftSymbol: displaySymbol,
                        nftDescription: `${displayName} - Edition #${mintNumber}`,
                        nftImageUrl: nftImageUrl,
                        attributes: [
                            { trait_type: 'Edition', value: mintNumber.toString() },
                            { trait_type: 'Collection', value: displayName },
                            { trait_type: 'Type', value: 'Treasury NFT' },
                            { trait_type: 'Rarity', value: 'Legendary' },
                            { trait_type: 'Mint Timestamp', value: Date.now().toString() }
                        ],
                        collectionName: displayName,
                        collectionFamily: displayName,
                        mintNumber,
                        mintTimestamp: Date.now(),
                        creatorAddress: publicKey.toString()
                    }),
                });

                if (!metadataResponse.ok) {
                    const errorData = await metadataResponse.json().catch(() => ({}));
                    const errorMessage = errorData.message || metadataResponse.statusText || 'Image storage failed';
                    throw new Error(errorMessage);
                }

                const metadataResult = await metadataResponse.json();
                if (!metadataResult.success) {
                    throw new Error(metadataResult.message || 'Image storage failed');
                }

                nftMetadataUri = metadataResult.metadataUri;
                console.log(`[STEP2] ✅ NFT metadata created: ${nftMetadataUri}`);
            } catch (metadataError) {
                console.error('[STEP2] Error creating NFT metadata:', metadataError);
                
                // Try to get more specific error from API response
                let specificError = 'Image storage failed';
                if (metadataError?.message?.includes('storage service unavailable')) {
                    specificError = 'Image storage service unavailable';
                } else if (metadataError?.message?.includes('Network error')) {
                    specificError = 'Network error - check connection';
                } else if (metadataError?.message?.includes('timeout')) {
                    specificError = 'Upload timeout - try again';
                }
                
                throw new Error(specificError);
            }

            // Create NFT metadata for the mint instruction
            const nftMetadata = {
                name: nftName,
                symbol: displaySymbol,
                uri: nftMetadataUri
            };
            
            // Get user token accounts
            const userUsdcAccount = getAssociatedTokenAddressSync(USDC_MINT, publicKey);
            const userWhiskeyAccount = getAssociatedTokenAddressSync(new PublicKey(WHISKEY_MINT), publicKey);
            
            console.log(`[STEP2] User token accounts:`);
            console.log(`  - USDC account: ${userUsdcAccount.toString()}`);
            console.log(`  - WHISKEY account: ${userWhiskeyAccount.toString()}`);
            
            // Check if token accounts exist
            const [usdcAccountInfo, whiskeyAccountInfo] = await Promise.all([
                connection.getAccountInfo(userUsdcAccount),
                connection.getAccountInfo(userWhiskeyAccount)
            ]);
            
            console.log(`[STEP2] Token account status:`);
            console.log(`  - USDC account exists: ${usdcAccountInfo !== null}`);
            console.log(`  - WHISKEY account exists: ${whiskeyAccountInfo !== null}`);
            
            // Get treasury whiskey account
            const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
            const treasuryWhiskeyAccount = getAssociatedTokenAddressSync(new PublicKey(WHISKEY_MINT), treasuryWallet);
            
            // Hardcoded capital vault from program
            const capitalVault = new PublicKey("DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs");
            
            // Calculate payment amounts
            const whiskeyRate = await getCurrentWhiskeyRate();
            const lendingShareBps = 8000; // 80% to lending
            const devFeePercentage = 0.02; // 2% dev fee
            const treasuryShareBps = 2000; // 20% to treasury (unchanged)
            
            const lendingPercentage = lendingShareBps / 10000;
            const treasuryPercentage = treasuryShareBps / 10000;
            
            const whiskeyToTreasury = displayMintPriceWhiskeyTokens * treasuryPercentage;
            const usdcToVault = (mintPriceUsd || 0) * lendingPercentage;
            const usdcToDevWallet = (mintPriceUsd || 0) * devFeePercentage;
            
            // Convert to lamports/micro-units
            const whiskeyToTreasuryLamports = Math.floor(whiskeyToTreasury * 1000000); // WHISKEY has 6 decimals
            const usdcToVaultLamports = Math.floor(usdcToVault * 1000000); // USDC has 6 decimals
            const usdcToDevWalletLamports = Math.floor(usdcToDevWallet * 1000000); // USDC has 6 decimals
            const currentWhiskeyPriceUsdMicro = Math.floor(whiskeyRate * 1000000); // Price in micro-USD
            
            console.log(`[STEP2] Payment calculation:`);
            console.log(`  - WHISKEY to treasury: ${whiskeyToTreasury} tokens (${whiskeyToTreasuryLamports} lamports)`);
            console.log(`  - USDC to vault: ${usdcToVault} USDC (${usdcToVaultLamports} lamports)`);
            console.log(`  - USDC to dev wallet: ${usdcToDevWallet} USDC (${usdcToDevWalletLamports} lamports)`);
            console.log(`  - Current WHISKEY price: $${whiskeyRate} (${currentWhiskeyPriceUsdMicro} micro-USD)`);

            // Create secure mint instruction using new function
            // Convert numbers to BN for proper Anchor serialization (use BN directly like API)
            const currentWhiskeyPriceUsdMicroBN = new BN(currentWhiskeyPriceUsdMicro);
            const whiskeyToTreasuryLamportsBN = new BN(whiskeyToTreasuryLamports);
            const usdcToVaultLamportsBN = new BN(usdcToVaultLamports);
            
            console.log(`[STEP2] BN conversion complete:`);
            console.log(`  - currentWhiskeyPriceUsdMicroBN: ${currentWhiskeyPriceUsdMicroBN.toString()}`);
            console.log(`  - whiskeyToTreasuryLamportsBN: ${whiskeyToTreasuryLamportsBN.toString()}`);
            console.log(`  - usdcToVaultLamportsBN: ${usdcToVaultLamportsBN.toString()}`);
            
            const mintInstruction = await program.methods
            .mintWithPaymentValidation(
                nftMetadata.name,
                nftMetadata.symbol,
                nftMetadata.uri,
                currentWhiskeyPriceUsdMicroBN,
                whiskeyToTreasuryLamportsBN,
                usdcToVaultLamportsBN
            )
            .accounts({
                user: publicKey,
                    collectionConfig: collectionConfigPda,
                nftMint: nftMint.publicKey,
                nftTokenAccount,
                nftMetadataAccount,
                nftMasterEditionAccount,
                userUsdcAccount,
                userWhiskeyAccount,
                capitalVault,
                treasuryWhiskeyAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction();
            
            // Create and send mint transaction
            const mintTransaction = new Transaction();
            
            // Add ATA creation instructions if accounts don't exist
            if (usdcAccountInfo === null) {
                console.log(`[STEP2] Creating USDC ATA for user...`);
                const createUsdcAtaIx = createAssociatedTokenAccountInstruction(
                    publicKey, // payer
                    userUsdcAccount, // ata
                    publicKey, // owner
                    USDC_MINT // mint
                );
                mintTransaction.add(createUsdcAtaIx);
            }
            
            if (whiskeyAccountInfo === null) {
                console.log(`[STEP2] Creating WHISKEY ATA for user...`);
                const createWhiskeyAtaIx = createAssociatedTokenAccountInstruction(
                    publicKey, // payer
                    userWhiskeyAccount, // ata
                    publicKey, // owner
                    new PublicKey(WHISKEY_MINT) // mint
                );
                mintTransaction.add(createWhiskeyAtaIx);
            }
            
            // Add dev fee transfer instructions (2% USDC + 3% SOL)
            const devWallet = DEV_WALLET;
            const devUsdcAccount = getAssociatedTokenAddressSync(USDC_MINT, devWallet);
            
            // Check if dev USDC account exists, create if not
            const devUsdcAccountInfo = await connection.getAccountInfo(devUsdcAccount);
            if (devUsdcAccountInfo === null) {
                const createDevUsdcAtaIx = createAssociatedTokenAccountInstruction(
                    publicKey, // payer (user pays for creation)
                    devUsdcAccount, // ata
                    devWallet, // owner (dev wallet)
                    USDC_MINT // mint
                );
                mintTransaction.add(createDevUsdcAtaIx);
            }
            
            // Add the mint instruction first
            mintTransaction.add(mintInstruction);
            
            // Create dev USDC transfer instruction (2% to dev wallet)
            const devUsdcTransferIx = createTransferInstruction(
                userUsdcAccount, // source
                devUsdcAccount, // destination
                publicKey, // authority
                usdcToDevWalletLamports // amount
            );
            mintTransaction.add(devUsdcTransferIx);
            
            // Create dev SOL transfer instruction (3% to dev wallet)
            const solFeePercentage = 0.03; // 3% SOL fee
            const currentSolPrice = await getCurrentSolRate();
            const mintPriceUsdValue = mintPriceUsd || 0;
            const solFeeUsd = mintPriceUsdValue * solFeePercentage;
            const solToDevWallet = solFeeUsd / currentSolPrice; // Convert USD to SOL
            const solToDevWalletLamports = Math.floor(solToDevWallet * LAMPORTS_PER_SOL);
            
            const devSolTransferIx = SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: devWallet,
                lamports: solToDevWalletLamports,
            });
            mintTransaction.add(devSolTransferIx);
            mintTransaction.feePayer = publicKey;
            mintTransaction.recentBlockhash = blockhash;
            
            // Log transaction details BEFORE signing
            console.log(`[STEP2] NFT Mint transaction created (Legacy, ${mintTransaction.instructions.length} instructions)`);
            
            // Log instruction breakdown for detailed analysis
            console.log(`[STEP2] Transaction instruction breakdown:`);
            mintTransaction.instructions.forEach((ix, index) => {
                console.log(`  Instruction ${index + 1}: Program ${ix.programId.toString()}, ${ix.keys.length} accounts, ${ix.data.length} data bytes`);
            });
            
            // Log all signers required for this transaction
            console.log(`[STEP2] Transaction signers required:`);
            mintTransaction.instructions.forEach(ix => {
                ix.keys.forEach((key, index) => {
                    if (key.isSigner) {
                        console.log(`  Signer ${index + 1}: ${key.pubkey.toString()} (${key.pubkey.equals(publicKey) ? 'USER' : key.pubkey.equals(nftMint.publicKey) ? 'NFT_MINT' : 'UNKNOWN'})`);
                    }
                });
            });
            
            // Sign with NFT mint keypair first
            console.log(`[STEP2] Signing transaction with NFT mint keypair: ${nftMint.publicKey.toString()}`);
            mintTransaction.partialSign(nftMint);
            console.log(`[STEP2] ✅ NFT mint keypair signature added`);
            
            // Now request wallet signature
            console.log(`[STEP2] Requesting wallet signature for transaction...`);
            console.log(`[STEP2] Wallet connected: ${connected}`);
            console.log(`[STEP2] Public key: ${publicKey?.toString()}`);
            console.log(`[STEP2] signTransaction available: ${!!signTransaction}`);
            
            if (!signTransaction) {
                throw new Error('Wallet signTransaction method not available');
            }
            
            const signedMintTx = await signTransaction(mintTransaction);
            console.log(`[STEP2] ✅ Transaction signed by wallet`);
            
            // Log final transaction size
            const finalSerialized = signedMintTx.serialize();
            console.log(`[STEP2] Final signed transaction size: ${finalSerialized.length} bytes`);
            
            if (finalSerialized.length > 1000) {
                console.warn(`[STEP2] ⚠️ NFT mint transaction is large: ${finalSerialized.length} bytes (limit: ~1232 bytes)`);
            }
            
                console.log(`[STEP2] Submitting mint transaction (${finalSerialized.length} bytes) to Helius...`);
                const signature = await connection.sendRawTransaction(signedMintTx.serialize());
                
                console.log(`[STEP2] Mint transaction sent: ${signature}`);
                console.log('[STEP2] Waiting for mint confirmation...');
                await connection.confirmTransaction(signature, 'confirmed');
                console.log('[STEP2] ✅ NFT mint transaction confirmed!');
                
                // 🔍 VALIDATE MINT: Check if on-chain metadata was created properly
                console.log('[STEP2] 🔍 Validating mint completed properly...');
                setMintMessage('Validating NFT creation...');
                
                try {
                    // Check if the metadata account exists
                    const metadataAccountInfo = await connection.getAccountInfo(nftMetadataAccount);
                    
                    if (!metadataAccountInfo) {
                        console.error(`[STEP2] ❌ MINT VALIDATION FAILED: Metadata account not created`);
                        console.error(`[STEP2] Expected metadata PDA: ${nftMetadataAccount.toString()}`);
                        console.error(`[STEP2] NFT mint: ${nftMint.publicKey.toString()}`);
                        
                        throw new Error('NFT was created but metadata account is missing. This NFT cannot be used for lending. Please contact support.');
                    }
                    
                    console.log(`[STEP2] ✅ Metadata account verified: ${metadataAccountInfo.data.length} bytes`);
                    
                    // Try to verify with Metaplex as well
                    try {
                        const { Metaplex } = await import('@metaplex-foundation/js');
                        const metaplex = Metaplex.make(connection);
                        const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint.publicKey });
                        
                        console.log(`[STEP2] ✅ Metaplex validation passed:`, {
                            name: nft.name,
                            uri: nft.uri,
                            hasCollection: !!nft.collection
                        });
                        
                    } catch (metaplexError) {
                        console.warn(`[STEP2] ⚠️ Metaplex validation failed but metadata account exists:`, metaplexError);
                        // Continue anyway since the account exists
                    }
                    
                    console.log('[STEP2] 🎉 MINT VALIDATION PASSED: NFT created successfully and can be used for lending!');
                    
                } catch (validationError) {
                    console.error('[STEP2] ❌ MINT VALIDATION FAILED:', validationError);
                    
                    // Show specific error message about broken NFT
                    setMintMessage('⚠️ NFT created but incomplete - cannot be used for lending. Please try minting again.');
                    
                    // Keep the popup open for user to see the warning
                    setTimeout(() => {
                        setShowSuccessPopup(false);
                        setIsMinting(false);
                        setStep1Complete(false);
                        setStep2Complete(false);
                        setMintMessage('');
                    }, 10000); // Show warning for 10 seconds
                    
                    return; // Don't proceed to success
                }
                
            } catch (error) {
                console.error('[STEP2] Error minting NFT:', error);
                throw error;
            }
    };

   

    // 🥃 ULTRA SIMPLE: Whiskey-Gated Minting (Just creates metadata, no program calls)
    const handleNewWhiskeyGatedMint = async () => {
        if (!publicKey || !sendTransaction) {
            console.error('[NEW-WHISKEY-GATED] No wallet connected or sendTransaction not supported');
            setIsMinting(false);
            return;
        }

        try {
        setIsMinting(true);
            setMintMessage('🥃 Starting whiskey-gated NFT mint...');
            console.log('[WHISKEY-GATED] 🥃 Starting whiskey-gated NFT minting process...');
            console.log('[WHISKEY-GATED] Collection:', displayName);
            console.log('[WHISKEY-GATED] Required WHISKEY:', requiredWhiskeyAmount);

            // Create NFT metadata first
            const nftName = `${displayName} #${(displayItemsMinted || 0) + 1}`;
            const displaySymbol = symbol || 'NFT';

            setMintMessage('📝 Creating NFT metadata...');
            console.log('[NEW-WHISKEY-GATED] 📝 Creating NFT metadata...');
            // Use the wallet-compatible image URL for NFT metadata
            const nftImageUrl = walletImageUrl || imageUrl || `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(displayName)}`;
            console.log('[NEW-WHISKEY-GATED] 🖼️ Using NFT image URL:', nftImageUrl);
            
            const metadataResponse = await fetch('/api/mints/create-nft-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nftName,
                    nftSymbol: displaySymbol,
                    nftDescription: `A unique NFT from the ${displayName} collection`,
                    nftImageUrl: nftImageUrl, // This was missing!
                    attributes: [
                        { trait_type: 'Edition', value: ((displayItemsMinted || 0) + 1).toString() },
                        { trait_type: 'Collection', value: displayName },
                        { trait_type: 'Type', value: 'Whiskey-Gated NFT' },
                        { trait_type: 'Rarity', value: 'Exclusive' },
                        { trait_type: 'Required WHISKEY', value: requiredWhiskeyAmount?.toString() || '0' },
                        { trait_type: 'Mint Timestamp', value: Date.now().toString() }
                    ],
                    collectionName: displayName,
                    collectionFamily: displayName,
                    mintNumber: (displayItemsMinted || 0) + 1,
                    mintTimestamp: Date.now(),
                    creatorAddress: publicKey.toString()
                })
            });

            if (!metadataResponse.ok) {
                const errorData = await metadataResponse.json();
                throw new Error(`Metadata creation failed: ${errorData.error || 'Unknown error'}`);
            }

            const metadataResult = await metadataResponse.json();
            console.log('[NEW-WHISKEY-GATED] 📋 Full metadata response:', metadataResult);
            
            const { nftMetadataUri, metadataUri } = metadataResult;
            const actualMetadataUri = nftMetadataUri || metadataUri;
            
            if (!actualMetadataUri) {
                console.warn('[NEW-WHISKEY-GATED] ⚠️ Metadata creation returned undefined, using fallback URI');
                // Use a simple fallback metadata URI
                const fallbackUri = `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(nftName)}`;
                console.log('[NEW-WHISKEY-GATED] 🔄 Using fallback metadata URI:', fallbackUri);
            } else {
                console.log('[NEW-WHISKEY-GATED] ✅ NFT metadata created:', actualMetadataUri);
            }

            // Setup program connection (same method as regular mint)
            setMintMessage('🔄 Setting up program connection...');
            console.log('[NEW-WHISKEY-GATED] 🔄 Setting up program connection...');
            const connection = getSolanaConnection();
            const provider = new AnchorProvider(connection, { publicKey: publicKey } as any, { commitment: 'confirmed' });
            
            // Use DYNAMIC import like regular mint does
            console.log('[NEW-WHISKEY-GATED] Loading program IDL...');
            const idl = await import('../lib/idl/whiskeyprogram.json');
            const program = new Program(idl as any, provider);
            console.log('[NEW-WHISKEY-GATED] ✅ Program initialized with ID:', program.programId.toString());
            
            // Verify environment program ID matches
            const expectedProgramId = process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID;
            console.log('[NEW-WHISKEY-GATED] 🔧 Environment program ID:', expectedProgramId);
            console.log('[NEW-WHISKEY-GATED] 🔧 Actual program ID:', program.programId.toString());
            if (expectedProgramId !== program.programId.toString()) {
                console.warn('[NEW-WHISKEY-GATED] ⚠️ Program ID mismatch!');
            }

            // Build transaction (same as regular mint)
            setMintMessage('🔧 Building transaction...');
            console.log('[WHISKEY-GATED] 🔧 Building whiskey-gated transaction...');

            // Create NFT mint keypair
                const nftMint = Keypair.generate();
            console.log('[WHISKEY-GATED] 🔑 Generated NFT mint:', nftMint.publicKey.toString());

            // Get token account for NFT
                const nftTokenAccount = getAssociatedTokenAddressSync(nftMint.publicKey, publicKey);

            // Note: NFT token account will be created by the program itself
            // No need to manually create it as it's defined as a PDA in the IDL
            console.log('[NEW-WHISKEY-GATED] ℹ️ NFT token account will be created by program (PDA):', nftTokenAccount.toString());

                // Get metadata PDA
                const [nftMetadataAccount] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("metadata"),
                        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                        nftMint.publicKey.toBuffer(),
                    ],
                    MPL_TOKEN_METADATA_PROGRAM_ID
                );

                // Get master edition PDA
                const [nftMasterEditionAccount] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from("metadata"),
                        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                        nftMint.publicKey.toBuffer(),
                        Buffer.from("edition"),
                    ],
                    MPL_TOKEN_METADATA_PROGRAM_ID
                );

            // Get user's WHISKEY account
            const userWhiskeyAccount = getAssociatedTokenAddressSync(
                new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!),
                publicKey
            );

            // Get correct vault addresses (same as regular mint)
            const capitalVault = new PublicKey("DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs");
            const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
            const treasuryWhiskeyAccount = getAssociatedTokenAddressSync(
                new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!),
                treasuryWallet
            );

            // Get collection config PDA (same as regular mint)
            const [collectionConfigPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("collection"), Buffer.from(displayName)],
                program.programId
            );
            console.log('[WHISKEY-GATED] 🔑 Collection config PDA:', collectionConfigPda.toString());

            // Get collection mint address from collection config
            const collectionMintAddress = new PublicKey(collectionOnChainAddress);
            
            // Get wallet counter PDA for whiskey-gated minting
            const [walletNftCounterPda, walletNftCounterBump] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("wallet_counter"),
                    publicKey.toBuffer(),
                    collectionMintAddress.toBuffer()
                ],
                program.programId
            );
            console.log('[WHISKEY-GATED] 🔑 Wallet counter PDA:', walletNftCounterPda.toString());
            console.log('[WHISKEY-GATED] 🔑 Wallet counter bump:', walletNftCounterBump);
            
            // Use mintWithPaymentValidation with zero payments (bypasses wallet counter issues)
            console.log('[WHISKEY-GATED] 🔧 Creating mint instruction with zero payment...');
            
            if (!actualMetadataUri) {
                throw new Error('Metadata URI is required but not provided');
            }
            
            const finalMetadataUri = actualMetadataUri;
            console.log('[NEW-WHISKEY-GATED] 🔧 Using metadata URI:', finalMetadataUri);
            
                const mintInstruction = await program.methods
                    .mintWithPaymentValidation(
                        nftName,
                        displaySymbol,
                    finalMetadataUri,
                    new BN(0), // current_whiskey_price_usd = 0
                    new BN(0), // whiskey_to_treasury_amount = 0
                    new BN(0)  // usdc_to_vault_amount = 0
                    )
                    .accounts({
                        user: publicKey,
                        collectionConfig: collectionConfigPda,
                        nftMint: nftMint.publicKey,
                    nftTokenAccount,
                    nftMetadataAccount,
                    nftMasterEditionAccount,
                    userUsdcAccount: userWhiskeyAccount, // Use WHISKEY account as placeholder
                    userWhiskeyAccount,
                    capitalVault,
                    treasuryWhiskeyAccount,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        rent: SYSVAR_RENT_PUBKEY,
                    })
                    .instruction();

            // Create and send mint transaction (same as regular mint)
            const mintTransaction = new Transaction();
            mintTransaction.add(mintInstruction);
            
            const { blockhash: recentBlockhash } = await connection.getLatestBlockhash('confirmed');
            mintTransaction.recentBlockhash = recentBlockhash;
            mintTransaction.feePayer = publicKey;

            // PHANTOM COMPATIBILITY: Sign with Phantom first (single signer)
            setMintMessage('📝 Requesting wallet signature...');
            console.log('[NEW-WHISKEY-GATED] 📝 Requesting Phantom signature first (single signer)...');
            
            if (!signTransaction) {
                throw new Error('Wallet does not support signTransaction');
            }
            
            // Sign with Phantom first (single signer to avoid malicious site warning)
            const phantomSignedTx = await signTransaction(mintTransaction);
            console.log('[NEW-WHISKEY-GATED] ✅ Phantom signature collected');
            
            // Now add NFT mint keypair signature
            console.log('[NEW-WHISKEY-GATED] ✍️ Adding NFT mint keypair signature...');
            phantomSignedTx.partialSign(nftMint);
            console.log('[NEW-WHISKEY-GATED] ✅ NFT mint keypair signature added');
            
            // Send the fully signed transaction
            console.log('[NEW-WHISKEY-GATED] 📤 Sending fully signed transaction...');
            const signature = await connection.sendRawTransaction(phantomSignedTx.serialize(), {
                maxRetries: 3,
                        preflightCommitment: 'confirmed'
                    });

            setMintMessage('⏳ Confirming transaction...');
            console.log('[NEW-WHISKEY-GATED] ⏳ Confirming transaction...');
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');

            // Check if the transaction actually succeeded
            if (confirmation.value.err) {
                console.error('[NEW-WHISKEY-GATED] ❌ Transaction failed:', confirmation.value.err);
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            console.log('[NEW-WHISKEY-GATED] ✅ Transaction confirmed and succeeded:', signature);

            // Verify the NFT was actually minted by checking if the mint account exists
            setMintMessage('🔍 Verifying NFT was minted...');
            console.log('[NEW-WHISKEY-GATED] 🔍 Verifying NFT was minted...');
            const mintAccountInfo = await connection.getAccountInfo(nftMint.publicKey);
            if (!mintAccountInfo) {
                throw new Error('NFT mint account was not created - transaction may have failed');
            }
            console.log('[NEW-WHISKEY-GATED] ✅ NFT mint account verified');

            // Only record the purchase if the transaction actually succeeded
            setMintMessage('💾 Recording purchase...');
            console.log('[NEW-WHISKEY-GATED] 💾 Recording purchase in database...');
            const recordResponse = await fetch('/api/mints/record-purchase', {
                    method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        walletAddress: publicKey.toString(),
                    nftMintAddress: nftMint.publicKey.toString(),
                    collectionMintAddress: collectionConfigPda.toString(),
                            transactionSignature: signature
                })
            });

            if (!recordResponse.ok) {
                console.warn('[NEW-WHISKEY-GATED] ⚠️ Failed to record purchase, but NFT was minted successfully');
            } else {
                console.log('[NEW-WHISKEY-GATED] ✅ Purchase recorded successfully');
            }

            setMintMessage('🎉 Whiskey-gated NFT minted successfully!');
            console.log('[NEW-WHISKEY-GATED] 🎉 NEW Whiskey-gated NFT minted successfully!');
            setIsMinting(false);
            if (onMintSuccess) onMintSuccess();

        } catch (error: any) {
            console.error('[NEW-WHISKEY-GATED] Error:', error);
            setIsMinting(false);
            
            let errorMessage = 'Failed to mint whiskey-gated NFT';
            if (error.message?.includes('Insufficient WHISKEY balance') || error.message?.includes('InsufficientWhiskeyBalance')) {
                errorMessage = `Insufficient WHISKEY balance. You need ${requiredWhiskeyAmount} WHISKEY tokens to mint.`;
            } else if (error.message?.includes('already minted') || error.message?.includes('WalletNftLimitExceeded') || error.message?.includes('WhiskeyGatedCollectionLimitExceeded')) {
                errorMessage = 'You have already minted from this whiskey-gated collection. Only 1 NFT per wallet allowed.';
            } else if (error.message?.includes('NotWhiskeyGated')) {
                errorMessage = 'This collection is not whiskey-gated.';
            } else if (error.message?.includes('Transaction failed')) {
                errorMessage = 'Transaction failed. Please try again.';
            } else if (error.message?.includes('Metadata creation failed')) {
                errorMessage = error.message;
            } else if (error.message?.includes('wallet_counter') || error.message?.includes('WalletNftCounter')) {
                errorMessage = 'Wallet counter account issue. Please try again or contact support.';
            } else if (error.message?.includes('AccountNotInitialized') || error.message?.includes('InvalidAccountData')) {
                errorMessage = 'Account initialization issue. Please try again.';
            }
            
            setMintMessage(`❌ ${errorMessage}`);
        }
    };

    // Legacy function for backwards compatibility (now simplified)

    // New handler for Step 1: Swap & Deposit (REGULAR COLLECTIONS ONLY)
    const handleStep1 = async () => {
        // Pre-mint validation
        if (!connected || !publicKey) {
            setMintMessage('❌ Please connect your wallet first');
            return;
        }

        // This function should ONLY be called for regular (non-whiskey-gated) collections
        if (isWhiskeyGated) {
            setMintMessage('❌ This function is only for regular collections. Use whiskey-gated mint instead.');
            return;
        }

        // Check SOL balance for transaction fees
        if (userSolBalance < 0.04) {
            setMintMessage(`❌ Insufficient SOL balance. Need at least 0.04 SOL for transaction fees`);
            return;
        }

        // Check WHISKEY balance for swap (regular collections need WHISKEY to swap to USDC)
        if (userWhiskeyBalance < displayMintPriceWhiskeyTokens) {
            setMintMessage(`❌ Insufficient WHISKEY balance. Need ${displayMintPriceWhiskeyTokens.toFixed(6)} WHISKEY to swap for minting`);
            return;
        }

        // Check wallet NFT limit (max 5 per collection for regular collections)
        if (walletNftCount >= 5) {
            setMintMessage('❌ Wallet limit reached (5 NFTs max per collection)');
            return;
        }

        // Check collection limit
        if (displayItemsMinted >= displayItemLimit) {
            setMintMessage('❌ Collection is sold out');
            return;
        }

            setIsMinting(true);
        setMintMessage('🔄 Step 1: Swapping WHISKEY to USDC and depositing to vault...');
        
        try {
            await handleStep1SwapAndDeposit();
            setStep1Complete(true);
            setShowSuccessPopup(true);
            setMintMessage('✅ Step 1 Complete: USDC deposited to vault! Mint your NFT now to complete the process.');
        } catch (error) {
            console.error('Step 1 failed:', error);
            
            // Create user-friendly error message
            let userMessage = 'Step 1 failed: ';
            const errorStr = error?.toString() || '';
            
            if (errorStr.includes('Insufficient funds') || errorStr.includes('insufficient funds') || errorStr.includes('InsufficientFunds')) {
                userMessage += 'Not enough SOL. Add more SOL to your wallet.';
            } else if (errorStr.includes('Insufficient balance') || errorStr.includes('insufficient balance') || errorStr.includes('InsufficientBalance')) {
                userMessage += 'Not enough WHISKEY tokens. Get more WHISKEY to mint.';
            } else if (errorStr.includes('User rejected') || errorStr.includes('user rejected') || errorStr.includes('User cancelled')) {
                userMessage += 'You cancelled the transaction.';
            } else if (errorStr.includes('Network') || errorStr.includes('network') || errorStr.includes('RPC')) {
                userMessage += 'Internet problem. Try again.';
            } else if (errorStr.includes('Slippage') || errorStr.includes('slippage')) {
                userMessage += 'Price changed too fast. Try again.';
            } else {
                userMessage += 'Something went wrong. Try again.';
            }
            
            setMintMessage(`❌ ${userMessage}`);
        } finally {
            setIsMinting(false);
        }
    };

    // New handler for Step 2: Mint NFT
    const handleStep2 = async () => {
        if (!step1Complete) {
            setMintMessage('❌ Please complete Step 1 first');
            return;
        }
        
        setIsMinting(true);
        setMintMessage('🔄 Step 2: Minting your NFT...');
        
        try {
            await handleStep2MintNftWithLookupTable();
            setStep2Complete(true);
            setMintMessage('🎉 Success! Your NFT has been minted and the vault deposit is complete!');
            
            // Only close popup on success
            setTimeout(() => {
                setShowSuccessPopup(false);
            }, 3000); // Show success message for 3 seconds before closing
            
            // Trigger success callback
            if (onMintSuccess) {
                onMintSuccess();
            }
        } catch (error) {
            console.error('Step 2 failed:', error);
            
            // Create user-friendly error message
            let userMessage = 'Step 2 failed: ';
            const errorStr = error?.message || error?.toString() || '';
            
            if (errorStr.includes('Insufficient funds') || errorStr.includes('insufficient funds') || errorStr.includes('InsufficientFunds')) {
                userMessage += 'Not enough SOL. Add more SOL to your wallet.';
            } else if (errorStr.includes('User rejected') || errorStr.includes('user rejected') || errorStr.includes('User cancelled')) {
                userMessage += 'You cancelled the transaction.';
            } else if (errorStr.includes('Collection is full') || errorStr.includes('collection is full')) {
                userMessage += 'SOLD OUT!';
            } else if (errorStr.includes('usage limits') || errorStr.includes('Account blocked')) {
                userMessage += 'Minting temporarily unavailable due to storage limits. Please try again later.';
            } else if (errorStr.includes('Image storage service not configured') || errorStr.includes('storage service unavailable')) {
                userMessage += 'Image storage service unavailable. Please try again later.';
            } else if (errorStr.includes('Image storage failed')) {
                userMessage += 'Image storage failed. Try again in a moment.';
            } else if (errorStr.includes('Network error') || errorStr.includes('network') || errorStr.includes('RPC')) {
                userMessage += 'Internet problem. Try again.';
            } else if (errorStr.includes('Upload timeout') || errorStr.includes('timeout')) {
                userMessage += 'Upload took too long. Try again.';
            } else if (errorStr.includes('Wallet has reached the maximum NFT limit') || errorStr.includes('limit exceeded')) {
                userMessage += 'You already have 5 NFTs from this collection.';
            } else if (errorStr.includes('Missing required metadata fields') || errorStr.includes('nftImageUrl are required')) {
                userMessage += 'Collection image not available. Please contact support.';
            } else if (errorStr.includes('No collection image available')) {
                userMessage += 'Collection image required. Please upload an image for this collection.';
            } else if (errorStr.includes('Failed to create NFT metadata')) {
                userMessage += 'Failed to create NFT metadata. Please try again.';
            } else {
                userMessage += 'Something went wrong. Try again.';
            }
            
            setMintMessage(`❌ ${userMessage} Click "Mint NFT" to retry.`);
            // Keep popup open on failure - don't call setShowSuccessPopup(false)
        } finally {
            setIsMinting(false);
        }
    };

    // Legacy handler - now just calls Step 1
    const handleMint = async () => {
        handleStep1();
    };

    const supplyRemaining = displayItemLimit - displayItemsMinted;

    return (
        <div className="group relative bg-slate-900/50 backdrop-blur-xl border border-amber-700/30 rounded-3xl shadow-2xl hover:shadow-amber-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden">
            <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
                {/* Image Aspect Ratio Container */}
                <div className="aspect-w-1 aspect-h-1 w-full h-full">
                    <MediaWithFallback 
                        src={imageUrl}
                        alt={`${displayName} Collection`}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        autoPlay={true}
                        loop={true}
                        muted={true}
                        controls={false}
                    />
                </div>
                </div>

            {/* Collection Info */}
            <div className="flex-1 p-6 space-y-4">
                {/* Header */}
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white truncate">
                        {displayName}
                    </h3>
                    <p className="text-sm text-amber-400 font-medium">
                        {displaySymbol}
                    </p>
                </div>

                {/* Price & Stats */}
                <div className="space-y-3">
                    {isWhiskeyGated ? (
                                <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-amber-400 text-sm font-medium">Master Distiller Collection</span>
                                <span className="text-xs bg-amber-900/20 text-amber-400 px-2 py-1 rounded-full border border-amber-700/40">
                                    🥃 WHISKEY GATED
                                </span>
                                    </div>
                            <div className="text-white">
                                <p className="text-lg font-bold">
                                    {requiredWhiskeyAmount?.toLocaleString()} WHISKEY Required
                                </p>
                                <p className="text-xs text-slate-400">
                                    Must hold tokens to mint • 1 NFT per wallet
                                    </p>
                                </div>
                        </div>
                    ) : (
                            <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-amber-400 text-sm font-medium">Mint Price</span>
                                <div className="text-right">
                                    {whiskeyPriceData && (
                                        <div className="text-xs text-slate-400">
                                            ${whiskeyPriceData.usd.toFixed(4)} 
                                            <span className={`ml-1 ${getPriceChangeColor(whiskeyPriceData.usd_24h_change)}`}>
                                                {formatPercentageChange(whiskeyPriceData.usd_24h_change)}
                                    </span>
                                </div>
                                    )}
                                        </div>
                                                        </div>
                            <div className="text-white">
                                <p className="text-2xl font-bold">
                                    {priceLoadingState || !whiskeyRate || displayMintPriceWhiskeyTokens === 0 ? (
                                        <span className="text-slate-400">Loading... WHISKEY</span>
                                    ) : (
                                        `${formatWhiskeyTokens(displayMintPriceWhiskeyTokens)} WHISKEY`
                                    )}
                                </p>
                                {mintPriceUsd && (
                                    <p className="text-sm text-slate-400">
                                        ≈ ${formatUsdAmount(mintPriceUsd)}
                                    </p>
                                                )}
                                            </div>
                                    </div>
                                )}

                    {/* Supply Info */}
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Supply</span>
                        <span className="text-white font-medium">
                            {displayItemsMinted.toLocaleString()} / {displayItemLimit.toLocaleString()}
                        </span>
                            </div>

                    {/* User's Mint Count */}
                    {connected && publicKey && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Your NFTs</span>
                            <span className="text-amber-400 font-medium">
                                {walletNftCount} / {isWhiskeyGated ? '1' : '5'} 
                                <span className="text-xs text-slate-500 ml-1">
                                    ({isWhiskeyGated ? 'whiskey-gated limit' : 'wallet limit'})
                                </span>
                            </span>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-amber-500 to-amber-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((displayItemsMinted / displayItemLimit) * 100, 100)}%` }}
                        />
                        </div>

                    <div className="text-center">
                        <span className="text-xs text-slate-400">
                            {supplyRemaining > 0 ? `${supplyRemaining.toLocaleString()} remaining` : 'SOLD OUT'}
                        </span>
                    </div>
                </div>
                
                {/* Whiskey-Gated Warning - Only show for whiskey-gated collections */}
                {isWhiskeyGated && (
                    <div className="bg-red-600/20 border-2 border-red-500 rounded-xl p-4 mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <h3 className="text-red-400 font-bold text-lg">⚠️ WHISKEY GATED COLLECTION</h3>
                        </div>
                        <div className="text-red-300 font-semibold text-base leading-relaxed">
                            <p className="mb-2">
                                🥃 <span className="text-red-200 font-bold text-xl">{requiredWhiskeyAmount?.toLocaleString() || 0} WHISKEY</span> tokens required to mint
                            </p>
                            <p className="mb-2">
                                ⚡ <span className="text-red-200 font-bold text-xl">0.03 SOL</span> required for transaction fees
                            </p>
                            <p className="text-sm text-red-400">
                                • You must HOLD the required WHISKEY amount (not spend it)
                            </p>
                            <p className="text-sm text-red-400">
                                • Only 1 NFT per wallet allowed
                            </p>
                            <p className="text-sm text-red-400">
                                • Minting is FREE if you meet the requirements
                            </p>
                            <p className="text-sm text-red-400">
                                • SOL is only used for blockchain transaction fees
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Mint Button */}
                <div className="space-y-2">
                    {!connected || !publicKey ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-slate-700 text-slate-400 rounded-xl font-bold cursor-not-allowed"
                        >
                            Connect Wallet to Mint
                        </button>
                    ) : supplyRemaining <= 0 ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-slate-700 text-slate-400 rounded-xl font-bold cursor-not-allowed"
                        >
                            SOLD OUT
                        </button>
                    ) : isWhiskeyGated && walletNftCount >= 1 ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            You already minted from this collection (1 max for whiskey-gated)
                        </button>
                    ) : !isWhiskeyGated && walletNftCount >= 5 ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            Maximum 5 NFTs per wallet reached
                        </button>
                    ) : whiskeyBalanceLoading ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-amber-800/50 text-amber-400 rounded-xl font-bold cursor-not-allowed border border-amber-700/50"
                        >
                            Loading WHISKEY Balance...
                        </button>
                    ) : userWhiskeyBalance === 0 ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            Need WHISKEY to {isWhiskeyGated ? 'Hold' : 'Swap'}
                        </button>
                    ) : isWhiskeyGated && (!requiredWhiskeyAmount || userWhiskeyBalance < requiredWhiskeyAmount) ? (
                        // Whiskey-gated collections: Check if user has required WHISKEY holdings
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            Need {requiredWhiskeyAmount?.toLocaleString() || 0} WHISKEY to Hold
                        </button>
                    ) : !isWhiskeyGated && displayMintPriceWhiskeyTokens > 0 && userWhiskeyBalance < displayMintPriceWhiskeyTokens ? (
                        // Regular collections: Check if user has enough WHISKEY to swap
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            Need {formatWhiskeyTokens(displayMintPriceWhiskeyTokens)} WHISKEY to Swap
                        </button>
                    ) : !isWhiskeyGated && userSolBalance < 0.04 ? (
                        // Regular collections: Check if user has enough SOL for transaction fees
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            ⚠️ Need at least 0.04 SOL for transaction fees
                        </button>
                    ) : isWhiskeyGated ? (
                        // Whiskey-gated collections: Simple one-click mint (free if you have WHISKEY)
                        <button 
                            onClick={handleNewWhiskeyGatedMint}
                            disabled={isMinting}
                            className={`w-full py-3 px-4 rounded-xl font-bold transition-all duration-300 ${
                                isMinting
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg hover:shadow-xl transform hover:scale-105'
                            }`}
                        >
                            {isMinting ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                                    <span>Minting...</span>
                                </div>
                            ) : (
                                '🥃 Mint NFT (FREE)'
                            )}
                        </button>
                    ) : (
                        // Regular collections: Two-step process (swap + deposit, then mint)
                        <button 
                            onClick={handleStep1}
                            disabled={isMinting || step1Complete}
                            className={`w-full py-3 px-4 rounded-xl font-bold transition-all duration-300 ${
                                isMinting || step1Complete
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg hover:shadow-xl transform hover:scale-105'
                            }`}
                        >
                            {isMinting ? (
                                <div className="flex items-center justify-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                                    <span>Step 1: Swapping & Depositing...</span>
                                </div>
                            ) : step1Complete ? (
                                '✅ Step 1 Complete'
                            ) : (
                                '💰 Deposit & Mint NFT'
                            )}
                        </button>
                    )}

                    {/* Mint Status Message */}
                    {mintMessage && (
                        <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <p className="text-sm text-center text-amber-400">{mintMessage}</p>
                        </div>
                    )}
                    
                    {/* Info for whiskey-gated collections */}
                    
                    {/* Two-step process info for regular collections */}
                    {connected && !isWhiskeyGated && (
                        <div className="mt-4 space-y-2">
                            <div className="p-3 bg-green-900/20 rounded-lg border border-green-700/40">
                                <p className="text-xs text-green-400 text-center">
                                    💰 <strong>Paid Mint:</strong> WHISKEY tokens are swapped to USDC and used to mint your NFT • Two-step process
                                </p>
                            </div>
                            {/* 5 NFT Limit Warning */}
                            <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-600/50">
                                <p className="text-sm text-yellow-300 text-center font-bold">
                                    ⚠️ LIMIT: 5 NFTs per wallet maximum
                                </p>
                                <p className="text-xs text-yellow-400 text-center mt-1">
                                    You can mint up to 5 NFTs from this collection
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Success Popup for Step 1 Complete */}
            {showSuccessPopup && step1Complete && !step2Complete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 transform animate-fade-in-up">
                        <div className="text-center">
                            {/* Dynamic Icon based on state */}
                            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                                mintMessage.includes('⚠️') 
                                    ? 'bg-yellow-500/20' 
                                    : mintMessage.includes('❌') 
                                        ? 'bg-red-500/20' 
                                        : step2Complete 
                                            ? 'bg-green-500/20' 
                                            : 'bg-green-500/20'
                            }`}>
                                {mintMessage.includes('⚠️') ? (
                                    <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                ) : mintMessage.includes('❌') ? (
                                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : step2Complete ? (
                                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>

                            {/* Dynamic Title */}
                            <h3 className={`text-xl font-bold mb-3 ${
                                mintMessage.includes('⚠️') 
                                    ? 'text-yellow-400' 
                                    : mintMessage.includes('❌') 
                                        ? 'text-red-400' 
                                        : step2Complete 
                                            ? 'text-green-400' 
                                            : 'text-amber-400'
                            }`}>
                                {mintMessage.includes('⚠️') 
                                    ? '⚠️ Incomplete NFT' 
                                    : mintMessage.includes('❌') 
                                        ? '❌ Mint Failed' 
                                        : step2Complete 
                                            ? '🎉 NFT Minted!' 
                                            : '💰 Deposit Successful!'
                                }
                            </h3>

                            {/* Dynamic Message */}
                            <p className="text-slate-300 mb-4 text-sm leading-relaxed">
                                {mintMessage.includes('⚠️ NFT created but incomplete') ? (
                                    <>⚠️ Your NFT was created in your wallet but is missing on-chain metadata. This NFT cannot be used for lending. Please try minting a new NFT.</>
                                ) : mintMessage.includes('❌') ? (
                                    <>The NFT mint failed, but your deposit is safe in the vault. You can retry minting your NFT.</>
                                ) : step2Complete ? (
                                    <>🎉 Congratulations! Your NFT has been successfully minted with complete on-chain metadata and can be used for lending!</>
                                ) : mintMessage.includes('Validating') ? (
                                    <>Verifying that your NFT was created properly with all required on-chain data...</>
                                ) : (
                                    <>Your WHISKEY has been swapped to USDC and deposited to the vault. Mint your NFT now to complete the process!</>
                                )}
                            </p>
                            
                            {/* Show detailed error/warning message */}
                            {(mintMessage.includes('❌') || mintMessage.includes('⚠️')) && (
                                <div className={`border rounded-lg p-3 mb-4 ${
                                    mintMessage.includes('⚠️') 
                                        ? 'bg-yellow-900/20 border-yellow-500/30' 
                                        : 'bg-red-900/20 border-red-500/30'
                                }`}>
                                    <p className={`text-xs font-mono break-words ${
                                        mintMessage.includes('⚠️') 
                                            ? 'text-yellow-300' 
                                            : 'text-red-300'
                                    }`}>
                                        {mintMessage}
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-3">
                                {mintMessage.includes('⚠️') ? (
                                    <button
                                        onClick={() => {
                                            // Reset everything and allow user to try again
                                            setShowSuccessPopup(false);
                                            setIsMinting(false);
                                            setStep1Complete(false);
                                            setStep2Complete(false);
                                            setMintMessage('');
                                        }}
                                        className="w-full py-3 px-6 rounded-xl font-bold transition-all duration-300 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-lg hover:shadow-xl transform hover:scale-105"
                                    >
                                        🔄 Try Minting New NFT
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStep2}
                                        disabled={isMinting}
                                        className={`w-full py-3 px-6 rounded-xl font-bold transition-all duration-300 ${
                                            isMinting
                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-black shadow-lg hover:shadow-xl transform hover:scale-105'
                                        }`}
                                    >
                                        {isMinting ? (
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                                                <span>Minting NFT...</span>
                                            </div>
                                        ) : mintMessage.includes('❌') ? (
                                            '🔄 Retry Mint NFT'
                                        ) : (
                                            '🎨 Mint Your NFT Now'
                                        )}
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        setShowSuccessPopup(false);
                                        // Reset error message when closing
                                        if (mintMessage.includes('❌') || mintMessage.includes('⚠️')) {
                                            setMintMessage('');
                                        }
                                    }}
                                    disabled={isMinting}
                                    className="w-full py-2 px-4 text-slate-400 hover:text-slate-200 transition-colors duration-200 text-sm"
                                >
                                    {mintMessage.includes('⚠️') 
                                        ? 'Close (NFT in wallet but broken)' 
                                        : mintMessage.includes('❌') 
                                            ? 'Close (Your deposit is safe)' 
                                            : 'Close (Mint your NFT now)'
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NftCollectionCard;
