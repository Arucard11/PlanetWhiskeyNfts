"use client";

import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MediaWithFallback from '@/components/MediaWithFallback';

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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

      <div className="relative z-20 container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.h1 
            className="text-6xl sm:text-7xl font-bold text-white mb-8 font-serif"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            NFT{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
              Marketplace
            </span>
          </motion.h1>
          <motion.p 
            className="text-2xl text-gray-400 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Browse collections with actively listed NFTs.
          </motion.p>
        </motion.div>

        {isLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
              <p className="text-2xl text-amber-300">Loading Collections...</p>
            </div>
        ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-400 text-xl">{error}</p>
            </div>
        ) : collections.length === 0 ? (
          <motion.div 
            className="text-center py-20"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="text-6xl mb-4">🏜️</div>
            <h3 className="text-3xl font-bold text-white mb-2">Marketplace is Quiet</h3>
            <p className="text-gray-400">No NFTs are currently listed for sale in any collection.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {collections.map((collection, index) => {
              console.log(`🔥 [marketplace-page] Rendering collection: ${collection.name}, imageUrl: "${collection.imageUrl}"`);
              return (
              <motion.div
                key={collection.collectionMintAddress}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link href={`/marketplace/${collection.collectionMintAddress}`} className="block group">
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-white/10 group-hover:border-amber-400/50 transition-all duration-300">
                        {collection.imageUrl ? (
                          <MediaWithFallback
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
            )})}
          </div>
        )}
      </div>
    </div>
  );
} 