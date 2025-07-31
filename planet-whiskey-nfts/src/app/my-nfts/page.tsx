"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MyNftCard from '@/components/MyNftCard';
import ListNftModal from '@/components/ListNftModal';
import ListedNftCard from '@/components/ListedNftCard';
import CancelListingModal from '@/components/CancelListingModal';
import ImageWithFallback from '@/components/ImageWithFallback';
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
  const { connected, wallet } = useWallet();
  const [ownedCollectionNfts, setOwnedCollectionNfts] = useState<SerializableNft[]>([]);
  const [unknownCollectionNfts, setUnknownCollectionNfts] = useState<SerializableNft[]>([]);
  const [listedNfts, setListedNfts] = useState<ListedNft[]>([]);
  const [loading, setLoading] = useState(false);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NftForListing | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingForCancel | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
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
          const owned = result.data.filter((nft: SerializableNft) => nft.isOwnedCollection);
          const unknown = result.data.filter((nft: SerializableNft) => !nft.isOwnedCollection);
          
          // Debug logging to see what image URLs we're getting
          console.log('[my-nfts-page] Owned collection NFTs:', owned.map(nft => ({
            name: nft.name,
            imageUrl: nft.json?.image,
            hasImage: !!nft.json?.image
          })));
          console.log('[my-nfts-page] Unknown collection NFTs:', unknown.map(nft => ({
            name: nft.name,
            imageUrl: nft.json?.image,
            hasImage: !!nft.json?.image
          })));
          
          setOwnedCollectionNfts(owned);
          setUnknownCollectionNfts(unknown);
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
      setUnknownCollectionNfts([]);
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
    const nft = [...ownedCollectionNfts, ...unknownCollectionNfts].find(n => n.address === mintAddress);
    if (nft) {
      setSelectedNft({
        mintAddress: nft.address,
        name: nft.json?.name || nft.name,
        imageUrl: nft.json?.image || '',
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
                    const imageUrl = nft.json?.image || '';
                    console.log(`[my-nfts-page] Rendering MyNftCard for ${nft.name} with imageUrl:`, imageUrl);
                    return (
                      <MyNftCard
                        key={nft.address}
                        mintAddress={nft.address}
                        name={nft.json?.name || nft.name}
                        imageUrl={imageUrl}
                        collectionName={nft.collectionName}
                        collectionMintAddress={nft.collectionMintAddress}
                        onList={handleOpenListModal}
                      />
                    );
                  })}
                </div>
              </motion.div>
            )}

            {unknownCollectionNfts.length > 0 && (
              <motion.div 
                className="mb-12"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <h2 className="text-2xl font-bold text-white mb-4">
                  Other NFTs ({unknownCollectionNfts.length})
                </h2>
                <p className="text-amber-200 mb-6">
                  These NFTs are not from Planet Whiskey collections and cannot be listed on our marketplace.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {unknownCollectionNfts.map((nft) => (
                      <div key={nft.address} className="group relative bg-slate-900/50 backdrop-blur-xl border border-amber-700/30 rounded-3xl shadow-2xl hover:shadow-amber-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden opacity-60">
                        <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
                          {/* Image Aspect Ratio Container - same as NftCollectionCard */}
                          <div className="aspect-w-1 aspect-h-1 w-full h-full">
                            <ImageWithFallback
                              src={nft.json?.image || '/placeholder-image.svg'}
                              alt={`${nft.json?.name || nft.name} image`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"></div>
                          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                            {nft.collectionName}
                          </div>
                        </div>
                        <div className="p-6 flex flex-col flex-grow">
                          <h3 className="mb-3 text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif truncate" title={nft.json?.name || nft.name}>
                            {nft.json?.name || nft.name}
                          </h3>
                          <div className="font-sans text-sm text-gray-300 space-y-2 mb-6 flex-grow">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-400">Collection:</span> 
                              <span className="font-bold text-amber-200">{nft.collectionName}</span>
                            </div>
                            <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-center">
                              <p className="font-bold text-red-200 text-sm">Not Listable</p>
                              <p className="text-xs text-gray-400 mt-2">This NFT is not from a Planet Whiskey collection</p>
                            </div>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              </motion.div>
            )}

            {(!loading && ownedCollectionNfts.length === 0 && unknownCollectionNfts.length === 0 && listedNfts.length === 0) && (
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