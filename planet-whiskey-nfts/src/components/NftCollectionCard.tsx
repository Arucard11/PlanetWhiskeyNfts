"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram,  SYSVAR_RENT_PUBKEY, ComputeBudgetProgram } from '@solana/web3.js';
import { Program, AnchorProvider, type Wallet, BN, type Idl, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

// Assuming your IDL and program types are here - adjust path as necessary
import { Whiskeyprogram } from '@/lib/idl/whiskeyprogram';
import idl from '@/lib/idl/whiskeyprogram.json';
import MediaWithFallback from './MediaWithFallback';
import { convertUsdToWhiskeyTokens, formatWhiskeyTokens, formatUsdAmount, useRealTimeWhiskeyPrice, getPriceChangeColor, formatPercentageChange } from '@/lib/coingeckoPricing';

// Global cache for metadata to prevent duplicate API calls
const globalMetadataCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Debounce mechanism to prevent rapid API calls
let pendingRequests = new Map<string, Promise<any>>();

// Ensure your program ID is correctly sourced, e.g., from an environment variable or a constants file
const WHISKEY_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!);



// Augmented collection data interface that the API endpoint /api/collections/:collectionOnChainAddress returns
interface IAugmentedNftCollection {
    _id: string;
    collectionOnChainAddress: string; 
    collectionMintAddress: string;    
    name: string; // Name of the CollectionConfig PDA (used for seeds if needed)
    symbol: string;                   
    metadataUri: string; // Collection's own metadata URI             
    nftBaseMetadataUri: string; // Base URI for individual NFTs      
    mintPriceLamports: number;
    mintPriceWhiskeyTokens: number;
    mintPriceUsd?: number; // NEW: USD price (what admin sets)
    itemLimit: number;
    companyId: string; 
    isActive: boolean;
    createdAt: Date;
    updatedAt?: Date; 
    itemsMintedOnChain?: number; // This is crucial, fetched live
    authority: string; // Public key string of the collection authority (for receiving mint fees)
    bump: number; // Bump for the CollectionConfig PDA
    isWhiskeyGated?: boolean; // NEW: Whether this collection requires WHISKEY tokens to mint
    requiredWhiskeyAmount?: number; // NEW: Required WHISKEY tokens (in full tokens, not lamports)
}

export interface NftCollectionCardProps {
    _id: string; 
    collectionOnChainAddress: string; 
    name: string;                     
    symbol: string;                   
    metadataUri: string;              
    mintPriceLamports: number; 
    mintPriceWhiskeyTokens: number;   // WHISKEY token amount (calculated from USD)
    mintPriceUsd?: number;            // NEW: USD price (what admin sets)
    itemLimit: number; 
    itemsMintedOnChain?: number; 
    onMintSuccess?: () => void;
    isWhiskeyGated?: boolean; // NEW: Whether this collection requires WHISKEY tokens to mint
    requiredWhiskeyAmount?: number; // NEW: Required WHISKEY tokens (in full tokens, not lamports)
}



const NftCollectionCard: React.FC<NftCollectionCardProps> = ({ 
    _id, 
    collectionOnChainAddress, 
    name: initialName, 
    symbol: initialSymbol,
    metadataUri, 
    mintPriceLamports: initialMintPriceLamports, 
    mintPriceWhiskeyTokens: initialMintPriceWhiskeyTokens,
    mintPriceUsd,
    itemLimit: initialItemLimit,
    itemsMintedOnChain: initialItemsMintedOnChain = 0,
    onMintSuccess,
    isWhiskeyGated = false,
    requiredWhiskeyAmount = 0
}) => {
    // Real-time WHISKEY price hook that updates every 5 seconds
    // Removed duplicate price hook - using the one below
    // Debug log the props received by this component
    console.log(`[NftCollectionCard] 🎯 Component initialized for collection:`, {
        name: initialName,
        _id,
        collectionOnChainAddress,
        metadataUri,
        mintPriceLamports: initialMintPriceLamports,
        mintPriceWhiskeyTokens: initialMintPriceWhiskeyTokens,
        mintPriceUsd,
        itemLimit: initialItemLimit,
        itemsMintedOnChain: initialItemsMintedOnChain
    });

    const { connection } = useConnection();
    const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();

    const [isMinting, setIsMinting] = useState(false);
    const [mintMessage, setMintMessage] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');

    const [displayItemsMinted, setDisplayItemsMinted] = useState(initialItemsMintedOnChain);
    const [displayItemLimit, setDisplayItemLimit] = useState(initialItemLimit);
    const [walletNftCount, setWalletNftCount] = useState<number | null>(null);
    const [isCheckingWalletLimit, setIsCheckingWalletLimit] = useState(false);
    
    const [whiskeyRate, setWhiskeyRate] = useState<number | null>(null);
    const [userWhiskeyBalance, setUserWhiskeyBalance] = useState<number | null>(null);
    const [isCheckingWhiskeyBalance, setIsCheckingWhiskeyBalance] = useState(false);

    // Effect to fetch collection image from metadata using our proxy
    useEffect(() => {
        const fetchCollectionImage = async () => {
            if (!metadataUri) {
                setImageUrl('/placeholder-image.svg');
                return;
            }

            try {
                console.log(`[NftCollectionCard] Fetching collection image for: ${initialName}`);
                
                // Check global cache first
                const cached = globalMetadataCache.get(metadataUri);
                if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                    console.log(`[NftCollectionCard] Using cached metadata for: ${initialName}`);
                    if (cached.data && cached.data.image) {
                        setImageUrl(cached.data.image);
                    } else {
                        setImageUrl('/placeholder-image.svg');
                    }
                    return;
                }

                // Check if there's already a pending request for this metadata
                if (pendingRequests.has(metadataUri)) {
                    console.log(`[NftCollectionCard] Waiting for pending request for: ${initialName}`);
                    const result = await pendingRequests.get(metadataUri);
                    if (result && result.image) {
                        setImageUrl(result.image);
                    } else {
                        setImageUrl('/placeholder-image.svg');
                    }
                    return;
                }

                // Create a new request promise
                const requestPromise = (async () => {
                    try {
                        // Add a small delay to prevent rate limiting
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        // Use our server-side proxy to avoid CORS issues
                        const apiUrl = `/api/collections/metadata?metadataUri=${encodeURIComponent(metadataUri)}`;
                        const response = await fetch(apiUrl);
                        
                        if (!response.ok) {
                            console.warn(`[NftCollectionCard] Failed to fetch metadata: ${response.status} ${response.statusText}`);
                            return null;
                        }

                        const result = await response.json();
                        if (!result.success) {
                            console.warn(`[NftCollectionCard] API returned error: ${result.message}`);
                            return null;
                        }

                        const metadata = result.data;
                        console.log(`[NftCollectionCard] Fetched metadata:`, metadata);

                        // Cache the result
                        globalMetadataCache.set(metadataUri, { data: metadata, timestamp: Date.now() });

                        return metadata;
                    } catch (error) {
                        console.error(`[NftCollectionCard] Error fetching collection image:`, error);
                        return null;
                    } finally {
                        // Remove from pending requests
                        pendingRequests.delete(metadataUri);
                    }
                })();

                // Store the pending request
                pendingRequests.set(metadataUri, requestPromise);

                // Wait for the result
                const metadata = await requestPromise;
                if (metadata && metadata.image) {
                    console.log(`[NftCollectionCard] Setting image URL: ${metadata.image}`);
                    setImageUrl(metadata.image);
                } else {
                    console.warn(`[NftCollectionCard] No image found in metadata`);
                    setImageUrl('/placeholder-image.svg');
                }
            } catch (error) {
                console.error(`[NftCollectionCard] Error in fetchCollectionImage:`, error);
                setImageUrl('/placeholder-image.svg');
            }
        };

        fetchCollectionImage();
    }, [metadataUri, initialName]);

    // Effect to check wallet NFT count when wallet connects
    useEffect(() => {
        const checkWalletNftCount = async () => {
            if (!publicKey || !connected || !signTransaction || !signAllTransactions) {
                setWalletNftCount(null);
                return;
            }

            setIsCheckingWalletLimit(true);
            try {
                // Use Anchor to fetch and decode the account data safely
                const walletAdapter = { publicKey, signTransaction, signAllTransactions } as Wallet;
                const provider = new AnchorProvider(connection, walletAdapter, AnchorProvider.defaultOptions());
                const program = new Program(idl as any, provider);

                // Use the collection-specific PDA that matches the updated smart contract
                const collectionConfigPda = new PublicKey(collectionOnChainAddress);
                const [walletNftCounterPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("wallet_nft_counter"), publicKey.toBuffer(), collectionConfigPda.toBuffer()],
                    program.programId // Use program's ID
                );

                // Fetch the account using the program instance
                const counterAccount = await (program.account as any).walletNftCounter.fetch(walletNftCounterPda);
                setWalletNftCount(counterAccount.nftCount);
                console.log(`[WalletLimit] Wallet ${publicKey.toBase58()} has minted ${counterAccount.nftCount}/5 NFTs for this collection (decoded).`);
            } catch (error: any) {
                // It's expected for the account to not exist if the user has never minted.
                // This is not an error state, it just means the count is 0.
                if (error.message && error.message.includes("Account does not exist")) {
                     setWalletNftCount(0);
                     console.log(`[WalletLimit] Wallet ${publicKey.toBase58()} has minted 0/5 NFTs for this collection (no counter account found).`);
                } else {
                    console.error('[WalletLimit] Error checking wallet NFT count:', error);
                    setWalletNftCount(0); // Set to 0 instead of null for better UX
                }
            } finally {
                setIsCheckingWalletLimit(false);
            }
        };

        checkWalletNftCount();
    }, [publicKey, connected, connection, signTransaction, signAllTransactions]);

    // Effect to check user's WHISKEY balance for gated collections
    useEffect(() => {
        const checkUserWhiskeyBalance = async () => {
            if (!publicKey || !connected || !isWhiskeyGated) {
                setUserWhiskeyBalance(null);
                return;
            }

            setIsCheckingWhiskeyBalance(true);
            try {
                // Get user's WHISKEY token account
                const whiskeyMint = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_TOKEN_MINT!);
                const userWhiskeyTokenAccount = await getAssociatedTokenAddress(
                    whiskeyMint,
                    publicKey
                );

                // Fetch the token account balance
                const tokenAccount = await connection.getTokenAccountBalance(userWhiskeyTokenAccount);
                if (tokenAccount.value) {
                    // Convert from lamports to full tokens (WHISKEY has 6 decimals)
                    const balanceInTokens = tokenAccount.value.uiAmount || 0;
                    setUserWhiskeyBalance(balanceInTokens);
                    console.log(`[WhiskeyBalance] User has ${balanceInTokens} WHISKEY tokens`);
                } else {
                    setUserWhiskeyBalance(0);
                }
            } catch (error: any) {
                console.log(`[WhiskeyBalance] Error checking WHISKEY balance (likely no token account):`, error.message);
                setUserWhiskeyBalance(0);
            } finally {
                setIsCheckingWhiskeyBalance(false);
            }
        };

        checkUserWhiskeyBalance();
    }, [publicKey, connected, isWhiskeyGated, connection]);

    // Use real-time WHISKEY rate from the hook - same as admin dashboard
    const { priceData: whiskeyPriceData, loading: priceLoading, error: priceError } = useRealTimeWhiskeyPrice(30000);
    
    useEffect(() => {
        if (whiskeyPriceData?.usd) {
            setWhiskeyRate(whiskeyPriceData.usd);
        }
    }, [whiskeyPriceData]);

    // Separate effect for updating display values without affecting image loading
    useEffect(() => {
        setDisplayItemsMinted(initialItemsMintedOnChain);
        setDisplayItemLimit(initialItemLimit);
    }, [initialItemsMintedOnChain, initialItemLimit]);

    const handleMint = useCallback(async () => {
        if (!connected || !publicKey || !signTransaction || !signAllTransactions) {
            setMintMessage("Wallet not connected. Please connect your wallet to mint.");
            return;
        }

        // Check if whiskey rate is loaded
        if (!whiskeyRate) {
            setMintMessage("⏳ Loading WHISKEY price data... Please wait a moment and try again.");
            return;
        }

        // Check wallet NFT limit before proceeding (only for regular collections)
        if (!isWhiskeyGated) {
            const maxAllowed = 5;
            if (walletNftCount !== null && walletNftCount >= maxAllowed) {
                setMintMessage("❌ Wallet limit reached! You can only mint 5 NFTs total per wallet across all collections.");
                return;
            }
        }

        // Prevent multiple simultaneous minting attempts
        if (isMinting) {
            console.warn("Minting already in progress, ignoring duplicate request");
            return;
        }

        setIsMinting(true);
        setMintMessage("Fetching latest collection details...");

        let liveCollectionData: IAugmentedNftCollection;
        try {
            const apiResponse = await fetch(`/api/collections/${collectionOnChainAddress}`);
            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.message || `Failed to fetch collection details: ${apiResponse.statusText}`);
            }
            const responseJson = await apiResponse.json();
            if (!responseJson.success || !responseJson.data) {
                throw new Error(responseJson.message || "Failed to fetch valid collection data.");
            }
            liveCollectionData = responseJson.data;
            
            setDisplayItemsMinted(liveCollectionData.itemsMintedOnChain || 0);
            setDisplayItemLimit(liveCollectionData.itemLimit);
            
            if (!liveCollectionData.authority) { // Ensure authority is present
                throw new Error("Collection authority not found in fetched data.");
            }

        } catch (error: any) {
            console.error("Failed to fetch live collection data:", error);
            setMintMessage(`Error: ${error.message}`);
            setIsMinting(false);
            return;
        }
        
        const currentItemsMinted = liveCollectionData.itemsMintedOnChain || 0;
        if (currentItemsMinted >= liveCollectionData.itemLimit) {
            setMintMessage("Sold out! (checked with latest data)");
            setIsMinting(false);
            return;
        }

        setMintMessage("Preparing to mint with custom program...");

        try {
            setIsMinting(true);
            setMintMessage("Preparing transaction...");

            // Create a proper wallet adapter for Anchor
            const walletAdapter = {
                publicKey,
                signTransaction,
                signAllTransactions,
            };

            // Setup Anchor Provider and Program
            const provider = new AnchorProvider(connection, walletAdapter, AnchorProvider.defaultOptions());
            const program = new Program(idl as any, provider);

            const collectionConfigPda = new PublicKey(collectionOnChainAddress); // This is liveCollectionData.collectionOnChainAddress
            const collectionMintAccountPk = new PublicKey(liveCollectionData.collectionMintAddress);
            const collectionAuthorityReceiverPk = new PublicKey(liveCollectionData.authority);


            // Prepare NFT-specific metadata
            const mintNumber = new BN(currentItemsMinted).add(new BN(1)).toNumber();
            const nftName = `${liveCollectionData.name} #${mintNumber}`; 
            const nftSymbol = liveCollectionData.symbol;
            
            setMintMessage("Creating unique NFT metadata...");
            
            // Get the actual image URL from the base metadata with retry logic
            let actualImageUrl = liveCollectionData.nftBaseMetadataUri; // Default fallback
            let baseNftDescription = `${liveCollectionData.name} - Edition #${mintNumber}. A premium treasury NFT from our exclusive collection.`; // Default fallback
            
            // Multiple gateway attempts for better reliability
            const tryMultipleGateways = async (ipfsHash: string) => {
                const gateways = [
                    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                    `https://ipfs.io/ipfs/${ipfsHash}`,
                    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
                    `https://dweb.link/ipfs/${ipfsHash}`
                ];
                
                for (const gateway of gateways) {
                    try {
                        console.log(`[NFT_MINT] Trying gateway: ${gateway}`);
                        const response = await fetch(gateway, { 
                            headers: { 'Accept': 'application/json' }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`[NFT_MINT] ✅ Success with gateway: ${gateway}`);
                            return data;
                        }
                    } catch (error) {
                        console.warn(`[NFT_MINT] Gateway ${gateway} failed:`, error.message);
                        continue;
                    }
                }
                throw new Error('All gateways failed');
            };
            
            try {
                console.log(`[NFT_MINT] Fetching base metadata to extract image URL and description from: ${liveCollectionData.nftBaseMetadataUri}`);
                
                let baseMetadata: any = null;
                
                if (liveCollectionData.nftBaseMetadataUri.startsWith('ipfs://')) {
                    // Extract IPFS hash and try multiple gateways
                    const ipfsHash = liveCollectionData.nftBaseMetadataUri.replace('ipfs://', '');
                    console.log(`[NFT_MINT] Extracted IPFS hash: ${ipfsHash}`);
                    baseMetadata = await tryMultipleGateways(ipfsHash);
                } else {
                    // Direct URL
                    const response = await fetch(liveCollectionData.nftBaseMetadataUri);
                    if (response.ok) {
                        baseMetadata = await response.json();
                    }
                }
                
                if (baseMetadata) {
                    // Extract image URL if available
                    if (baseMetadata.image) {
                        actualImageUrl = baseMetadata.image;
                        console.log(`[NFT_MINT] ✅ Successfully extracted image URL: ${actualImageUrl}`);
                    } else {
                        console.warn(`[NFT_MINT] ⚠️ No image field found in base metadata. Available fields:`, Object.keys(baseMetadata));
                        console.warn(`[NFT_MINT] Full metadata:`, baseMetadata);
                    }
                    
                    // Extract and use admin's description instead of hardcoded one
                    if (baseMetadata.description) {
                        baseNftDescription = baseMetadata.description;
                        console.log(`[NFT_MINT] ✅ Successfully extracted admin's description: ${baseNftDescription}`);
                    } else {
                        console.warn(`[NFT_MINT] ⚠️ No description field found in base metadata, using default fallback`);
                    }
                } else {
                    console.warn(`[NFT_MINT] ❌ Failed to fetch base metadata from all sources, trying backup image source...`);
                    
                    // BACKUP: Try to get image from collection's metadataUri (collection image)
                    try {
                        console.log(`[NFT_MINT] 🔄 Attempting backup: using collection metadata image`);
                        const collectionMetadataUrl = liveCollectionData.metadataUri.startsWith('ipfs://') 
                            ? liveCollectionData.metadataUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                            : liveCollectionData.metadataUri;
                        
                        const collectionResponse = await fetch(collectionMetadataUrl);
                        if (collectionResponse.ok) {
                            const collectionMetadata = await collectionResponse.json();
                            if (collectionMetadata.image) {
                                actualImageUrl = collectionMetadata.image;
                                console.log(`[NFT_MINT] ✅ BACKUP SUCCESS: Using collection image: ${actualImageUrl}`);
                            }
                        }
                    } catch (backupError) {
                        console.warn(`[NFT_MINT] ❌ Backup image source also failed:`, backupError);
                        console.log(`[NFT_MINT] 🎯 FINAL FALLBACK: Will use placeholder image`);
                    }
                }
            } catch (error) {
                console.warn(`[NFT_MINT] ❌ Error extracting data from base metadata:`, error);
                console.log(`[NFT_MINT] Using fallback values for image and description`);
            }
            
            // Format the final NFT description - append edition info if not already present
            let finalNftDescription = baseNftDescription;
            if (!finalNftDescription.toLowerCase().includes('#' + mintNumber.toString()) && 
                !finalNftDescription.toLowerCase().includes('edition')) {
                finalNftDescription = `${baseNftDescription} - Edition #${mintNumber}`;
            } else if (!finalNftDescription.toLowerCase().includes('#' + mintNumber.toString())) {
                // If it mentions "edition" but not the specific number, just add the number
                finalNftDescription = `${baseNftDescription} #${mintNumber}`;
            }
            
            // Create unique metadata for this NFT using the create-nft-metadata API
            const mintTimestamp = Date.now();
            const metadataResponse = await fetch('/api/mints/create-nft-metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nftName: nftName,
                    nftSymbol: nftSymbol,
                    nftDescription: finalNftDescription, // Use the properly formatted description
                    nftImageUrl: actualImageUrl, // Now using the extracted image URL instead of metadata URI
                    attributes: [
                        { trait_type: "Edition", value: mintNumber.toString() },
                        { trait_type: "Collection", value: liveCollectionData.name },
                        { trait_type: "Type", value: "Treasury NFT" },
                        { trait_type: "Rarity", value: mintNumber <= 10 ? "Legendary" : mintNumber <= 50 ? "Rare" : "Common" },
                        { trait_type: "Mint Timestamp", value: mintTimestamp.toString() }
                    ],
                    collectionName: liveCollectionData.name,
                    collectionFamily: liveCollectionData.name,
                    mintNumber: mintNumber,
                    mintTimestamp: mintTimestamp // Add timestamp for uniqueness
                })
            });

            if (!metadataResponse.ok) {
                throw new Error(`Failed to create NFT metadata: ${metadataResponse.statusText}`);
            }

            const metadataResult = await metadataResponse.json();
            const nftUri = metadataResult.metadataUri;
            
            setMintMessage(`Metadata created: ${nftUri}`);


            // Generate a completely fresh keypair for this transaction
            const nftMintKeypair = web3.Keypair.generate();
            console.log(`[NFT_MINT] Generated fresh NFT mint keypair: ${nftMintKeypair.publicKey.toBase58()}`);

            const metadataPda = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    nftMintKeypair.publicKey.toBuffer(),
                ],
                MPL_TOKEN_METADATA_PROGRAM_ID
            )[0];

            const masterEditionPda = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("metadata"),
                    MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    nftMintKeypair.publicKey.toBuffer(),
                    Buffer.from("edition"),
                ],
                MPL_TOKEN_METADATA_PROGRAM_ID
            )[0];
            
            const nftTokenAccountPk = await getAssociatedTokenAddress(
                nftMintKeypair.publicKey,
                publicKey
            );

            // Check SOL balance before attempting to mint
            const solBalance = await connection.getBalance(publicKey);
            console.log(`SOL balance: ${solBalance / 1e9} SOL (${solBalance} lamports)`);
            
            if (solBalance < 20_000_000) { // Less than 0.02 SOL
                throw new Error(`Insufficient SOL balance. You have ${(solBalance / 1e9).toFixed(4)} SOL but need at least 0.02 SOL for account creation and transaction fees.`);
            }
            
            setMintMessage(`Calling program. Program ID: ${WHISKEY_PROGRAM_ID.toBase58()}`);
            
            // Use the new WHISKEY token mint from environment variables
            const WHISKEY_TOKEN_MINT_PK = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_TOKEN_MINT!);
            
            // Get the payer's whiskey token account
            const payerWhiskeyTokenAccount = await getAssociatedTokenAddress(
                WHISKEY_TOKEN_MINT_PK,
                publicKey
            );
            
            // Get the authority's whiskey token account
            const authorityWhiskeyTokenAccount = await getAssociatedTokenAddress(
                WHISKEY_TOKEN_MINT_PK,
                collectionAuthorityReceiverPk
            );
            
            // Calculate current WHISKEY cost from USD price
            let currentWhiskeyPrice: number;
            if (isWhiskeyGated && requiredWhiskeyAmount) {
                // For whiskey-gated collections, the mint is FREE (0 cost) - we just check qualification
                currentWhiskeyPrice = 0; // FREE MINT!
                console.log(`[NftCollectionCard] Whiskey-gated collection: FREE MINT (requires ${requiredWhiskeyAmount} WHISKEY to qualify)`);
            } else if (liveCollectionData.mintPriceUsd && whiskeyRate) {
                // Use real-time USD to WHISKEY conversion for regular collections
                currentWhiskeyPrice = liveCollectionData.mintPriceUsd / whiskeyRate;
                // Convert to 6 decimal format for the program
                currentWhiskeyPrice = currentWhiskeyPrice * 1000000;
            } else {
                throw new Error("Cannot calculate WHISKEY price - missing USD price or WHISKEY rate");
            }
            
            // Check if payer's whiskey token account exists, create if needed
            let createPayerAccountIx: any = null;
            try {
                const payerTokenAccountInfo = await connection.getTokenAccountBalance(payerWhiskeyTokenAccount);
                console.log(`Payer whiskey token balance: ${payerTokenAccountInfo.value.uiAmount} WHISKEY`);
                
                if (isWhiskeyGated && requiredWhiskeyAmount) {
                    // For whiskey-gated collections, check if user QUALIFIES (has minimum required amount)
                    if (!payerTokenAccountInfo.value.uiAmount || payerTokenAccountInfo.value.uiAmount < requiredWhiskeyAmount) {
                        throw new Error(`You need ${requiredWhiskeyAmount} WHISKEY tokens to qualify for this gated collection. You have ${payerTokenAccountInfo.value.uiAmount || 0}.`);
                    }
                    console.log(`✅ User qualifies for whiskey-gated collection with ${payerTokenAccountInfo.value.uiAmount} WHISKEY tokens`);
                } else {
                    // For regular collections, check if user can PAY the mint price
                    const currentWhiskeyPriceFormatted = currentWhiskeyPrice / 1e6; // Convert from smallest units to display units
                    if (!payerTokenAccountInfo.value.uiAmount || payerTokenAccountInfo.value.uiAmount < currentWhiskeyPriceFormatted) {
                        throw new Error(`Insufficient WHISKEY tokens. You have ${payerTokenAccountInfo.value.uiAmount || 0} but need ${currentWhiskeyPriceFormatted.toFixed(2)}.`);
                    }
                }
            } catch (accountError: any) {
                if (accountError.message.includes('could not find account')) {
                    if (isWhiskeyGated && requiredWhiskeyAmount) {
                        // For whiskey-gated collections, if no account exists, user definitely doesn't qualify
                        throw new Error(`You need ${requiredWhiskeyAmount} WHISKEY tokens to qualify for this gated collection. You don't have a WHISKEY token account yet.`);
                    } else {
                        // For regular collections, create the account so they can pay
                        console.log('🪙 Payer WHISKEY token account does not exist, creating...');
                        createPayerAccountIx = createAssociatedTokenAccountInstruction(
                            publicKey, // payer
                            payerWhiskeyTokenAccount,
                            publicKey, // owner
                            WHISKEY_TOKEN_MINT_PK // mint
                        );
                    }
                } else if (!accountError.message.includes('WHISKEY tokens')) {
                    console.warn('Could not check token balance:', accountError);
                    // Continue with minting - let the program handle the error
                } else {
                    // Re-throw qualification/payment errors
                    throw accountError;
                }
            }
            
            // For the mint function, we need the lending program's global market for dynamic fees
            const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
            
            // Use global market PDA from environment variables or derive from lending program
            const globalMarketPda = process.env.NEXT_PUBLIC_GLOBAL_MARKET_PDA
                ? new PublicKey(process.env.NEXT_PUBLIC_GLOBAL_MARKET_PDA)
                : PublicKey.findProgramAddressSync([Buffer.from("global_market")], LENDING_PROGRAM_ID)[0];

            // Derive wallet NFT counter PDA
            const [walletNftCounterPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("wallet_nft_counter"), publicKey.toBuffer(), collectionConfigPda.toBuffer()],
                program.programId
            );

            // Derive lending pool config PDA correctly
            const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("lending_pool")], 
                program.programId
            );

            // Derive the vault PDAs correctly (don't use hardcoded addresses)
            const [lendingPoolWhiskeyVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("lending_pool"), Buffer.from("whiskey_vault_v2")],
                program.programId
            );
            
            const [lendingPoolUsdcVaultPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
                program.programId
            );

            // Log the derived addresses for debugging
            console.log('🔍 Derived PDA addresses:');
            console.log('  Lending Pool Config:', lendingPoolConfigPda.toString());
            console.log('  WHISKEY Vault V2:', lendingPoolWhiskeyVaultPda.toString());
            console.log('  USDC Vault V2:', lendingPoolUsdcVaultPda.toString());

            // Treasury wallet address (the admin wallet) - from environment variables
            const TREASURY_WALLET = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
            
            // Calculate treasury wallet's Associated Token Account for WHISKEY tokens
            const treasuryWhiskeyTokenAccount = await getAssociatedTokenAddress(
                WHISKEY_TOKEN_MINT_PK,
                TREASURY_WALLET
            );

            // Check if treasury WHISKEY token account exists, create if needed
            const treasuryAccountInfo = await connection.getAccountInfo(treasuryWhiskeyTokenAccount);
            let createTreasuryAccountIx: any = null;
            if (!treasuryAccountInfo) {
                console.log('🏦 Treasury WHISKEY token account does not exist, creating...');
                createTreasuryAccountIx = createAssociatedTokenAccountInstruction(
                    walletAdapter.publicKey!, // payer
                    treasuryWhiskeyTokenAccount,
                    TREASURY_WALLET, // owner
                    WHISKEY_TOKEN_MINT_PK // mint
                );
            }

            // Jupiter and USDC constants
            const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
            const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

            // Prepare accounts object with Jupiter CPI accounts
            const accounts = {
                payer: walletAdapter.publicKey,
                collectionConfig: collectionConfigPda,
                walletNftCounter: walletNftCounterPda, // Add the wallet NFT counter
                collectionMintAccount: collectionMintAccountPk,
                nftMint: nftMintKeypair.publicKey,
                nftMetadataAccount: metadataPda,
                nftMasterEditionAccount: masterEditionPda,
                nftTokenAccount: nftTokenAccountPk,
                collectionAuthorityReceiver: collectionAuthorityReceiverPk,
                globalMarket: globalMarketPda,
                whiskeyTokenMint: WHISKEY_TOKEN_MINT_PK,
                payerWhiskeyTokenAccount: payerWhiskeyTokenAccount,
                // COMMENTED OUT FOR DEVNET - Jupiter CPI accounts (restore for mainnet)
                lendingPoolConfig: lendingPoolConfigPda,
                lendingPoolWhiskeyVault: lendingPoolWhiskeyVaultPda,
                lendingPoolUsdcVault: lendingPoolUsdcVaultPda,
                treasuryWhiskeyTokenAccount: treasuryWhiskeyTokenAccount,
                treasuryWallet: TREASURY_WALLET,
                // usdcMint: USDC_MINT, // COMMENTED OUT FOR DEVNET
                // jupiterProgram: JUPITER_PROGRAM_ID, // COMMENTED OUT FOR DEVNET
                // System programs
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            };
            
            // Create the transaction - for whiskey-gated collections, pass 0 amounts (free mint)
            const transaction = await program.methods
                .mintNftWithSwap(
                    nftName, // Use the properly formatted name: "Collection Name #1"
                    nftSymbol,
                    nftUri,
                    new BN(isWhiskeyGated ? 0 : currentWhiskeyPrice), // Free for gated, paid for regular
                    new BN(isWhiskeyGated ? 0 : whiskeyRate! * 1_000_000), // Pass rate only for regular collections
                )
                .accounts(accounts)
                .signers([nftMintKeypair])
                .transaction();

            // Add account creation instructions if needed
            if (createPayerAccountIx) {
                console.log('🪙 Adding payer WHISKEY token account creation instruction');
                transaction.instructions.unshift(createPayerAccountIx);
            }
            if (createTreasuryAccountIx) {
                console.log('🏦 Adding treasury WHISKEY token account creation instruction');
                transaction.instructions.unshift(createTreasuryAccountIx);
            }

            // Add compute budget instructions to increase computational limit
            const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: 400_000, // Increase from default ~200k to 400k
            });

            const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 1, // Small priority fee
            });

            // Add compute budget instructions at the beginning (after treasury account if needed)
            transaction.instructions.unshift(computeUnitLimitIx, computeUnitPriceIx);

            // Get fresh blockhash and fee payer
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // Sign the transaction
            transaction.partialSign(nftMintKeypair);
            const signedTransaction = await signTransaction(transaction);

            // Send the transaction with unique signature
            const tx = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 2, // Reduced retries to avoid duplicate transaction issues
            });

            // Confirm the transaction
            const confirmation = await connection.confirmTransaction({
                signature: tx,
                blockhash,
                lastValidBlockHeight,
            }, 'confirmed');

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            setMintMessage(`Mint successful! NFT: ${nftMintKeypair.publicKey.toBase58()}. Recording purchase...`);
            console.log("Mint successful:", nftMintKeypair.publicKey.toBase58(), "Tx:", tx);

            const recordResponse = await fetch('/api/mints/record-purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: publicKey.toBase58(),
                    nftMintAddress: nftMintKeypair.publicKey.toBase58(),
                    collectionMintAddress: collectionMintAccountPk.toBase58(),
                    transactionSignature: tx,
                }),
            });

            if (!recordResponse.ok) {
                const recordError = await recordResponse.json();
                throw new Error(`Failed to record purchase: ${recordError.message || recordResponse.statusText}`);
            }

            setMintMessage("Purchase recorded. Your NFT should appear in your wallet shortly.");
            setDisplayItemsMinted(currentItemsMinted + 1);
            
            // Update wallet NFT count after successful mint
            if (walletNftCount !== null) {
                setWalletNftCount(walletNftCount + 1);
            }
            
            if (onMintSuccess) {
                onMintSuccess(); 
            }
            setTimeout(() => setMintMessage(null), 7000);

        } catch (error: any) {
            console.error("Minting failed:", error);
            console.error("Error type:", typeof error);
            console.error("Error keys:", Object.keys(error));
            if (error.code) console.error("Error code:", error.code);
            if (error.name) console.error("Error name:", error.name);
            
            let errorMsg = error.message;
            
            // Handle specific duplicate transaction error
            if (errorMsg.includes("This transaction has already been processed") || 
                errorMsg.includes("already been processed") ||
                errorMsg.includes("duplicate transaction")) {
                errorMsg = "⚠️ Transaction already submitted. Please wait for the previous transaction to complete and check your wallet.";
                // Don't log this as an error since it's likely a user double-click
                console.warn("Duplicate transaction detected - user may have clicked mint multiple times");
            }
            
            if (error.logs) { // Anchor errors often have logs
                error.logs.forEach((log: string) => console.log(log));
                
                // Check for specific error types
                const walletLimitLog = error.logs.find((log: string) => log.includes("WalletNftLimitExceeded"));
                const whiskeyGatedLimitLog = error.logs.find((log: string) => log.includes("WhiskeyGatedCollectionLimitExceeded"));
                const collectionFullLog = error.logs.find((log: string) => log.includes("CollectionFull"));
                const anchorErrorLog = error.logs.find((log: string) => log.startsWith("Program log: AnchorError"));
                
                if (whiskeyGatedLimitLog) {
                    errorMsg = "❌ Wallet limit exceeded! You can only mint 1 NFT per wallet from whiskey-gated collections.";
                    // Refresh wallet count to ensure UI is in sync
                    if (walletNftCount !== null) {
                        setWalletNftCount(1);
                    }
                } else if (walletLimitLog) {
                    errorMsg = "❌ Wallet limit exceeded! You can only mint 5 NFTs total per wallet.";
                    // Refresh wallet count to ensure UI is in sync
                    if (walletNftCount !== null) {
                        setWalletNftCount(5);
                    }
                } else if (collectionFullLog) {
                    errorMsg = "❌ Collection is sold out! No more NFTs can be minted from this collection.";
                } else if (anchorErrorLog) {
                    errorMsg = anchorErrorLog;
                }
            }
            
            // Check for insufficient SOL balance
            if (errorMsg.toLowerCase().includes('insufficient funds') || 
                errorMsg.toLowerCase().includes('insufficient balance') ||
                errorMsg.toLowerCase().includes('not enough sol') ||
                errorMsg.toLowerCase().includes('insufficient lamports')) {
                
                // Check if it's about SOL or tokens
                if (errorMsg.toLowerCase().includes('whiskey') || errorMsg.toLowerCase().includes('token')) {
                    errorMsg = "❌ Insufficient WHISKEY tokens! Please ensure you have enough tokens to purchase this NFT.";
                } else {
                    errorMsg = "❌ Insufficient SOL! You need at least 0.02 SOL for account creation and transaction fees. Please add more SOL to your wallet.";
                }
            }
            
            setMintMessage(`Minting failed: ${errorMsg}`);
        } finally {
            // Add a brief delay before enabling the button again to prevent rapid clicking
            setTimeout(() => {
                setIsMinting(false);
            }, 1000);
        }
    }, [
        publicKey, connected, signTransaction, signAllTransactions, connection, 
        collectionOnChainAddress, walletNftCount,
        onMintSuccess
    ]);

    const supplyRemaining = displayItemLimit - displayItemsMinted;

    return (
        <div className="group relative bg-slate-900/50 backdrop-blur-xl border border-amber-700/30 rounded-3xl shadow-2xl hover:shadow-amber-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden">
            <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
                {/* Image Aspect Ratio Container */}
                <div className="aspect-w-1 aspect-h-1 w-full h-full">
                    <MediaWithFallback 
                        src={imageUrl || '/placeholder-image.svg'} 
                        alt={`${initialName} collection media`} 
                        className="w-full h-full object-cover"
                    />
                </div>

            </div>

            <div className="p-6 flex flex-col flex-grow">
                <h3 className="mb-3 text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif truncate" title={initialName}>{initialName}</h3>
                
                {/* Stats Section */}
                <div className="font-sans text-sm text-gray-300 space-y-2 mb-6 flex-grow">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-400">Symbol:</span> 
                        <span className="font-bold text-amber-200">{initialSymbol}</span>
                    </div>
                    {/* Price Section - Made More Obvious */}
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 space-y-3">
                        <div className="text-center">
                            <h4 className="text-sm font-bold text-amber-200 uppercase tracking-wide mb-3">NFT Price</h4>
                            
                            {/* USD Price - Primary Display (hidden for whiskey-gated collections) */}
                            {!isWhiskeyGated && (
                                <div className="mb-3">
                                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Price in USD</div>
                                    <div className="text-2xl font-black text-white">
                                        ${mintPriceUsd || 'Not Set'}
                                    </div>
                                </div>
                            )}
                            
                            {/* WHISKEY Price - Secondary Display */}
                            <div className="mb-3">
                                {isWhiskeyGated && requiredWhiskeyAmount ? (
                                    <>
                                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Qualification Required</div>
                                        <div className="text-lg font-bold text-green-300 mb-1">FREE MINT</div>
                                        <div className="text-sm text-amber-300">
                                            Must hold {requiredWhiskeyAmount.toLocaleString()} WHISKEY
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Price in WHISKEY</div>
                                        <div className="text-xl font-bold text-amber-300">
                                            {mintPriceUsd && whiskeyRate ? (
                                                formatWhiskeyTokens(mintPriceUsd / whiskeyRate)
                                            ) : (
                                                'Calculating...'
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* Live Price Indicator */}
                            <div className="flex items-center justify-center space-x-2">
                                {priceLoading && (
                                    <span className="text-xs text-green-400 animate-pulse">🔄 Live Price</span>
                                )}
                                {priceError && (
                                    <span className="text-xs text-red-400">❌ Price Error</span>
                                )}
                                {whiskeyPriceData && !priceLoading && (
                                    <span className="text-xs text-green-400">✅ Live Price</span>
                                )}
                            </div>
                            
                            {/* Helpful Note */}
                            <div className="text-center pt-2 border-t border-amber-700/30">
                                <p className="text-xs text-amber-200/80">
                                    💡 You need WHISKEY tokens to mint this NFT
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* WHISKEY Price Display - Same as admin dashboard */}
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-400">WHISKEY Price:</span> 
                        <div className="flex items-center space-x-2">
                            {priceLoading ? (
                                <span className="text-xs text-gray-400">Loading...</span>
                            ) : priceError ? (
                                <span className="text-xs text-red-400">Error</span>
                            ) : whiskeyPriceData?.usd ? (
                                <span className="font-bold text-green-400">${whiskeyPriceData.usd.toFixed(6)}</span>
                            ) : (
                                <span className="text-xs text-gray-400">No data</span>
                            )}
                        </div>
                    </div>
                    {/* Supply Section with Clear Visual */}
                    <div className="bg-slate-800/30 rounded-xl p-4 space-y-3">
                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Minting Progress</span>
                                <span className="text-xs text-amber-300">
                                    {displayItemLimit > 0 ? Math.round((displayItemsMinted / displayItemLimit) * 100) : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${displayItemLimit > 0 ? (displayItemsMinted / displayItemLimit) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                        
                        {/* Supply Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-lg font-bold text-amber-400">{displayItemsMinted}</div>
                                <div className="text-xs text-gray-400 uppercase">Minted</div>
                            </div>
                            <div>
                                <div className={`text-lg font-bold ${supplyRemaining > 0 ? "text-green-400" : "text-red-400"}`}>
                                    {supplyRemaining > 0 ? supplyRemaining : "0"}
                                </div>
                                <div className="text-xs text-gray-400 uppercase">Left</div>
                            </div>
                            <div>
                                <div className="text-lg font-bold text-white">{displayItemLimit}</div>
                                <div className="text-xs text-gray-400 uppercase">Total</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Information */}
                <div className="mb-6">
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 text-center">
                        <p className="font-bold text-amber-200 text-sm mb-2">Payment Method</p>
                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg py-2 px-4 inline-flex items-center space-x-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M5,4V7H10.5V19H13.5V7H19V4H5Z"/></svg>
                            <span className="font-bold">WHISKEY TOKENS ONLY</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">NFTs can only be purchased with WHISKEY tokens</p>
                    </div>
                </div>

                {/* Wallet Limit Information */}
                {connected && publicKey && !isWhiskeyGated && (
                    <div className="mb-6">
                        <div className={`border rounded-xl p-4 text-center ${
                            walletNftCount !== null && walletNftCount >= 5 
                                ? 'bg-red-900/20 border-red-700/40' 
                                : 'bg-blue-900/20 border-blue-700/40'
                        }`}>
                            <div className="flex items-center justify-center space-x-2 mb-2">
                                <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17M11,9H13V7H11V9Z"/>
                                </svg>
                                <p className="font-bold text-blue-200 text-sm">Wallet Limit</p>
                            </div>
                            {isCheckingWalletLimit ? (
                                <div className="text-sm text-gray-400">Checking wallet limit...</div>
                            ) : walletNftCount !== null ? (
                                <div className="space-y-2">
                                    <div className={`text-lg font-bold ${
                                        walletNftCount >= 5 ? 'text-red-400' : 'text-green-400'
                                    }`}>
                                        {walletNftCount}/5 NFTs Minted
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                walletNftCount >= 5 ? 'bg-red-500' : 'bg-blue-500'
                                            }`}
                                            style={{ width: `${(walletNftCount / 5) * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {walletNftCount >= 5 
                                            ? '🚫 Maximum limit reached across all collections'
                                            : `You can mint ${5 - walletNftCount} more NFTs total`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-400">Unable to check wallet limit</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Whiskey-Gated Collection Information */}
                {isWhiskeyGated && (
                    <div className="mb-6">
                        <div className="bg-amber-900/30 border border-amber-600/50 rounded-xl p-4 text-center">
                            <div className="flex items-center justify-center space-x-2 mb-3">
                                <svg className="w-5 h-5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/>
                                </svg>
                                <p className="font-bold text-amber-200 text-sm">🥃 WHISKEY-GATED COLLECTION</p>
                            </div>
                            
                            <div className="bg-amber-800/40 rounded-lg p-3 mb-3">
                                <p className="text-amber-100 font-semibold text-sm">FREE TO MINT</p>
                                <p className="text-amber-200 text-xs">For qualified WHISKEY holders only</p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-amber-200">Required WHISKEY:</span>
                                    <span className="font-bold text-amber-100">
                                        {requiredWhiskeyAmount.toLocaleString()} tokens
                                    </span>
                                </div>

                                {connected && publicKey && (
                                    <>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-amber-200">Your Balance:</span>
                                            <span className={`font-bold ${
                                                isCheckingWhiskeyBalance ? 'text-gray-400' :
                                                userWhiskeyBalance === null ? 'text-gray-400' :
                                                userWhiskeyBalance >= requiredWhiskeyAmount ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {isCheckingWhiskeyBalance ? 'Checking...' :
                                                 userWhiskeyBalance === null ? 'Unable to check' :
                                                 `${userWhiskeyBalance.toLocaleString()} tokens`
                                                }
                                            </span>
                                        </div>

                                        {userWhiskeyBalance !== null && !isCheckingWhiskeyBalance && (
                                            <div className="mt-2">
                                                {userWhiskeyBalance >= requiredWhiskeyAmount ? (
                                                    <div className="bg-green-900/30 border border-green-600/50 rounded-lg p-2">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                                                            </svg>
                                                            <span className="text-green-300 text-sm font-medium">✅ Eligible to mint!</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-2">
                                                        <div className="flex items-center justify-center space-x-2 mb-1">
                                                            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                                                                <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
                                                            </svg>
                                                            <span className="text-red-300 text-sm font-medium">❌ Insufficient WHISKEY</span>
                                                        </div>
                                                        <p className="text-red-200 text-xs">
                                                            Need {(requiredWhiskeyAmount - userWhiskeyBalance).toLocaleString()} more tokens
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {(!connected || !publicKey) && (
                                    <div className="bg-gray-800/40 rounded-lg p-2">
                                        <p className="text-gray-300 text-xs">Connect wallet to check eligibility</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Collection Supply Warning */}
                {supplyRemaining <= 5 && supplyRemaining > 0 && (
                    <div className="mb-6">
                        <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-3 text-center">
                            <div className="flex items-center justify-center space-x-2 mb-1">
                                <svg className="w-4 h-4 text-orange-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
                                </svg>
                                <p className="font-bold text-orange-200 text-sm">Almost Sold Out!</p>
                            </div>
                            <p className="text-xs text-orange-300">Only {supplyRemaining} NFTs left in this collection!</p>
                        </div>
                    </div>
                )}
                
                {/* Action Button and Status */}
                <div className="mt-auto">
                    <button 
                        onClick={handleMint}
                        disabled={
                            isMinting || 
                            supplyRemaining <= 0 || 
                            !publicKey || 
                            (!isWhiskeyGated && walletNftCount !== null && walletNftCount >= 5) ||
                            (!isWhiskeyGated && isCheckingWalletLimit) ||
                            (isWhiskeyGated && isCheckingWhiskeyBalance) ||
                            (isWhiskeyGated && userWhiskeyBalance !== null && userWhiskeyBalance < requiredWhiskeyAmount) ||
                            (!isWhiskeyGated && (!whiskeyRate || priceLoading))
                        }
                        className={`w-full font-sans font-black text-lg py-4 px-5 rounded-2xl transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 shadow-lg hover:shadow-2xl 
                            ${isMinting || supplyRemaining <= 0 || !publicKey || (!isWhiskeyGated && walletNftCount !== null && walletNftCount >= 5) || (!isWhiskeyGated && isCheckingWalletLimit) || (isWhiskeyGated && isCheckingWhiskeyBalance) || (isWhiskeyGated && userWhiskeyBalance !== null && userWhiskeyBalance < requiredWhiskeyAmount) || (!isWhiskeyGated && (!whiskeyRate || priceLoading))
                                ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                                : isWhiskeyGated 
                                    ? 'text-black bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:scale-105 hover:shadow-amber-400/30 focus:ring-amber-300'
                                    : 'text-black bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:scale-105 hover:shadow-amber-400/30 focus:ring-amber-300'
                            }`}
                    >
                        {isMinting ? "Processing..." : 
                         !isWhiskeyGated && isCheckingWalletLimit ? "Checking Limits..." :
                         isWhiskeyGated && isCheckingWhiskeyBalance ? "Checking WHISKEY Balance..." :
                         isWhiskeyGated && userWhiskeyBalance !== null && userWhiskeyBalance < requiredWhiskeyAmount ? `Need ${(requiredWhiskeyAmount - userWhiskeyBalance).toLocaleString()} More WHISKEY` :
                         !isWhiskeyGated && priceLoading ? "Loading Price..." :
                         !isWhiskeyGated && !whiskeyRate ? "Price Unavailable" :
                         !isWhiskeyGated && (walletNftCount !== null && walletNftCount >= 5) ? "Wallet Limit Reached (5/5)" :
                         (supplyRemaining <= 0 && displayItemLimit > 0) ? "Collection Sold Out" : 
                         isWhiskeyGated ? "🎉 Mint FREE NFT" : "Mint NFT"}
                    </button>
                    {mintMessage && (
                        <p className={`mt-3 text-xs font-sans text-center h-4
                            ${mintMessage.toLowerCase().includes("failed") || mintMessage.toLowerCase().includes("error") 
                                ? 'text-red-400'
                                : mintMessage.toLowerCase().includes("success") || mintMessage.toLowerCase().includes("shortly")
                                    ? 'text-green-400'
                                    : 'text-gray-400'}`}>
                            {mintMessage}
                        </p>
                    )}
                    {!mintMessage && <div className="h-4 mt-3"></div>} {/* Placeholder to prevent layout shift */}
                    
                    {/* Helpful Info for Non-Connected Wallets */}
                    {!connected && (
                        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                            <p className="text-xs text-gray-400 text-center">
                                💡 <strong>Connect your wallet</strong> to {isWhiskeyGated ? 'qualify with WHISKEY tokens and mint NFTs (⚠️ 1 NFT max per wallet)' : 'see your minting limits (5 NFTs max per wallet) and purchase NFTs with WHISKEY tokens'}
                            </p>
                        </div>
                    )}
                    
                    {/* Warning for connected wallets on whiskey-gated collections */}
                    {connected && isWhiskeyGated && (
                        <div className="mt-4 p-3 bg-amber-900/20 rounded-lg border border-amber-700/40">
                            <p className="text-xs text-amber-400 text-center">
                                ⚠️ <strong>Master Distiller Collections:</strong> You can only mint 1 NFT per wallet
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NftCollectionCard;