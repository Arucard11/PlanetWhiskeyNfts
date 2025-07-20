"use client";

import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ImageWithFallback from '@/components/ImageWithFallback';

interface CollectionWithListings {
    _id: string;
    collectionMintAddress: string;
    name: string;
    imageUrl?: string;
    listingCount: number;
}
//do not in any way change the way the image is being fetched from the api or the way the image is being displayed in the marketplace page
export default function MarketplacePage() {
  const [collections, setCollections] = useState<CollectionWithListings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
          const response = await fetch('/api/marketplace/listings');
          if (!response.ok) {
              throw new Error('Failed to fetch collections');
          }
          const data = await response.json();
          if (data.success) {
              setCollections(data.data);
          } else {
              throw new Error(data.message || 'An error occurred while fetching collections');
          }
      } catch (err) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black relative">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url('/background.jpg')` }}
      />
      
      <div className="relative bg-gradient-to-r from-amber-900/80 via-amber-800/60 to-amber-900/80 backdrop-blur-sm text-white py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-100"
            >
              NFT Marketplace
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-xl text-amber-100 max-w-2xl mx-auto font-light"
            >
              Browse collections with actively listed NFTs.
            </motion.p>
          </div>
        </div>
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {isLoading ? (
            <div className="text-center py-20"><p className="text-2xl text-amber-300">Loading Collections...</p></div>
        ) : error ? (
            <div className="text-center py-20"><p className="text-red-400">{error}</p></div>
        ) : collections.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏜️</div>
            <h3 className="text-3xl font-bold text-white mb-2">Marketplace is Quiet</h3>
            <p className="text-gray-400">No NFTs are currently listed for sale in any collection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {collections.map((collection, index) => (
              <motion.div
                key={collection.collectionMintAddress}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link href={`/marketplace/${collection.collectionMintAddress}`} className="block group">
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-white/10 group-hover:border-amber-400/50 transition-all duration-300">
                        {collection.imageUrl ? (
                          <ImageWithFallback
                              src={collection.imageUrl}
                              alt={collection.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-amber-200 bg-slate-800">
                            No Image Available
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-0 left-0 p-4">
                            <h3 className="text-white text-xl font-bold">{collection.name}</h3>
                            <p className="text-amber-300 text-sm">{collection.listingCount} item(s) for sale</p>
                        </div>
                    </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 