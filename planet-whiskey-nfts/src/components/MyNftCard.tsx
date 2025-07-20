"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Layers, ArrowRight } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';

// Use a simplified props interface; fetching logic is now centralized on the page.
export interface MyNftCardProps {
  mintAddress: string;
  name: string;
  imageUrl: string;
  collectionName: string; // Keep this simple for display
  collectionMintAddress: string;
  onList: (mintAddress: string) => void;
}

const MyNftCard: React.FC<MyNftCardProps> = ({
  mintAddress,
  name,
  imageUrl,
  collectionName,
  collectionMintAddress,
  onList,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
  };

  return (
    <motion.div 
      className="group relative bg-slate-900/50 backdrop-blur-xl border border-amber-700/30 rounded-3xl shadow-2xl hover:shadow-purple-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden"
      layout
    >
      <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
        {imageUrl ? (
          <ImageWithFallback
            src={imageUrl}
            alt={`Image of ${name}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-200">
            No Image Available
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"></div>
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
          {collectionName}
        </div>
      </div>

      <div className="p-4 space-y-2">
          <h3 className="text-lg font-bold text-amber-50 truncate group-hover:text-amber-300 transition-colors duration-300">
              {name || 'Unnamed NFT'}
          </h3>
          <div className="text-xs text-amber-200 opacity-80 font-mono space-y-1">
            <p><strong>NFT Mint:</strong> {mintAddress.substring(0, 4)}...{mintAddress.substring(mintAddress.length - 4)}</p>
            {collectionMintAddress && (
              <p><strong>Collection Mint:</strong> {collectionMintAddress.substring(0, 4)}...{collectionMintAddress.substring(collectionMintAddress.length - 4)}</p>
            )}
          </div>
      </div>

      <div className="p-4 pt-0">
          <button
              onClick={() => onList(mintAddress)}
              className="w-full btn-whiskey-outline"
          >
              List NFT
          </button>
      </div>
    </motion.div>
  );
};

export default MyNftCard; 