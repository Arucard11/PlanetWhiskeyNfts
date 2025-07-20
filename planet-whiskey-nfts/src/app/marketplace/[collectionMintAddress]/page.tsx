"use client";

import { motion } from 'framer-motion';

import { useState, useEffect, useCallback } from 'react';
import MarketplaceItemCard, { MarketplaceItemCardProps } from '@/components/MarketplaceItemCard';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';


// This type should now match the augmented data from the API
interface PopulatedListing extends MarketplaceItemCardProps {
    _id: string; // The database ID of the listing
}

interface CollectionInfo {
    name: string;
    image?: string;
}

export default function CollectionListingsPage({ params }: { params: { collectionMintAddress: string } }) {
  const { collectionMintAddress } = params;
  const [listings, setListings] = useState<PopulatedListing[]>([]);
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchCollectionData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
        const response = await fetch(`/api/marketplace/listings?collectionMint=${collectionMintAddress}`);
        if (!response.ok) {
            throw new Error('Failed to fetch collection listings');
        }
        const data = await response.json();
        if (data.success) {
            setListings(data.data.listings);
            setCollectionInfo(data.data.collectionInfo);
        } else {
            throw new Error(data.message || 'An error occurred while fetching listings');
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
        setIsLoading(false);
    }
  }, [collectionMintAddress]);

  useEffect(() => {
    fetchCollectionData();
  }, [fetchCollectionData, refreshTrigger]);

  const handlePurchaseSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black relative">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url(${collectionInfo?.image || '/background.jpg'})` }}
      />
      
      <div className="relative bg-gradient-to-r from-amber-900/80 via-amber-800/60 to-amber-900/80 backdrop-blur-sm text-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Link href="/marketplace" className="inline-flex items-center text-amber-200 hover:text-white mb-6">
                <ArrowLeft className="mr-2" /> Back to Marketplace
            </Link>
            {collectionInfo && (
                 <div className="text-center">
                    <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                    className="text-4xl sm:text-5xl font-black mb-4 font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-100"
                    >
                    {collectionInfo.name}
                    </motion.h1>
                    <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="text-lg text-amber-100 max-w-2xl mx-auto font-light"
                    >
                    NFTs for Sale
                    </motion.p>
                </div>
            )}
        </div>
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isLoading ? (
            <div className="text-center py-20"><p className="text-2xl text-amber-300">Loading listings...</p></div>
        ) : error ? (
            <div className="text-center py-20"><p className="text-red-400">{error}</p></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
             <div className="text-6xl mb-4">🏜️</div>
            <h3 className="text-3xl font-bold text-white mb-2">No NFTs Listed</h3>
            <p className="text-gray-400">There are currently no NFTs for sale in this collection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {listings.map((listing, index) => (
              <motion.div
                key={listing._id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <MarketplaceItemCard {...listing} onPurchaseSuccess={handlePurchaseSuccess} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 