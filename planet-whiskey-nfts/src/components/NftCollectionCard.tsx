"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
// import { Metaplex, walletAdapterIdentity } from '@metaplex-foundation/js'; // No longer directly using Metaplex.nfts().create()
import { PublicKey, SystemProgram, Keypair, SYSVAR_RENT_PUBKEY, ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js';
// import * as anchor from '@coral-xyz/anchor'; // Removed
import { Program, AnchorProvider, type Wallet, BN, type Idl, web3 } from '@coral-xyz/anchor'; // Modified: Added BN and Idl type
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

// Assuming your IDL and program types are here - adjust path as necessary
import { Whiskeyprogram } from '@/lib/idl/solana_program';
import idl from '@/lib/idl/whiskeyprogram.json';
// import { Whiskeyprogram as WhiskeyprogramType } from '@/types/whiskeyprogram'; // REMOVED: Assuming a type file
// import idlJson from '@/lib/idl/whiskeyprogram.json'; // Old alias import
// import idlJson from '../lib/idl/whiskeyprogram.json'; // Use relative path // REMOVE THIS LINE

// Ensure your program ID is correctly sourced, e.g., from an environment variable or a constants file
const WHISKEY_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID || "8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L");

// MPL_TOKEN_METADATA_PROGRAM_ID is already imported from @metaplex-foundation/mpl-token-metadata

// IPFS Gateways for fallback
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/'
];

// Component for handling image loading with multiple gateway fallbacks
interface ImageWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
    src, 
    alt, 
    className = '', 
    onLoad, 
    onError 
}) => {
    const [imageSrc, setImageSrc] = useState<string>(src);
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isLoadingImage, setIsLoadingImage] = useState(true);

    // Convert IPFS URI to our proxy URL to avoid CORS issues
    const convertIpfsUri = (uri: string): string => {
        if (!uri.startsWith('ipfs://')) return uri;
        const hash = uri.slice(7); // Remove 'ipfs://' prefix
        return `/api/ipfs-proxy?hash=${hash}`;
    };

    const fetchImageAsBlob = async (url: string): Promise<string | null> => {
        try {
            console.log(`[ImageWithFallback] Attempting to fetch image: ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            console.log(`[ImageWithFallback] Successfully fetched and created blob URL for: ${url}`);
            return objectUrl;
        } catch (error) {
            console.warn(`[ImageWithFallback] Failed to fetch ${url}:`, error);
            return null;
        }
    };

    useEffect(() => {
        let isMounted = true;
        let objectUrl: string | null = null;

        const loadImage = async () => {
            if (!src || src === '/placeholder-image.svg') {
                if (isMounted) {
                    setImageSrc('/placeholder-image.svg');
                    setImageError(false);
                    setImageLoaded(true);
                    setIsLoadingImage(false);
                }
                return;
            }

            setIsLoadingImage(true);
            setImageError(false);
            setImageLoaded(false);

            try {
                if (src.startsWith('http://') || src.startsWith('https://')) {
                    // Direct HTTP/HTTPS URL
                    const img = new window.Image();
                    img.onload = () => {
                        if (isMounted) {
                            setImageSrc(src);
                            setImageLoaded(true);
                            setImageError(false);
                            setIsLoadingImage(false);
                            console.log(`[ImageWithFallback] Successfully loaded direct URL: ${src}`);
                        }
                    };
                    img.onerror = () => {
                        if (isMounted) {
                            console.warn(`[ImageWithFallback] Failed to load direct URL: ${src}`);
                            setImageSrc('/placeholder-image.svg');
                            setImageError(true);
                            setImageLoaded(true);
                            setIsLoadingImage(false);
                        }
                    };
                    img.src = src;
                } else if (src.startsWith('ipfs://')) {
                    // IPFS URL - use our proxy to avoid CORS issues
                    const proxyUrl = convertIpfsUri(src);
                    console.log(`[ImageWithFallback] Using IPFS proxy: ${proxyUrl}`);
                    
                    const img = new window.Image();
                    img.onload = () => {
                        if (isMounted) {
                            setImageSrc(proxyUrl);
                            setImageLoaded(true);
                            setImageError(false);
                            setIsLoadingImage(false);
                            console.log(`[ImageWithFallback] Successfully loaded IPFS via proxy: ${proxyUrl}`);
                        }
                    };
                    img.onerror = () => {
                        if (isMounted) {
                            console.warn(`[ImageWithFallback] IPFS proxy failed for: ${src}`);
                            setImageSrc('/placeholder-image.svg');
                            setImageError(true);
                            setImageLoaded(true);
                            setIsLoadingImage(false);
                        }
                    };
                    img.src = proxyUrl;
                } else {
                    // Relative or other URL
                    const img = new window.Image();
                    img.onload = () => {
                        if (isMounted) {
                            setImageSrc(src);
                            setImageLoaded(true);
                            setImageError(false);
                            setIsLoadingImage(false);
                        }
                    };
                    img.onerror = () => {
                        if (isMounted) {
                            setImageSrc('/placeholder-image.svg');
                            setImageError(true);
                            setImageLoaded(true);
                            setIsLoadingImage(false);
                        }
                    };
                    img.src = src;
                }
            } catch (error) {
                console.error(`[ImageWithFallback] Unexpected error loading image:`, error);
                if (isMounted) {
                    setImageSrc('/placeholder-image.svg');
                    setImageError(true);
                    setImageLoaded(true);
                    setIsLoadingImage(false);
                }
            }
        };

        loadImage();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [src]);

    const handleImageLoad = () => {
        setImageLoaded(true);
        setIsLoadingImage(false);
        console.log(`[ImageWithFallback] Image loaded successfully: ${imageSrc}`);
        if (onLoad) onLoad();
    };

    const handleImageError = () => {
        console.warn(`[ImageWithFallback] Image failed to load: ${imageSrc}`);
        if (!imageError && imageSrc !== '/placeholder-image.svg') {
            setImageSrc('/placeholder-image.svg');
            setImageError(true);
        }
        setIsLoadingImage(false);
        if (onError) onError();
    };

    return (
        <div className={`relative ${className}`}>
            <img
                src={imageSrc}
                alt={alt}
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{ 
                    opacity: imageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out'
                }}
            />
            {/* Show a subtle loading indicator only if still loading */}
            {isLoadingImage && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80">
                    <div className="animate-pulse w-8 h-8 bg-gray-300 rounded-full"></div>
                </div>
            )}
        </div>
    );
};

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
    itemLimit: number;
    companyId: string; 
    isActive: boolean;
    createdAt: Date;
    updatedAt?: Date; 
    itemsMintedOnChain?: number; // This is crucial, fetched live
    authority: string; // Public key string of the collection authority (for receiving mint fees)
    bump: number; // Bump for the CollectionConfig PDA
}

export interface NftCollectionCardProps {
    _id: string; 
    collectionOnChainAddress: string; 
    name: string;                     
    symbol: string;                   
    metadataUri: string;              
    mintPriceLamports: number; 
    mintPriceWhiskeyTokens: number;   // Add whiskey token price
    itemLimit: number; 
    itemsMintedOnChain?: number; 
    onMintSuccess?: () => void; 
}

async function getCollectionImageFromMetadata(metadataUri: string): Promise<string | undefined> {
    try {
        console.log(`[NftCollectionCard] ⭐ Starting image fetch for metadataUri: "${metadataUri}"`);
        if (!metadataUri) {
            console.warn("[NftCollectionCard] ❌ metadataUri is undefined or empty.");
            return undefined;
        }

        let effectiveUri = metadataUri;
        // If it's an IPFS URI, use our proxy to avoid CORS issues
        if (metadataUri.startsWith("ipfs://")) {
            const ipfsHash = metadataUri.substring("ipfs://".length);
            // Use our IPFS proxy
            effectiveUri = `/api/ipfs-proxy?hash=${ipfsHash}`;
            console.log(`[NftCollectionCard] 🔗 Converting IPFS URI to proxy: ${effectiveUri}`);
        } else {
            // For non-IPFS URIs, we can still use them directly if they are https.
            if (!metadataUri.startsWith("https://")) {
                console.warn(`[NftCollectionCard] ⚠️ Metadata URI is not IPFS and not HTTPS: "${metadataUri}". Cannot fetch.`);
                return undefined;
            }
            console.log(`[NftCollectionCard] 🌐 Using direct HTTPS URI: ${effectiveUri}`);
        }
        
        // For IPFS, we only need one try since our proxy handles fallbacks
        const gateways = [effectiveUri];

        let metadata: any = null;
        let lastError = null;

        for (const gatewayUri of gateways) {
            try {
                console.log(`[NftCollectionCard] 📥 Fetching metadata from: ${gatewayUri}`);
                const response = await fetch(gatewayUri);
                if (response.ok) {
                    metadata = await response.json();
                    console.log(`[NftCollectionCard] ✅ Successfully fetched metadata from: ${gatewayUri}`);
                    break;
                } else {
                    console.warn(`[NftCollectionCard] ⚠️ Gateway ${gatewayUri} returned ${response.status}: ${response.statusText}`);
                }
            } catch (error: any) {
                console.warn(`[NftCollectionCard] ⚠️ Gateway ${gatewayUri} failed:`, error.message);
                lastError = error;
                continue;
            }
        }

        if (!metadata) {
            console.error(`[NftCollectionCard] ❌ All gateways failed. Last error:`, lastError);
            return undefined;
        }

        console.log("[NftCollectionCard] 📄 Fetched metadata:", metadata);

        let imageUrl = metadata.image || metadata.image_url;
        if (!imageUrl) {
            console.warn(`[NftCollectionCard] ⚠️ 'image' or 'image_url' not found in metadata.`);
            console.log(`[NftCollectionCard] 📝 Available metadata keys:`, Object.keys(metadata));
            return undefined;
        }
        console.log(`[NftCollectionCard] 🖼️ Found image URL in metadata: "${imageUrl}"`);

        // If the image URL itself is IPFS, convert it using our proxy
        if (imageUrl.startsWith("ipfs://")) {
             const imageIpfsHash = imageUrl.substring("ipfs://".length);
             imageUrl = `/api/ipfs-proxy?hash=${imageIpfsHash}`;
             console.log(`[NftCollectionCard] 🔄 Converted IPFS image URL to proxy: "${imageUrl}"`);
        }
        
        console.log(`[NftCollectionCard] ✅ Final image URL: "${imageUrl}"`);
        return imageUrl;
    } catch (error) {
        console.error("[NftCollectionCard] ❌ Error in getCollectionImageFromMetadata:", error);
        return undefined;
    }
}

const NftCollectionCard: React.FC<NftCollectionCardProps> = ({ 
    _id, 
    collectionOnChainAddress, 
    name: initialName, 
    symbol: initialSymbol,
    metadataUri, 
    mintPriceLamports: initialMintPriceLamports, 
    mintPriceWhiskeyTokens: initialMintPriceWhiskeyTokens,
    itemLimit: initialItemLimit,
    itemsMintedOnChain: initialItemsMintedOnChain = 0,
    onMintSuccess
}) => {
    // Debug log the props received by this component
    console.log(`[NftCollectionCard] 🎯 Component initialized for collection:`, {
        name: initialName,
        _id,
        collectionOnChainAddress,
        metadataUri,
        mintPriceLamports: initialMintPriceLamports,
        mintPriceWhiskeyTokens: initialMintPriceWhiskeyTokens,
        itemLimit: initialItemLimit,
        itemsMintedOnChain: initialItemsMintedOnChain
    });

    const { connection } = useConnection();
    const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();
    const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [isMinting, setIsMinting] = useState(false);
    const [mintMessage, setMintMessage] = useState<string | null>(null);

    const [displayItemsMinted, setDisplayItemsMinted] = useState(initialItemsMintedOnChain);
    const [displayItemLimit, setDisplayItemLimit] = useState(initialItemLimit);
    const [walletNftCount, setWalletNftCount] = useState<number | null>(null);
    const [isCheckingWalletLimit, setIsCheckingWalletLimit] = useState(false);
    
    // Price display effect - only show whiskey token price
    const [displayPriceFormatted, setDisplayPriceFormatted] = useState<string>('');
    
    // Price display effect - only show whiskey token price
    useEffect(() => {
        setDisplayPriceFormatted(`${(initialMintPriceWhiskeyTokens / 1e9).toFixed(0)} WHISKEY`);
    }, [initialMintPriceWhiskeyTokens]);

    // Effect to check wallet NFT count when wallet connects
    useEffect(() => {
        const checkWalletNftCount = async () => {
            if (!publicKey || !connected) {
                setWalletNftCount(null);
                return;
            }

            setIsCheckingWalletLimit(true);
            try {
                // Create wallet counter PDA to check current count
                const seeds = [
                    Buffer.from("wallet_nft_counter"),
                    publicKey.toBuffer(),
                ];
                const [walletNftCounterPda] = PublicKey.findProgramAddressSync(
                    seeds,
                    WHISKEY_PROGRAM_ID
                );

                // Try to fetch the account
                const accountInfo = await connection.getAccountInfo(walletNftCounterPda);
                
                if (accountInfo) {
                    // Account exists, parse the nft_count (it's at offset 40: 8 discriminator + 32 wallet pubkey)
                    const nftCount = accountInfo.data.readUInt8(40);
                    setWalletNftCount(nftCount);
                    console.log(`[WalletLimit] Wallet ${publicKey.toBase58()} has minted ${nftCount}/5 NFTs`);
                } else {
                    // Account doesn't exist, user hasn't minted any NFTs yet
                    setWalletNftCount(0);
                    console.log(`[WalletLimit] Wallet ${publicKey.toBase58()} has minted 0/5 NFTs (no counter account)`);
                }
            } catch (error) {
                console.error('[WalletLimit] Error checking wallet NFT count:', error);
                setWalletNftCount(null);
            } finally {
                setIsCheckingWalletLimit(false);
            }
        };

        checkWalletNftCount();
    }, [publicKey, connected, connection]);

    // Effect for loading image only when metadataUri changes
    useEffect(() => {
        let isMounted = true;
        
        // Reset image URL and set loading state only when metadataUri changes
        setImageUrl(undefined);
        setIsImageLoading(true);
        
        if (metadataUri) {
            console.log(`[NftCollectionCard] Loading image for collection: ${initialName}, metadataUri: ${metadataUri}`);
            getCollectionImageFromMetadata(metadataUri).then(imgUrl => {
                if (isMounted) {
                    if (imgUrl) {
                        console.log(`[NftCollectionCard] Image loaded for ${initialName}: ${imgUrl}`);
                        setImageUrl(imgUrl);
                    } else {
                        console.warn(`[NftCollectionCard] No image found for ${initialName}`);
                        setImageUrl(''); // Set empty string to trigger ImageWithFallback error state
                    }
                    setIsImageLoading(false);
                }
            }).catch(error => {
                if (isMounted) {
                    console.error(`[NftCollectionCard] Error loading image for ${initialName}:`, error);
                    setImageUrl(''); // Set empty string to trigger ImageWithFallback error state
                    setIsImageLoading(false);
                }
            });
        } else {
            console.warn(`[NftCollectionCard] No metadataUri provided for collection: ${initialName}`);
            setImageUrl(''); // Set empty string to trigger ImageWithFallback error state
            setIsImageLoading(false);
        }

        return () => { isMounted = false; };
    }, [metadataUri, initialName]); // Only depend on metadataUri and name

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

        // Check wallet NFT limit before proceeding
        if (walletNftCount !== null && walletNftCount >= 5) {
            setMintMessage("❌ Wallet limit reached! You can only mint 5 NFTs total per wallet across all collections.");
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

            // Create program instance using the JSON IDL with proper type casting
            console.log("[NftCollectionCard] Program ID before Program creation:", WHISKEY_PROGRAM_ID.toBase58());
            const program = new Program<Whiskeyprogram>(idl, provider);

            const collectionConfigPda = new PublicKey(collectionOnChainAddress); // This is liveCollectionData.collectionOnChainAddress
            const collectionMintAccountPk = new PublicKey(liveCollectionData.collectionMintAddress);
            const collectionAuthorityReceiverPk = new PublicKey(liveCollectionData.authority);


            // Prepare NFT-specific metadata
            const mintNumber = new BN(currentItemsMinted).add(new BN(1)).toNumber();
            const nftName = `${liveCollectionData.name} #${mintNumber}`; 
            const nftSymbol = liveCollectionData.symbol;
            
            setMintMessage("Creating unique NFT metadata...");
            
            // Get the actual image URL from the base metadata
            let actualImageUrl = liveCollectionData.nftBaseMetadataUri; // Default fallback
            let baseNftDescription = `${liveCollectionData.name} - Edition #${mintNumber}. A premium treasury NFT from our exclusive collection.`; // Default fallback
            
            try {
                console.log(`[NFT_MINT] Fetching base metadata to extract image URL and description from: ${liveCollectionData.nftBaseMetadataUri}`);
                
                // Convert IPFS URI to gateway URL for fetching
                const baseMetadataUrl = liveCollectionData.nftBaseMetadataUri.startsWith('ipfs://') 
                    ? liveCollectionData.nftBaseMetadataUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
                    : liveCollectionData.nftBaseMetadataUri;
                    
                const baseMetadataResponse = await fetch(baseMetadataUrl);
                if (baseMetadataResponse.ok) {
                    const baseMetadata = await baseMetadataResponse.json();
                    
                    // Extract image URL if available
                    if (baseMetadata.image) {
                        actualImageUrl = baseMetadata.image;
                        console.log(`[NFT_MINT] Successfully extracted image URL: ${actualImageUrl}`);
                    } else {
                        console.warn(`[NFT_MINT] No image field found in base metadata, using metadata URI as fallback`);
                    }
                    
                    // Extract and use admin's description instead of hardcoded one
                    if (baseMetadata.description) {
                        baseNftDescription = baseMetadata.description;
                        console.log(`[NFT_MINT] Successfully extracted admin's description: ${baseNftDescription}`);
                    } else {
                        console.warn(`[NFT_MINT] No description field found in base metadata, using default fallback`);
                    }
                } else {
                    console.warn(`[NFT_MINT] Failed to fetch base metadata (${baseMetadataResponse.status}), using fallback values`);
                }
            } catch (error) {
                console.warn(`[NFT_MINT] Error extracting data from base metadata:`, error);
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
                        { trait_type: "Rarity", value: mintNumber <= 10 ? "Legendary" : mintNumber <= 50 ? "Rare" : "Common" }
                    ],
                    collectionName: liveCollectionData.name,
                    collectionFamily: liveCollectionData.name,
                    mintNumber: mintNumber
                })
            });

            if (!metadataResponse.ok) {
                throw new Error(`Failed to create NFT metadata: ${metadataResponse.statusText}`);
            }

            const metadataResult = await metadataResponse.json();
            const nftUri = metadataResult.metadataUri;
            
            setMintMessage(`Metadata created: ${nftUri}`);


            const nftMintKeypair = web3.Keypair.generate();

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
            
            // TODO: Implement proper whiskey token account handling
            const WHISKEY_TOKEN_MINT_PK = new PublicKey("Hjy8sNxUneizfMaWKXmdaTrKxw8C6AchBNHu2jfXFkfu");
            
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
            
            // Check if payer's whiskey token account exists and has sufficient balance
            try {
                const payerTokenAccountInfo = await connection.getTokenAccountBalance(payerWhiskeyTokenAccount);
                console.log(`Payer whiskey token balance: ${payerTokenAccountInfo.value.uiAmount} WHISKEY`);
                
                if (!payerTokenAccountInfo.value.uiAmount || payerTokenAccountInfo.value.uiAmount < liveCollectionData.mintPriceWhiskeyTokens) {
                    throw new Error(`Insufficient WHISKEY tokens. You have ${payerTokenAccountInfo.value.uiAmount || 0} but need ${liveCollectionData.mintPriceWhiskeyTokens}.`);
                }
            } catch (accountError: any) {
                if (accountError.message.includes('could not find account')) {
                    throw new Error(`WHISKEY token account not found. Please ensure you have WHISKEY tokens in your wallet.`);
                } else if (!accountError.message.includes('Insufficient WHISKEY')) {
                    console.warn('Could not check token balance:', accountError);
                    // Continue with minting - let the program handle the error
                }
            }
            
            // Prepare accounts object with whiskey token accounts
            const accounts = {
                payer: walletAdapter.publicKey,
                collectionConfig: collectionConfigPda,
                collectionMintAccount: collectionMintAccountPk,
                nftMint: nftMintKeypair.publicKey,
                nftMetadataAccount: metadataPda,
                nftMasterEditionAccount: masterEditionPda,
                nftTokenAccount: nftTokenAccountPk,
                collectionAuthorityReceiver: collectionAuthorityReceiverPk,
                whiskeyTokenMint: WHISKEY_TOKEN_MINT_PK,
                payerWhiskeyTokenAccount: payerWhiskeyTokenAccount,
                authorityWhiskeyTokenAccount: authorityWhiskeyTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            };
            
            // Create the transaction with compute budget instructions
            const transaction = await program.methods
                .mintNft(
                    nftName, // Use the properly formatted name: "Collection Name #1"
                    nftSymbol,
                    nftUri,
                )
                .accounts(accounts)
                .signers([nftMintKeypair])
                .transaction();

            // Add compute budget instructions to increase computational limit
            const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: 400_000, // Increase from default ~200k to 400k
            });

            const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 1, // Small priority fee
            });

            // Add compute budget instructions at the beginning
            transaction.instructions.unshift(computeUnitLimitIx, computeUnitPriceIx);

            // Get recent blockhash and fee payer
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;

            // Sign the transaction
            transaction.partialSign(nftMintKeypair);
            const signedTransaction = await signTransaction(transaction);

            // Send the transaction
            const tx = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3,
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
            
            if (error.logs) { // Anchor errors often have logs
                error.logs.forEach((log: string) => console.log(log));
                
                // Check for specific error types
                const walletLimitLog = error.logs.find((log: string) => log.includes("WalletNftLimitExceeded"));
                const collectionFullLog = error.logs.find((log: string) => log.includes("CollectionFull"));
                const anchorErrorLog = error.logs.find((log: string) => log.startsWith("Program log: AnchorError"));
                
                if (walletLimitLog) {
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
            setIsMinting(false);
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
                    <ImageWithFallback 
                        src={imageUrl || '/placeholder-image.svg'} 
                        alt={`${initialName} collection image`} 
                        className="w-full h-full object-cover"
                    />
                </div>
                {isImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
                    </div>
                )}
            </div>

            <div className="p-6 flex flex-col flex-grow">
                <h3 className="mb-3 text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif truncate" title={initialName}>{initialName}</h3>
                
                {/* Stats Section */}
                <div className="font-sans text-sm text-gray-300 space-y-2 mb-6 flex-grow">
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-400">Symbol:</span> 
                        <span className="font-bold text-amber-200">{initialSymbol}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-400">Price:</span> 
                        <span className="font-bold text-amber-200">{displayPriceFormatted}</span>
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
                {connected && publicKey && (
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
                            (walletNftCount !== null && walletNftCount >= 5) ||
                            isCheckingWalletLimit
                        }
                        className={`w-full font-sans font-black text-lg py-4 px-5 rounded-2xl transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 shadow-lg hover:shadow-2xl 
                            ${isMinting || supplyRemaining <= 0 || !publicKey || (walletNftCount !== null && walletNftCount >= 5) || isCheckingWalletLimit
                                ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                                : 'text-black bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 hover:scale-105 hover:shadow-amber-400/30 focus:ring-amber-300'
                            }`}
                    >
                        {isMinting ? "Processing..." : 
                         isCheckingWalletLimit ? "Checking Limits..." :
                         (walletNftCount !== null && walletNftCount >= 5) ? "Wallet Limit Reached (5/5)" :
                         (supplyRemaining <= 0 && displayItemLimit > 0) ? "Collection Sold Out" : 
                         "Mint NFT"}
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
                                💡 <strong>Connect your wallet</strong> to see your minting limits (5 NFTs max per wallet) and purchase NFTs with WHISKEY tokens
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NftCollectionCard;