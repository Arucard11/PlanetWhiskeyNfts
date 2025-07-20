"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Tag, Shield, ShoppingCart } from 'lucide-react';
import BuyNftModal from './BuyNftModal';
import ImageWithFallback from './ImageWithFallback';

export interface MarketplaceItemCardProps {
  id: string; // Listing ID from DB
  nftMintAddress: string;
  sellerWalletAddress: string;
  priceInWhiskey: number;
  nftName: string;
  nftImageUrl: string;
  collectionName: string;
  onPurchaseSuccess: () => void;
}

const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({
  id,
  nftMintAddress,
  sellerWalletAddress,
  priceInWhiskey,
  nftName,
  nftImageUrl,
  collectionName,
  onPurchaseSuccess,
}) => {
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);

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
            {nftImageUrl ? (
              <ImageWithFallback
                src={nftImageUrl}
                alt={`Image of ${nftName}`}
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
                  <p className="text-2xl font-bold text-amber-300">{(priceInWhiskey / 1e9).toFixed(0)} <span className="text-sm">WHISKEY</span></p>
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
            nftImageUrl={nftImageUrl}
            collectionName={collectionName}
            priceInWhiskey={priceInWhiskey}
            onPurchaseSuccess={handleConfirmPurchase}
        />
    </>
  );
};

export default MarketplaceItemCard; 