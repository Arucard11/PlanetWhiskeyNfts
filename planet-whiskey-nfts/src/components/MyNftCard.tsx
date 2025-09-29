"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Layers, ArrowRight } from 'lucide-react';
import MediaWithFallback from './MediaWithFallback';



// Use a simplified props interface; fetching logic is now centralized on the page.
export interface MyNftCardProps {
  mintAddress: string;
  name: string;
  imageUrl?: string; // Make optional since we'll fetch it
  metadataUri?: string; // Add metadata URI for robust fetching
  collectionName: string; // Keep this simple for display
  collectionMintAddress: string;
  onList: (mintAddress: string) => void;
}

const MyNftCard: React.FC<MyNftCardProps> = ({
  mintAddress,
  name,
  imageUrl: initialImageUrl,
  metadataUri,
  collectionName,
  collectionMintAddress,
  onList,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(initialImageUrl || '');
  

  // Fetch metadata using the robust endpoint like NftCollectionCard
  useEffect(() => {
    
    const fetchMetadata = async (retryCount = 0) => {
      const maxRetries = 3;
      
      if (!metadataUri) {
        console.log(`[MyNftCard] No metadataUri for ${name}, using initial imageUrl:`, initialImageUrl);
        if (initialImageUrl) {
          setImageUrl(initialImageUrl);
        }
        return;
      }

      try {
        console.log(`[MyNftCard] Fetching metadata for ${name} (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        // Use metadata API for better mobile compatibility
        const apiUrl = `/api/collections/metadata?metadataUri=${encodeURIComponent(metadataUri)}`;
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.warn(`[MyNftCard] API request failed: ${response.status} ${response.statusText}`);
          if (retryCount < maxRetries) {
            console.log(`[MyNftCard] Retrying in ${(retryCount + 1) * 1000}ms...`);
            setTimeout(() => fetchMetadata(retryCount + 1), (retryCount + 1) * 1000);
            return;
          }
          // Final fallback - try to use initial image if available
          if (initialImageUrl) {
            console.log(`[MyNftCard] Using initial image URL as final fallback: ${initialImageUrl}`);
            setImageUrl(initialImageUrl);
          }
          return;
        }

        const result = await response.json();
        if (!result.success) {
          console.warn(`[MyNftCard] API returned error: ${result.message}`);
          if (retryCount < maxRetries) {
            console.log(`[MyNftCard] Retrying due to API error...`);
            setTimeout(() => fetchMetadata(retryCount + 1), (retryCount + 1) * 1000);
            return;
          }
          // Final fallback
          if (initialImageUrl) {
            setImageUrl(initialImageUrl);
          }
          return;
        }

        const metadata = result.data;
        console.log(`[MyNftCard] Successfully fetched metadata for ${name}:`, metadata);

        if (metadata.image) {
          console.log(`[MyNftCard] Setting image URL for ${name}:`, metadata.image);
          setImageUrl(metadata.image);
        } else if (initialImageUrl) {
          console.log(`[MyNftCard] No image in metadata, using initial imageUrl for ${name}`);
          setImageUrl(initialImageUrl);
        }
        
      } catch (error) {
        console.error(`[MyNftCard] Error fetching metadata for ${name}:`, error);
        if (retryCount < maxRetries) {
          console.log(`[MyNftCard] Retrying due to network error...`);
          setTimeout(() => fetchMetadata(retryCount + 1), (retryCount + 1) * 1000);
          return;
        }
        // Final fallback
        if (initialImageUrl) {
          console.log(`[MyNftCard] Using initial image URL after all retries failed`);
          setImageUrl(initialImageUrl);
        }
      }
    };

    fetchMetadata();
  }, [metadataUri, name, initialImageUrl]);


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