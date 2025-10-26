"use client";

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import MyNftCard from '@/components/MyNftCard';
import ListNftModal from '@/components/ListNftModal';
import ListedNftCard from '@/components/ListedNftCard';
import CancelListingModal from '@/components/CancelListingModal';
import { toast } from 'react-toastify';
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
  const { connected, wallet, signTransaction } = useWallet();
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
  
  // NFT Retrieval state
  const [isRetrievingNft, setIsRetrievingNft] = useState(false);
  const [nftRetrievalMessage, setNftRetrievalMessage] = useState('');

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
    if (!wallet?.adapter.publicKey || !signTransaction) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsRetrievingNft(true);
    setNftRetrievalMessage('Starting NFT retrieval...');

    try {
      // Transaction details from the user's stuck NFT
      const nftMint = new PublicKey("5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5");
      const seller = new PublicKey("CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n");
      const listingPda = new PublicKey("B2rPo6u8ggHrX3dThBGGVSwJrTLZAQDfdi1VM2tDLPnq");
      const escrowAccount = new PublicKey("DvpcK1zgLcF8rV7Td3GhR7k6TPwy1ujMXEzZFtVcBSuN");
      const marketplaceProgramId = new PublicKey("BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT");

      setNftRetrievalMessage('Creating cancel listing instruction...');

      let cancelInstruction;
      
      try {
        // Try using the existing utility first
        const { getMarketplaceProgram } = await import('@/lib/solanaUtils');
        const program = getMarketplaceProgram();

        cancelInstruction = await program.methods
          .cancelListing()
          .accounts({
            seller: seller,
            listing: listingPda,
            sellerNftTokenAccount: getAssociatedTokenAddressSync(nftMint, seller),
            escrowTokenAccount: escrowAccount,
            nftToListMint: nftMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
          })
          .instruction();
          
        console.log('✅ Successfully created cancel instruction using program methods');
        
      } catch (programError) {
        console.warn('⚠️ Program method failed, trying alternative approach:', programError);
        
        // Fallback: Use the API endpoint instead
        setNftRetrievalMessage('Using alternative retrieval method...');
        
        try {
          const response = await fetch('/api/marketplace/transactions/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sellerAddress: seller.toString(),
              nftMintAddress: nftMint.toString(),
              timestamp: Date.now().toString()
            })
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          const { transaction: serializedTransaction } = await response.json();
          
          // Deserialize the transaction
          const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));
          cancelInstruction = transaction.instructions[0]; // Get the first (and only) instruction
          
          console.log('✅ Successfully created cancel instruction using API fallback');
          
        } catch (apiError) {
          console.error('❌ Both program method and API fallback failed:', apiError);
          throw new Error(`Failed to create cancel instruction: ${apiError.message}`);
        }
      }

      setNftRetrievalMessage('Building transaction...');

      // Create transaction
      const transaction = new Transaction();
      transaction.add(cancelInstruction);

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = seller;

      setNftRetrievalMessage('Signing transaction...');

      // Phantom compatibility: Sign with wallet first, then send raw transaction
      const signedTransaction = await signTransaction(transaction);

      setNftRetrievalMessage('Sending transaction to blockchain...');

      // Send transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        preflightCommitment: 'confirmed'
      });

      setNftRetrievalMessage('Confirming transaction...');

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      toast.success(`NFT retrieved successfully! Transaction: ${signature}`);
      setNftRetrievalMessage('NFT retrieved successfully!');

      // Refresh NFTs after successful retrieval
      setTimeout(() => {
        fetchNfts();
        fetchListings();
      }, 2000);

    } catch (error: any) {
      console.error('Error retrieving NFT:', error);
      toast.error(`Failed to retrieve NFT: ${error.message}`);
      setNftRetrievalMessage(`Error: ${error.message}`);
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

        {/* NFT Recovery Tool */}
        <motion.div 
          className="mb-8 p-6 bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-500/50 rounded-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">🚨 NFT Recovery Tool</h3>
              <p className="text-gray-300 mb-2">
                Retrieve stuck NFT: Master Distiller Rewards #2 (5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5)
              </p>
              {nftRetrievalMessage && (
                <p className="text-sm text-yellow-400">{nftRetrievalMessage}</p>
              )}
            </div>
            <button
              onClick={handleRetrieveStuckNft}
              disabled={isRetrievingNft || !connected}
              className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 ${
                isRetrievingNft || !connected
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white hover:shadow-lg hover:scale-105'
              }`}
            >
              {isRetrievingNft ? 'Retrieving...' : 'Retrieve NFT'}
            </button>
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