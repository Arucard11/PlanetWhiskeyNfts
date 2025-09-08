"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { XCircle, Tag, Clock } from 'lucide-react';
import MediaWithFallback from './MediaWithFallback';

export interface ListedNftCardProps {
  nftMintAddress: string;
  nftName: string;
  nftImageUrl: string;
  collectionName: string;
  priceInWhiskey: number;
  createdAt: string;
  onCancel: (nftMintAddress: string) => void;
}

const ListedNftCard: React.FC<ListedNftCardProps> = ({
  nftMintAddress,
  nftName,
  nftImageUrl,
  collectionName,
  priceInWhiskey,
  createdAt,
  onCancel,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <motion.div 
      className="group relative bg-slate-900/50 backdrop-blur-xl border border-green-700/30 rounded-3xl shadow-2xl hover:shadow-green-500/20 transform hover:-translate-y-2 transition-all duration-700 flex flex-col h-full overflow-hidden"
      layout
    >
      {/* Status Badge */}
      <div className="absolute top-4 left-4 z-10 bg-green-600/90 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
        Listed for Sale
      </div>

      <div className="relative w-full h-56 sm:h-64 bg-slate-800 rounded-t-3xl overflow-hidden">
        {nftImageUrl ? (
          <MediaWithFallback
            src={nftImageUrl}
            alt={`Media of ${nftName}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-green-200">
            No Image Available
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"></div>
        <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
          {collectionName}
        </div>
      </div>

      <div className="p-4 space-y-3 flex-grow">
        <h3 className="text-lg font-bold text-green-50 truncate group-hover:text-green-300 transition-colors duration-300">
          {nftName || 'Unnamed NFT'}
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-green-400 text-sm">
            <Tag className="h-4 w-4 mr-1" />
            <span className="font-bold">{(priceInWhiskey / 1e6).toLocaleString()} WHISKEY</span>
          </div>
        </div>

        <div className="flex items-center text-green-200/80 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          <span>Listed {formatDate(createdAt)}</span>
        </div>

        <div className="text-xs text-green-200 opacity-80 font-mono space-y-1">
          <p><strong>NFT Mint:</strong> {nftMintAddress.substring(0, 4)}...{nftMintAddress.substring(nftMintAddress.length - 4)}</p>
        </div>
      </div>

      <div className="p-4 pt-0">
        <button
          onClick={() => onCancel(nftMintAddress)}
          className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center justify-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          Cancel Listing
        </button>
      </div>
    </motion.div>
  );
};

export default ListedNftCard; 