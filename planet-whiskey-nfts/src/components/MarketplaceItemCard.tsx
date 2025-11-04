"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Shield, ShoppingCart } from 'lucide-react';
import BuyNftModal from './BuyNftModal';
import MediaWithFallback from './MediaWithFallback';

export interface MarketplaceItemCardProps {
  id: string; // Listing ID from DB
  nftMintAddress: string;
  sellerWalletAddress: string;
  priceInWhiskey: number;
  nftName: string;
  nftImageUrl: string;
  nftMetadataUri?: string; // Add metadata URI for robust fetching
  collectionName: string;
  onPurchaseSuccess: () => void;
}

const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({
  id,
  nftMintAddress,
  sellerWalletAddress,
  priceInWhiskey,
  nftName,
  nftImageUrl: initialImageUrl,
  nftMetadataUri,
  collectionName,
  onPurchaseSuccess,
}) => {
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState(initialImageUrl || '');

  // Fetch metadata using the robust endpoint like NftCollectionCard
  React.useEffect(() => {
    const fetchMetadata = async (retryCount = 0) => {
      const maxRetries = 3;
      
      if (!nftMetadataUri) {
        console.log(`[MarketplaceItemCard] No metadataUri for ${nftName}, using initial imageUrl:`, initialImageUrl);
        if (initialImageUrl) {
          setImageUrl(initialImageUrl);
        }
        return;
      }

      try {
        console.log(`[MarketplaceItemCard] Fetching metadata for ${nftName} (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        const apiUrl = `/api/collections/metadata?metadataUri=${encodeURIComponent(nftMetadataUri)}`;
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.warn(`[MarketplaceItemCard] API request failed: ${response.status} ${response.statusText}`);
          if (retryCount < maxRetries) {
            console.log(`[MarketplaceItemCard] Retrying in ${(retryCount + 1) * 1000}ms...`);
            setTimeout(() => fetchMetadata(retryCount + 1), (retryCount + 1) * 1000);
            return;
          }
          // Final fallback - use initial image if available
          if (initialImageUrl) {
            console.log(`[MarketplaceItemCard] Using initial image URL as final fallback: ${initialImageUrl}`);
            setImageUrl(initialImageUrl);
          }
          return;
        }

        const result = await response.json();
        if (!result.success) {
          console.warn(`[MarketplaceItemCard] API returned error: ${result.message}`);
          if (retryCount < maxRetries) {
            console.log(`[MarketplaceItemCard] Retrying due to API error...`);
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
        console.log(`[MarketplaceItemCard] Successfully fetched metadata for ${nftName}:`, metadata);

        if (metadata.image) {
          console.log(`[MarketplaceItemCard] Setting image URL for ${nftName}:`, metadata.image);
          setImageUrl(metadata.image);
        } else if (initialImageUrl) {
          console.log(`[MarketplaceItemCard] No image in metadata, using initial imageUrl for ${nftName}`);
          setImageUrl(initialImageUrl);
        }
        
      } catch (error) {
        console.error(`[MarketplaceItemCard] Error fetching metadata for ${nftName}:`, error);
        if (retryCount < maxRetries) {
          console.log(`[MarketplaceItemCard] Retrying due to network error...`);
          setTimeout(() => fetchMetadata(retryCount + 1), (retryCount + 1) * 1000);
          return;
        }
        // Final fallback
        if (initialImageUrl) {
          console.log(`[MarketplaceItemCard] Using initial image URL after all retries failed`);
          setImageUrl(initialImageUrl);
        }
      }
    };

    fetchMetadata();
  }, [nftMetadataUri, nftName, initialImageUrl]);

  const handleConfirmPurchase = () => {
    console.log("Purchase confirmed for:", nftMintAddress);
    setIsBuyModalOpen(false); // Close modal after confirmation
    onPurchaseSuccess(); // Trigger the refresh
  };

  return (
    <>
        <motion.div 
          className="group relative bg-slate-900/50 backdrop-blur-xl border border-amber-700/30 rounded-3xl shadow-2xl hover:shadow-amber-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden"
          layout
        >
          <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
            {imageUrl ? (
              <MediaWithFallback
                src={imageUrl}
                alt={`Media of ${nftName}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
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

          <div className="p-6 flex flex-col flex-grow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-amber-50 mb-2 line-clamp-2 group-hover:text-amber-300 transition-colors duration-300">
                  {nftName}
                </h3>
                <div className="space-y-1">
                  <div className="flex items-center text-amber-200/80 text-sm">
                    <Shield className="h-4 w-4 mr-1" />
                    <span>{collectionName}</span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    Seller: {sellerWalletAddress.substring(0, 4)}...{sellerWalletAddress.substring(sellerWalletAddress.length - 4)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <p className="text-amber-400/80 text-sm font-medium">Price</p>
                  <p className="text-2xl font-bold text-white">{(priceInWhiskey / 1e6).toFixed(0)} <span className="text-sm text-white">Three Gold Treasury</span></p>
                </div>
                <div className="flex items-center text-amber-200/60 text-sm">
                  <Tag className="h-4 w-4 mr-1" />
                  <span>For Sale</span>
                </div>
              </div>

              <button
                onClick={() => setIsBuyModalOpen(true)}
                className="w-full btn-whiskey flex items-center justify-center gap-2 group-hover:bg-amber-600 transition-colors duration-300"
              >
                <ShoppingCart className="h-4 w-4" />
                Buy NFT
              </button>
            </div>
          </div>
        </motion.div>

        <BuyNftModal
            isOpen={isBuyModalOpen}
            onClose={() => setIsBuyModalOpen(false)}
            nftMintAddress={nftMintAddress}
            nftName={nftName}
            nftImageUrl={imageUrl}
            collectionName={collectionName}
            priceInWhiskey={priceInWhiskey}
            onPurchaseSuccess={handleConfirmPurchase}
        />
    </>
  );
};

export default MarketplaceItemCard; 