import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
    PublicKey, 
    Transaction, 
    VersionedTransaction,
    SystemProgram, 
    TransactionInstruction,
    LAMPORTS_PER_SOL,
    Keypair,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { Wallet } from '@solana/wallet-adapter-react';
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

// Raydium SDK Integration
import { Liquidity, LiquidityPoolKeys, Percent, Token, TokenAmount } from '@raydium-io/raydium-sdk';

// Import IDL and types
import { Whiskeyprogram } from '@/lib/idl/whiskeyprogram';
import idl from '@/lib/idl/whiskeyprogram.json';
import MediaWithFallback from './MediaWithFallback';
import { convertUsdToWhiskeyTokens, formatWhiskeyTokens, formatUsdAmount, useRealTimeWhiskeyPrice, getPriceChangeColor, formatPercentageChange, getCurrentWhiskeyRate } from '@/lib/coingeckoPricing';
import { getSwapPools, extractPoolAccounts, type RaydiumLiquidityPoolKeys } from '@/lib/raydiumApi';

// Token addresses
const WHISKEY_MINT = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!);
const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);

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
    const { publicKey, connected, signAllTransactions, signTransaction } = useWallet();

    // State management
    const [isMinting, setIsMinting] = useState(false);
    const [mintMessage, setMintMessage] = useState('');
    
    // Two-step mint flow state
    const [step1Complete, setStep1Complete] = useState(false);
    const [step2Complete, setStep2Complete] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageLoading, setImageLoading] = useState(true);
    const [walletNftCount, setWalletNftCount] = useState<number>(0);
    const [userWhiskeyBalance, setUserWhiskeyBalance] = useState<number>(0);
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
                
                let metadataUrl = metadataUri;
                if (metadataUri.startsWith('ipfs://')) {
                    const ipfsHash = metadataUri.replace('ipfs://', '');
                    const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud';
                    metadataUrl = `${pinataGateway}/ipfs/${ipfsHash}`;
                }

                const response = await fetch(metadataUrl);
                const metadata = await response.json();
                
                if (metadata.image) {
                    let imageUrl = metadata.image;
                    if (metadata.image.startsWith('ipfs://')) {
                        const ipfsHash = metadata.image.replace('ipfs://', '');
                        const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud';
                        imageUrl = `${pinataGateway}/ipfs/${ipfsHash}`;
                    }
                    setImageUrl(imageUrl);
                }
                    } catch (error) {
                console.error('Error fetching collection metadata:', error);
                    } finally {
                setImageLoading(false);
            }
        };

        fetchCollectionImage();
    }, [metadataUri]);

    // Check wallet NFT count for whiskey-gated collections
    useEffect(() => {
        const checkWalletNftCount = async () => {
            if (!connected || !publicKey || !isWhiskeyGated) return;

            try {
                // TODO: Implement wallet NFT counter check when program supports it
                // For now, allow minting (set to 0)
                     setWalletNftCount(0);
            } catch (error) {
                console.error('Error checking wallet NFT count:', error);
                setWalletNftCount(0);
            }
        };

        checkWalletNftCount();
    }, [connected, publicKey, connection, isWhiskeyGated]);

    // Check user WHISKEY balance
    useEffect(() => {
        const checkUserWhiskeyBalance = async () => {
            if (!connected || !publicKey) return;

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
            }
        };

        checkUserWhiskeyBalance();
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
            
            // Calculate swap amount (only the lending portion that needs to be USDC)
            const lendingShareBps = 8000; // 80% to lending
            const lendingPercentage = lendingShareBps / 10000; // e.g., 8000/10000 = 0.80
            const baseWhiskeyToSwap = displayMintPriceWhiskeyTokens * lendingPercentage;
            // Add 2% buffer to account for swap fees and slippage
            const whiskeyToSwap = baseWhiskeyToSwap * 1.02;
            const whiskeyToKeepForTreasury = displayMintPriceWhiskeyTokens * (1 - lendingPercentage);
            
            console.log(`[STEP1] Payment breakdown:`);
            console.log(`  - Total WHISKEY payment: ${displayMintPriceWhiskeyTokens} WHISKEY`);
            console.log(`  - Base lending portion (${(lendingPercentage * 100).toFixed(1)}%): ${baseWhiskeyToSwap} WHISKEY`);
            console.log(`  - Lending portion + 2% fee buffer: ${whiskeyToSwap} WHISKEY → USDC (Step 1)`);
            console.log(`  - Treasury portion (${((1 - lendingPercentage) * 100).toFixed(1)}%): ${whiskeyToKeepForTreasury} WHISKEY → Treasury (Step 2)`);
            
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

    // Step 2: Mint NFT after deposit is confirmed
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
                
                // Determine the NFT image URL - use collection image if available, otherwise use a branded placeholder
                let nftImageUrl = '';
                if (imageUrl && imageUrl !== '' && imageUrl !== '/placeholder-image.svg' && !imageUrl.includes('placeholder')) {
                    nftImageUrl = imageUrl;
                    console.log(`[STEP2] ✅ Using collection image: ${nftImageUrl}`);
                } else {
                    // Create a proper branded placeholder that won't be rejected by the API
                    nftImageUrl = `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(displayName)}`;
                    console.log(`[STEP2] ⚠️ Collection image not available, using branded placeholder: ${nftImageUrl}`);
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
                    throw new Error(`Failed to create NFT metadata: ${metadataResponse.statusText}`);
                }

                const metadataResult = await metadataResponse.json();
                if (!metadataResult.success) {
                    throw new Error(`Failed to create NFT metadata: ${metadataResult.message}`);
                }

                nftMetadataUri = metadataResult.metadataUri;
                console.log(`[STEP2] ✅ NFT metadata created: ${nftMetadataUri}`);
            } catch (metadataError) {
                console.error('[STEP2] Error creating NFT metadata:', metadataError);
                throw new Error(`Failed to create NFT metadata: ${metadataError.message}`);
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
            const treasuryShareBps = 2000; // 20% to treasury
            
            const lendingPercentage = lendingShareBps / 10000;
            const treasuryPercentage = treasuryShareBps / 10000;
            
            const whiskeyToTreasury = displayMintPriceWhiskeyTokens * treasuryPercentage;
            const usdcToVault = (mintPriceUsd || 0) * lendingPercentage;
            
            // Convert to lamports/micro-units
            const whiskeyToTreasuryLamports = Math.floor(whiskeyToTreasury * 1000000); // WHISKEY has 6 decimals
            const usdcToVaultLamports = Math.floor(usdcToVault * 1000000); // USDC has 6 decimals
            const currentWhiskeyPriceUsdMicro = Math.floor(whiskeyRate * 1000000); // Price in micro-USD
            
            console.log(`[STEP2] Payment calculation:`);
            console.log(`  - WHISKEY to treasury: ${whiskeyToTreasury} tokens (${whiskeyToTreasuryLamports} lamports)`);
            console.log(`  - USDC to vault: ${usdcToVault} USDC (${usdcToVaultLamports} lamports)`);
            console.log(`  - Current WHISKEY price: $${whiskeyRate} (${currentWhiskeyPriceUsdMicro} micro-USD)`);

            // Create secure mint instruction using new function
            // Convert numbers to BN for proper Anchor serialization
            const anchor = await import('@coral-xyz/anchor');
            const currentWhiskeyPriceUsdMicroBN = new anchor.BN(currentWhiskeyPriceUsdMicro);
            const whiskeyToTreasuryLamportsBN = new anchor.BN(whiskeyToTreasuryLamports);
            const usdcToVaultLamportsBN = new anchor.BN(usdcToVaultLamports);
            
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
            
            mintTransaction.add(mintInstruction);
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

    // NEW: Simple mint function for whiskey-gated NFTs (no payment required)
    const handleWhiskeyGatedMint = async () => {
        // Pre-mint validation
        if (!connected || !publicKey || !signTransaction) {
            setMintMessage('❌ Please connect your wallet first');
            return;
        }

        // Check if this is actually a whiskey-gated collection
        if (!isWhiskeyGated) {
            setMintMessage('❌ This function is only for whiskey-gated collections');
            return;
        }

        // Check if user has required WHISKEY balance
        if (!hasRequiredWhiskey) {
            setMintMessage(`❌ Need ${requiredWhiskeyAmount?.toLocaleString()} WHISKEY tokens to mint from this collection`);
            return;
        }

        // Check wallet NFT limit for whiskey-gated (1 per wallet)
        if (walletNftCount >= 1) {
            setMintMessage('❌ Already minted from this whiskey-gated collection (1 NFT per wallet)');
            return;
        }

        // Check collection limit
        if (displayItemsMinted >= displayItemLimit) {
            setMintMessage('❌ Collection is sold out');
            return;
        }

        setIsMinting(true);
        setMintMessage('🥃 Minting your whiskey-gated NFT...');

        try {
            console.log('[WHISKEY-GATED] Starting whiskey-gated NFT mint...');
            
            // Create individual NFT metadata
            const nftName = `${displayName} #${(displayItemsMinted || 0) + 1}`;
            const mintNumber = (displayItemsMinted || 0) + 1;
            
            // Create NFT metadata using the API
            const metadataResponse = await fetch('/api/mints/create-nft-metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nftName,
                    nftSymbol: displaySymbol,
                    nftDescription: `${displayName} - Master Distiller Edition #${mintNumber}`,
                    nftImageUrl: imageUrl || `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(displayName)}`,
                    attributes: [
                        { trait_type: 'Edition', value: mintNumber.toString() },
                        { trait_type: 'Collection', value: displayName },
                        { trait_type: 'Type', value: 'Master Distiller NFT' },
                        { trait_type: 'Rarity', value: 'Legendary' },
                        { trait_type: 'Whiskey Gated', value: 'true' },
                        { trait_type: 'Required WHISKEY', value: requiredWhiskeyAmount?.toString() || '0' },
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
                throw new Error(`Failed to create NFT metadata: ${metadataResponse.statusText}`);
            }

            const metadataResult = await metadataResponse.json();
            if (!metadataResult.success) {
                throw new Error(`Failed to create NFT metadata: ${metadataResult.message}`);
            }

            const nftMetadataUri = metadataResult.metadataUri;
            console.log('[WHISKEY-GATED] ✅ NFT metadata created:', nftMetadataUri);

            // Create the whiskey-gated mint transaction
            const mintResponse = await fetch('/api/mints/whiskey-gated-mint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    walletAddress: publicKey.toString(),
                    collectionName: displayName,
                    nftName,
                    nftSymbol: displaySymbol,
                    nftUri: nftMetadataUri,
                    requiredWhiskeyAmount: requiredWhiskeyAmount
                }),
            });

            if (!mintResponse.ok) {
                const errorData = await mintResponse.json();
                throw new Error(errorData.error || 'Failed to create mint transaction');
            }

            const mintResult = await mintResponse.json();
            if (!mintResult.success) {
                throw new Error(mintResult.error || 'Failed to create mint transaction');
            }

            console.log('[WHISKEY-GATED] ✅ Mint transaction created');

            // Deserialize and sign the transaction
            const transactionBuffer = Buffer.from(mintResult.transaction, 'base64');
            const transaction = Transaction.from(transactionBuffer);

            console.log('[WHISKEY-GATED] Requesting wallet signature...');
            const signedTransaction = await signTransaction(transaction);

            console.log('[WHISKEY-GATED] Submitting transaction...');
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());
            
            console.log('[WHISKEY-GATED] Transaction sent:', signature);
            setMintMessage('⏳ Confirming transaction...');
            
            await connection.confirmTransaction(signature, 'confirmed');
            console.log('[WHISKEY-GATED] ✅ Transaction confirmed!');

            // Record the purchase
            try {
                await fetch('/api/mints/record-purchase', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        walletAddress: publicKey.toString(),
                        nftMintAddress: mintResult.nftMint,
                        collectionMintAddress: collectionMintAddress,
                        transactionSignature: signature,
                    }),
                });
            } catch (recordError) {
                console.warn('[WHISKEY-GATED] Failed to record purchase:', recordError);
                // Don't fail the mint for this
            }

            setMintMessage('🎉 Success! Your whiskey-gated NFT has been minted!');
            
            // Trigger success callback
            if (onMintSuccess) {
                onMintSuccess();
            }

            // Show success message for a few seconds
            setTimeout(() => {
                setMintMessage('');
            }, 5000);

        } catch (error) {
            console.error('[WHISKEY-GATED] Error minting NFT:', error);
            setMintMessage(`❌ Mint failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsMinting(false);
        }
    };

    // Legacy function for backwards compatibility (now simplified)

    // New handler for Step 1: Swap & Deposit
    const handleStep1 = async () => {
        // Pre-mint validation
        if (!connected || !publicKey) {
            setMintMessage('❌ Please connect your wallet first');
            return;
        }

        // Check WHISKEY balance
        if (userWhiskeyBalance < displayMintPriceWhiskeyTokens) {
            setMintMessage(`❌ Insufficient WHISKEY balance. Need ${displayMintPriceWhiskeyTokens.toFixed(6)} WHISKEY`);
            return;
        }

        // Check wallet NFT limit (max 5 per collection)
        if (walletNftCount >= 5) {
            setMintMessage('❌ Wallet limit reached (5 NFTs max per collection)');
            return;
        }

        // For whiskey-gated collections, check if user has required amount
        if (isWhiskeyGated && !hasRequiredWhiskey) {
            setMintMessage(`❌ Need ${requiredWhiskeyAmount} WHISKEY tokens to mint from this collection`);
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
            setMintMessage('✅ Step 1 Complete: USDC deposited to vault! Ready to mint NFT.');
        } catch (error) {
            console.error('Step 1 failed:', error);
            setMintMessage(`❌ Step 1 failed: ${error}`);
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
            await handleStep2MintNft();
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
            setMintMessage(`❌ Step 2 failed: ${error.message || error}. Click "Mint NFT" to retry.`);
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
                            Already minted from this collection
                        </button>
                    ) : userWhiskeyBalance === 0 ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-amber-800/50 text-amber-400 rounded-xl font-bold cursor-not-allowed border border-amber-700/50"
                        >
                            Checking WHISKEY balance...
                        </button>
                    ) : !isWhiskeyGated && displayMintPriceWhiskeyTokens > 0 && userWhiskeyBalance < displayMintPriceWhiskeyTokens ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            Insufficient WHISKEY ({formatWhiskeyTokens(displayMintPriceWhiskeyTokens)} required)
                        </button>
                    ) : isWhiskeyGated && !hasRequiredWhiskey ? (
                        <button
                            disabled
                            className="w-full py-3 px-4 bg-red-800/50 text-red-400 rounded-xl font-bold cursor-not-allowed border border-red-700/50"
                        >
                            Insufficient WHISKEY tokens ({requiredWhiskeyAmount?.toLocaleString()} required)
                        </button>
                    ) : isWhiskeyGated ? (
                        // Whiskey-gated collections: Simple one-click mint (free if you have WHISKEY)
                        <button 
                            onClick={handleWhiskeyGatedMint}
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
                    {connected && isWhiskeyGated && (
                        <div className="mt-4 p-3 bg-amber-900/20 rounded-lg border border-amber-700/40">
                            <p className="text-xs text-amber-400 text-center">
                                🥃 <strong>Master Distiller Collection:</strong> FREE mint if you hold {requiredWhiskeyAmount?.toLocaleString()} WHISKEY • 1 NFT per wallet
                            </p>
                        </div>
                    )}
                    
                    {/* Two-step process info for regular collections */}
                    {connected && !isWhiskeyGated && (
                        <div className="mt-4 p-3 bg-green-900/20 rounded-lg border border-green-700/40">
                            <p className="text-xs text-green-400 text-center">
                                🔄 <strong>Two-Step Process:</strong> 1) Direct WHISKEY→USDC swap + vault deposit → 2) NFT mint
                            </p>
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
                                    <>Your WHISKEY has been swapped to USDC and deposited to the vault. You're now ready to receive your NFT!</>
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
                                            '🎨 Receive Your NFT'
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
                                            : 'Close (You can mint later)'
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
