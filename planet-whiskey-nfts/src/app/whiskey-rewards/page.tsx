"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap, Star, Gift } from 'lucide-react';
import NftCollectionCard from '@/components/NftCollectionCard';

// Interface for whiskey-gated collections
interface WhiskeyGatedCollection {
    _id: string;
    collectionOnChainAddress: string;
    name: string;
    symbol: string;
    metadataUri: string;
    nftBaseMetadataUri: string;
    collectionMintAddress: string;
    mintPriceLamports: number;
    mintPriceWhiskeyTokens: number;
    mintPriceUsd?: number;
    itemLimit: number;
    itemsMintedOnChain?: number;
    isWhiskeyGated: boolean;
    requiredWhiskeyAmount: number;
}

export default function WhiskeyRewardsPage() {
    const [collections, setCollections] = useState<WhiskeyGatedCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchWhiskeyGatedCollections = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/collections');
            if (!response.ok) {
                throw new Error(`Failed to fetch collections: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                // Filter only whiskey-gated collections
                const whiskeyGatedCollections = result.data.filter(
                    (collection: any) => collection.isWhiskeyGated === true
                );
                setCollections(whiskeyGatedCollections);
            } else {
                throw new Error('Fetched collection data is not in the expected format.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWhiskeyGatedCollections();
    }, [fetchWhiskeyGatedCollections, refreshTrigger]);

    const handleMintSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black relative">
            {/* Background Image */}
            <div 
                className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                style={{
                    backgroundImage: `url('/background.jpg')`
                }}
            />

            {/* Animated Background Elements */}
            <div className="fixed inset-0 z-0">
                <motion.div 
                    className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full blur-3xl"
                    animate={{ 
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
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ 
                        scale: { duration: 5, repeat: Infinity },
                        opacity: { duration: 4, repeat: Infinity }
                    }}
                />
            </div>

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 py-12">
                {/* Header Section */}
                <motion.div 
                    className="text-center mb-16"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <div className="flex items-center justify-center mb-6">
                        <Trophy className="w-16 h-16 text-amber-400 mr-4" />
                        <h1 className="text-6xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent">
                            Master Distiller Rewards
                        </h1>
                        <Trophy className="w-16 h-16 text-amber-400 ml-4" />
                    </div>
                    
                    <p className="text-xl text-gray-300 max-w-4xl mx-auto mb-8">
                        NFT collections for true Three Gold Treasury connoisseurs. Hold Three Gold Treasury tokens to unlock access to premium collections and special rewards.
                    </p>

                    {/* Features */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        <motion.div 
                            className="glass-dark p-6 rounded-2xl"
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 300 }}
                        >
                            <Zap className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Token Gated</h3>
                            <p className="text-gray-400">Hold Three Gold Treasury tokens to unlock exclusive minting privileges</p>
                        </motion.div>

                        <motion.div 
                            className="glass-dark p-6 rounded-2xl"
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 300 }}
                        >
                            <Star className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Premium Access</h3>
                            <p className="text-gray-400">Free mints for qualified hodlers with special perks</p>
                        </motion.div>

                        <motion.div 
                            className="glass-dark p-6 rounded-2xl"
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 300 }}
                        >
                            <Gift className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Exclusive Rewards</h3>
                            <p className="text-gray-400">Special collections only available to Three Gold Treasury holders</p>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Collections Section */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                >
                    {isLoading ? (
                        <div className="text-center py-20">
                            <div className="spinner-whiskey w-16 h-16 mx-auto mb-4"></div>
                            <p className="text-gray-400 text-lg">Loading exclusive collections...</p>
                        </div>
                    ) : error ? (
                        <motion.div 
                            className="text-center py-20"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 max-w-md mx-auto">
                                <p className="text-red-400 text-lg font-semibold mb-2">Error Loading Collections</p>
                                <p className="text-gray-300">{error}</p>
                                <button 
                                    onClick={fetchWhiskeyGatedCollections}
                                    className="btn-whiskey mt-4"
                                >
                                    Try Again
                                </button>
                            </div>
                        </motion.div>
                    ) : collections.length === 0 ? (
                        <motion.div 
                            className="text-center py-20"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <div className="glass-dark p-12 rounded-2xl max-w-md mx-auto">
                                <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-6" />
                                <h3 className="text-2xl font-bold text-white mb-4">No Rewards Available</h3>
                                <p className="text-gray-300 mb-6">
                                    No three gold treasury-gated collections are currently available. Check back soon for exclusive rewards!
                                </p>
                                <button 
                                    onClick={fetchWhiskeyGatedCollections}
                                    className="btn-whiskey"
                                >
                                    Refresh
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <>
                            <div className="text-center mb-12">
                                <h2 className="text-4xl font-bold text-white mb-4">
                                    Available Rewards
                                </h2>
                                <p className="text-gray-300 text-lg">
                                    {collections.length} exclusive collection{collections.length !== 1 ? 's' : ''} available for Three Gold Treasury holders
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {collections.map((collection, index) => (
                                    <motion.div
                                        key={collection._id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ 
                                            duration: 0.6, 
                                            delay: index * 0.1 
                                        }}
                                        className="relative"
                                    >
                                        {/* Whiskey Gated Badge */}
                                        <div className="absolute -top-2 -right-2 z-20 bg-gradient-to-r from-amber-400 to-orange-500 text-black px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                                            <Zap className="w-4 h-4 inline mr-1" />
                                            {collection.requiredWhiskeyAmount.toLocaleString()} Three Gold Treasury
                                        </div>
                                        
                                        <NftCollectionCard
                                            _id={collection._id}
                                            collectionOnChainAddress={collection.collectionOnChainAddress}
                                            name={collection.name}
                                            symbol={collection.symbol}
                                            metadataUri={collection.metadataUri}
                                            nftBaseMetadataUri={collection.nftBaseMetadataUri}
                                            mintPriceLamports={collection.mintPriceLamports}
                                            mintPriceWhiskeyTokens={collection.mintPriceWhiskeyTokens}
                                            mintPriceUsd={collection.mintPriceUsd}
                                            itemLimit={collection.itemLimit}
                                            itemsMintedOnChain={collection.itemsMintedOnChain}
                                            onMintSuccess={handleMintSuccess}
                                            isWhiskeyGated={collection.isWhiskeyGated}
                                            requiredWhiskeyAmount={collection.requiredWhiskeyAmount}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
