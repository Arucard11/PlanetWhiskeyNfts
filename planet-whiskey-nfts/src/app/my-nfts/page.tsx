"use client";

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
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
          setListedNfts(result.data);
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
    if (connected) {
      fetchNfts();
      fetchListings();
    }
  }, [connected, wallet]);

  const handleOpenListModal = (mintAddress: string) => {
    const nft = ownedCollectionNfts.find(n => n.address === mintAddress);
    if (!nft) {
      toast.error("NFT not found.");
      return;
    }
    
    if (!nft.collection?.address) {
      toast.error("This NFT is not part of a known collection and cannot be listed.");
      return;
    }
    setSelectedNft({
      mintAddress: nft.address,
      name: nft.json?.name || nft.name,
      imageUrl: nft.json?.image || '',
      collectionMintAddress: nft.collection.address,
    });
    setIsListModalOpen(true);
  };

  const handleCloseListModal = () => {
    setIsListModalOpen(false);
    setSelectedNft(null);
    // Refresh both NFTs and listings after successful listing
    fetchNfts();
    fetchListings();
  };

  const handleOpenCancelModal = (nftMintAddress: string) => {
    const listing = listedNfts.find(l => l.nftMintAddress === nftMintAddress);
    if (!listing) {
      toast.error("Listing not found.");
      return;
    }
    
    setSelectedListing({
      nftMintAddress: listing.nftMintAddress,
      nftName: listing.nftName,
      nftImageUrl: listing.nftImageUrl,
      collectionName: listing.collectionName,
      priceInWhiskey: listing.priceInWhiskey,
    });
    setIsCancelModalOpen(true);
  };

  const handleCloseCancelModal = () => {
    setIsCancelModalOpen(false);
    setSelectedListing(null);
    // Refresh both NFTs and listings after successful cancellation
    fetchNfts();
    fetchListings();
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 to-yellow-600 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-4xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-amber-200 text-lg">Please connect your wallet to view your NFTs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 to-yellow-600">
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold text-white mb-8">My NFTs</h1>

        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
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
              <div className="mb-12">
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
              </div>
            )}

            {ownedCollectionNfts.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">
                  Your Planet Whiskey NFTs ({ownedCollectionNfts.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {ownedCollectionNfts.map((nft) => (
                      <MyNftCard
                        key={nft.address}
                        mintAddress={nft.address}
                        name={nft.json?.name || nft.name}
                        imageUrl={nft.json?.image || ''}
                        collectionName={nft.collectionName}
                        collectionMintAddress={nft.collectionMintAddress}
                        onList={handleOpenListModal}
                      />
                  ))}
                </div>
              </div>
            )}

            {unknownCollectionNfts.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Other NFTs ({unknownCollectionNfts.length})
                </h2>
                <p className="text-amber-200 mb-6">
                  These NFTs are not from Planet Whiskey collections and cannot be listed on our marketplace.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {unknownCollectionNfts.map((nft) => (
                      <div key={nft.address} className="bg-amber-800 bg-opacity-30 backdrop-blur-sm rounded-lg p-4 opacity-60">
                        <div className="aspect-square bg-amber-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                          {nft.json?.image ? (
                            <ImageWithFallback
                              src={nft.json.image}
                              alt={nft.json?.name || nft.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-amber-200">No Image</span>
                          )}
                        </div>
                        <h3 className="font-semibold text-white text-sm mb-2">
                          {nft.json?.name || nft.name}
                        </h3>
                        <p className="text-amber-200 text-xs">{nft.collectionName}</p>
                        <p className="text-amber-400 text-xs mt-1">Not listable</p>
                      </div>
                  ))}
                </div>
              </div>
            )}

            {(!loading && ownedCollectionNfts.length === 0 && unknownCollectionNfts.length === 0 && listedNfts.length === 0) && (
              <div className="text-center py-16">
                <h2 className="text-2xl font-bold text-white mb-4">No NFTs Found</h2>
                <p className="text-amber-200">
                  You don't own any NFTs yet. Visit our collections to mint your first NFT!
                </p>
              </div>
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