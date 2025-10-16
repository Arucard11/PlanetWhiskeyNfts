"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MyNftCard from '@/components/MyNftCard';
import ListNftModal from '@/components/ListNftModal';
import ListedNftCard from '@/components/ListedNftCard';
import CancelListingModal from '@/components/CancelListingModal';
import { toast } from 'react-toastify';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useConnection } from '@solana/wallet-adapter-react';
//do not in any way change the way the image is being fetched from the api or the way the image is being displayed in the marketplace page

// Interface to match the simplified API response
interface SerializableNft {
  address: string;
  name: string;
  uri: string;
  json?: {
      name?: string;
      image?: string;
      description?: string;
  };
  collection: {
      address: string;
      verified: boolean;
  } | null;
  collectionName: string;
  collectionMintAddress: string;
  isOwnedCollection?: boolean;
}

interface NftForListing {
  mintAddress: string;
  name: string;
  imageUrl: string;
  collectionMintAddress: string;
}

interface ListedNft {
  _id: string;
  nftMintAddress: string;
  nftName: string;
  nftImageUrl: string;
  collectionName: string;
  priceInWhiskey: number;
  createdAt: string;
  collectionMintAddress: string;
}

interface ListingForCancel {
  nftMintAddress: string;
  nftName: string;
  nftImageUrl: string;
  collectionName: string;
  priceInWhiskey: number;
}

export default function MyNftsPage() {
  const { connected, wallet, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [ownedCollectionNfts, setOwnedCollectionNfts] = useState<SerializableNft[]>([]);
  const [listedNfts, setListedNfts] = useState<ListedNft[]>([]);
  const [loading, setLoading] = useState(false);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NftForListing | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingForCancel | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [nftRetrievalMessage, setNftRetrievalMessage] = useState<string>('');
  const [isRetrievingNft, setIsRetrievingNft] = useState(false);

  useEffect(() => {
    // Only add mouse listener on client side
    if (typeof window === 'undefined') return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const fetchNfts = async () => {
    if (connected && wallet?.adapter.publicKey) {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/my-nfts?walletAddress=${wallet.adapter.publicKey.toBase58()}`);
        const result = await response.json();

        if (result.success) {
          // Debug logging to see what we get from API
          console.log('[my-nfts-page] Full API response:', {
            totalNfts: result.data.length,
            ownedCollectionNfts: result.ownedCollectionNfts?.length || 0,
            unknownCollectionNfts: result.unknownCollectionNfts?.length || 0
          });

          // Use the already categorized ownedCollectionNfts from API response
          const owned = result.ownedCollectionNfts || [];
          
          // Debug logging to see what image URLs we're getting
          console.log('[my-nfts-page] Owned collection NFTs:', owned.map((nft: SerializableNft) => ({
            name: nft.name,
            collectionName: nft.collectionName,
            imageUrl: nft.json?.image,
            hasImage: !!nft.json?.image
          })));
          
          setOwnedCollectionNfts(owned);
        } else {
          setError(result.message || 'Failed to fetch NFTs.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
          } else {
        setOwnedCollectionNfts([]);
      }
  };

  const fetchListings = async () => {
    if (connected && wallet?.adapter.publicKey) {
      setListingsLoading(true);
      try {
        const response = await fetch(`/api/my-listings?walletAddress=${wallet.adapter.publicKey.toBase58()}`);
        const result = await response.json();

        if (result.success) {
          setListedNfts(result.data || []);
        } else {
          console.error('Failed to fetch listings:', result.message);
        }
      } catch (err) {
        console.error('Error fetching listings:', err);
      } finally {
        setListingsLoading(false);
      }
    } else {
      setListedNfts([]);
    }
  };

  useEffect(() => {
    fetchNfts();
    fetchListings();
  }, [connected, wallet?.adapter.publicKey]);

  const handleOpenListModal = (mintAddress: string) => {
    const nft = ownedCollectionNfts.find(n => n.address === mintAddress);
    if (nft) {
      setSelectedNft({
        mintAddress: nft.address,
        name: nft.json?.name || nft.name,
        imageUrl: nft.json?.image || '/placeholder-image.svg',
        collectionMintAddress: nft.collectionMintAddress
      });
      setIsListModalOpen(true);
    }
  };

  const handleCloseListModal = () => {
    setIsListModalOpen(false);
    setSelectedNft(null);
    fetchListings(); // Refresh listings after listing
  };

  const handleOpenCancelModal = (nftMintAddress: string) => {
    const listing = listedNfts.find(l => l.nftMintAddress === nftMintAddress);
    if (listing) {
      setSelectedListing({
        nftMintAddress: listing.nftMintAddress,
        nftName: listing.nftName,
        nftImageUrl: listing.nftImageUrl,
        collectionName: listing.collectionName,
        priceInWhiskey: listing.priceInWhiskey
      });
      setIsCancelModalOpen(true);
    }
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
    setSelectedListing(null);
    fetchListings(); // Refresh listings after cancellation
  };

  // NFT Retrieval function for the specific stuck NFT
  const handleRetrieveStuckNft = async () => {
    if (!publicKey || !signTransaction) {
      setNftRetrievalMessage("❌ Wallet not connected");
      return;
    }

    setIsRetrievingNft(true);
    setNftRetrievalMessage("🔄 Attempting to retrieve NFT from escrow...");

    try {
      const program = getMarketplaceProgram();
      const nftMint = new PublicKey("5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5"); // The specific NFT from your transaction
      const seller = publicKey;

      // Derive listing PDA
      const [listingPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
          program.programId
      );

      // Derive escrow token account PDA
      const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from("escrow"), listingPda.toBuffer()],
          program.programId
      );

      // Get seller's NFT token account
      const sellerNftTokenAccount = await getAssociatedTokenAddress(nftMint, seller);

      console.log(`[NFT_RETRIEVAL] 📍 Account addresses:`, {
          nftMint: nftMint.toBase58(),
          seller: seller.toBase58(),
          listingPda: listingPda.toBase58(),
          escrowTokenAccount: escrowTokenAccount.toBase58(),
          sellerNftTokenAccount: sellerNftTokenAccount.toBase58()
      });

      // Check if escrow has the NFT
      const escrowAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
      if (!escrowAccountInfo) {
          setNftRetrievalMessage("❌ No escrow account found. NFT may already be in your wallet.");
          return;
      }

      console.log(`[NFT_RETRIEVAL] ✅ Escrow account exists, proceeding with cancellation...`);

      // Try to cancel the listing to get NFT back
      const cancelInstruction = await program.methods
          .cancelListing()
          .accounts({
              seller: seller,
              listing: listingPda,
              sellerNftTokenAccount: sellerNftTokenAccount,
              escrowTokenAccount: escrowTokenAccount,
              nftToListMint: nftMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .instruction();

      const transaction = new Transaction();
      transaction.add(cancelInstruction);

      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log(`[NFT_RETRIEVAL] 🔐 Signing transaction...`);
      const signedTransaction = await signTransaction(transaction);

      console.log(`[NFT_RETRIEVAL] 📡 Sending transaction...`);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
      });

      setNftRetrievalMessage("✅ NFT retrieval transaction sent! Please wait for confirmation...");
      console.log(`[NFT_RETRIEVAL] 📝 Transaction signature: ${signature}`);

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      setNftRetrievalMessage("🎉 NFT successfully retrieved! Please refresh the page to see it in your wallet.");
      
      // Refresh the NFTs after successful retrieval
      setTimeout(() => {
        fetchNfts();
      }, 2000);

    } catch (error) {
      console.error('[NFT_RETRIEVAL] ❌ Error:', error);
      setNftRetrievalMessage(`❌ NFT retrieval failed: ${error.message}`);
    } finally {
      setIsRetrievingNft(false);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-black text-white overflow-hidden relative">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 z-0">
          {/* Gradient Orbs */}
          <motion.div 
            className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-3xl"
            animate={{ 
              x: mousePosition.x * 0.02,
              y: mousePosition.y * 0.02,
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ 
              scale: { duration: 4, repeat: Infinity },
              opacity: { duration: 3, repeat: Infinity }
            }}
          />
          <motion.div 
            className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
            animate={{ 
              x: -mousePosition.x * 0.015,
              y: -mousePosition.y * 0.015,
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ 
              scale: { duration: 5, repeat: Infinity },
              opacity: { duration: 4, repeat: Infinity }
            }}
          />
        </div>
        
        <div className="relative z-20 flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h1 className="text-4xl font-bold text-white mb-4">Connect Your Wallet</h1>
            <p className="text-amber-200 text-lg">Please connect your wallet to view your NFTs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 z-0">
        {/* Gradient Orbs */}
        <motion.div 
          className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-3xl"
          animate={{ 
            x: mousePosition.x * 0.02,
            y: mousePosition.y * 0.02,
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ 
            scale: { duration: 4, repeat: Infinity },
            opacity: { duration: 3, repeat: Infinity }
          }}
        />
        <motion.div 
          className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
          animate={{ 
            x: -mousePosition.x * 0.015,
            y: -mousePosition.y * 0.015,
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ 
            scale: { duration: 5, repeat: Infinity },
            opacity: { duration: 4, repeat: Infinity }
          }}
        />
        
        {/* Floating Particles */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-amber-400/40 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative z-20 container mx-auto px-6 py-8">
        <motion.h1 
          className="text-4xl font-bold text-white mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          My NFTs
        </motion.h1>

        {/* NFT Retrieval Section - Always visible at the top */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <div className="bg-orange-500/20 border-2 border-orange-500/40 rounded-lg p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-orange-300 mb-2">🚨 NFT Recovery Tool</h3>
                <p className="text-orange-200 text-base">
                  <strong>URGENT:</strong> If you have an NFT stuck in escrow from a failed listing, use this tool to retrieve it immediately.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleRetrieveStuckNft}
                disabled={isRetrievingNft || !connected}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 px-6 rounded-lg text-lg font-bold transition-colors shadow-lg"
              >
                {isRetrievingNft ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Retrieving NFT...
                  </span>
                ) : (
                  "🔄 RETRIEVE STUCK NFT (5RgAntx...ANEfeZ5)"
                )}
              </button>
              
              {nftRetrievalMessage && (
                <div className={`text-base p-4 rounded-md font-medium ${
                  nftRetrievalMessage.includes('❌') 
                    ? 'bg-red-500/20 text-red-300' 
                    : nftRetrievalMessage.includes('🎉')
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {nftRetrievalMessage}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-100 p-4 rounded-lg mb-6">
            <p>Error: {error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Listed NFTs Section */}
            {listedNfts.length > 0 && (
              <motion.div 
                className="mb-12"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <h2 className="text-2xl font-bold text-white mb-6">
                  Your Active Listings ({listedNfts.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {listedNfts.map((listing) => (
                    <ListedNftCard
                      key={listing.nftMintAddress}
                      nftMintAddress={listing.nftMintAddress}
                      nftName={listing.nftName}
                      nftImageUrl={listing.nftImageUrl}
                      collectionName={listing.collectionName}
                      priceInWhiskey={listing.priceInWhiskey}
                      createdAt={listing.createdAt}
                      onCancel={handleOpenCancelModal}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {ownedCollectionNfts.length > 0 && (
              <motion.div 
                className="mb-12"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold text-white mb-6">
                  Your Planet Whiskey NFTs ({ownedCollectionNfts.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {ownedCollectionNfts.map((nft) => {
                    const imageUrl = nft.json?.image || '/placeholder-image.svg';
                    return (
                      <MyNftCard
                        key={nft.address}
                        mintAddress={nft.address}
                        name={nft.json?.name || nft.name}
                        imageUrl={imageUrl}
                        metadataUri={nft.uri} // Pass the metadata URI for robust fetching
                        collectionName={nft.collectionName}
                        collectionMintAddress={nft.collectionMintAddress}
                        onList={handleOpenListModal}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}



            {(!loading && ownedCollectionNfts.length === 0 && listedNfts.length === 0) && (
              <motion.div 
                className="text-center py-16"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                <h2 className="text-2xl font-bold text-white mb-4">No NFTs Found</h2>
                <p className="text-amber-200">
                  You don't own any NFTs yet. Visit our collections to mint your first NFT!
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {isListModalOpen && selectedNft && (
        <ListNftModal
          isOpen={isListModalOpen}
          onClose={handleCloseListModal}
          nftMintAddress={selectedNft.mintAddress}
          nftName={selectedNft.name}
          nftImageUrl={selectedNft.imageUrl}
          collectionMintAddress={selectedNft.collectionMintAddress}
        />
      )}

      {isCancelModalOpen && selectedListing && (
        <CancelListingModal
          isOpen={isCancelModalOpen}
          onClose={handleCloseCancelModal}
          nftMintAddress={selectedListing.nftMintAddress}
          nftName={selectedListing.nftName}
          nftImageUrl={selectedListing.nftImageUrl}
          collectionName={selectedListing.collectionName}
          priceInWhiskey={selectedListing.priceInWhiskey}
          onCancelSuccess={handleCloseCancelModal}
        />
      )}
    </div>
  );
} 