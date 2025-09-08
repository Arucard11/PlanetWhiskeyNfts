"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Layers, ArrowRight } from 'lucide-react';
import MediaWithFallback from './MediaWithFallback';



// Use a simplified props interface; fetching logic is now centralized on the page.
export interface MyNftCardProps {
  mintAddress: string;
  name: string;
  imageUrl: string; // Use imageUrl prop like other components
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

  // Debug logging to see what image URL we're receiving
  console.log(`[MyNftCard] Received imageUrl for ${name}:`, imageUrl);
  console.log(`[MyNftCard] ImageUrl type:`, typeof imageUrl);
  console.log(`[MyNftCard] ImageUrl length:`, imageUrl?.length);
  console.log(`[MyNftCard] ImageUrl is empty:`, !imageUrl);

  const handleImageLoad = () => {
    console.log(`[MyNftCard] Image loaded successfully for ${name}:`, imageUrl);
    setIsLoading(false);
  };

  const handleImageError = () => {
    console.log(`[MyNftCard] Image failed to load for ${name}:`, imageUrl);
    setIsLoading(false);
  };

  return (
    <motion.div 
      className="group relative bg-slate-900/50 backdrop-blur-xl border border-amber-700/30 rounded-3xl shadow-2xl hover:shadow-amber-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden"
      layout
    >
      <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
        {/* Image Aspect Ratio Container - same as NftCollectionCard */}
        <div className="aspect-w-1 aspect-h-1 w-full h-full">
          <MediaWithFallback
            src={imageUrl || '/placeholder-image.svg'}
            alt={`${name} media`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"></div>
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
          {collectionName}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3 className="mb-3 text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif truncate" title={name}>
          {name || 'Unnamed NFT'}
        </h3>
        
        <div className="font-sans text-sm text-gray-300 space-y-2 mb-6 flex-grow">
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-400">Collection:</span> 
            <span className="font-bold text-amber-200">{collectionName}</span>
          </div>
          <div className="text-xs text-amber-200 opacity-80 font-mono space-y-1">
            <p><strong>NFT Mint:</strong> {mintAddress.substring(0, 4)}...{mintAddress.substring(mintAddress.length - 4)}</p>
            {collectionMintAddress && (
              <p><strong>Collection Mint:</strong> {collectionMintAddress.substring(0, 4)}...{collectionMintAddress.substring(collectionMintAddress.length - 4)}</p>
            )}
          </div>
        </div>

        <div className="mt-auto">
          <button
            onClick={() => onList(mintAddress)}
            className="w-full btn-whiskey-outline"
          >
            List NFT
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default MyNftCard; 