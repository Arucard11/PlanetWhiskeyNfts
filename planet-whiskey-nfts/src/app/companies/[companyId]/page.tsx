"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation'; // For accessing route parameters
// import Layout from '@/components/Layout'; // Remove this
import NftCollectionCard from '@/components/NftCollectionCard'; // NftCollectionCardProps removed as it's exported from the component itself

// Interface for the collection data fetched from the API
// This should match the structure returned by /api/collections (INftCollectionWithMintedCount)
interface CollectionDataFromApi {
    _id: string;
    collectionOnChainAddress: string;
    name: string;
    symbol: string;
    metadataUri: string;
    nftBaseMetadataUri: string; // Still needed for the card to fetch internally
    collectionMintAddress: string; // Still needed for the card to fetch internally
    mintPriceLamports: number;
    mintPriceWhiskeyTokens: number;
    itemLimit: number;
    itemsMintedOnChain?: number;
    // any other fields from your INftCollection model + augmented data
}

// Props for the page component, Next.js App Router passes params directly
interface CompanyCollectionsPageProps {
    params: {
        companyId: string;
    };
}

export default function CompanyCollectionsPage({ params }: CompanyCollectionsPageProps) {
    const { companyId } = params;
    // const routerParams = useParams(); // Alternative way to get params if not using page props
    // const companyId = typeof routerParams.companyId === 'string' ? routerParams.companyId : undefined;

    const [collections, setCollections] = useState<CollectionDataFromApi[]>([]);
    const [companyName, setCompanyName] = useState<string | null>(null); // Optional: for displaying company name
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0); // State to trigger re-fetch

    const fetchData = useCallback(async () => {
        if (!companyId) return;
        setIsLoading(true);
        setError(null); // Clear previous errors
        try {
            const collectionsResponse = await fetch(`/api/collections?companyId=${companyId}`);
            if (!collectionsResponse.ok) {
                throw new Error(`Failed to fetch collections: ${collectionsResponse.statusText}`);
            }
            const collectionsResult = await collectionsResponse.json();
            if (collectionsResult.success && Array.isArray(collectionsResult.data)) {
                setCollections(collectionsResult.data);
            } else {
                throw new Error('Fetched collection data is not in the expected format.');
            }

            if (!companyName) { // Only fetch company name if not already fetched
                const companyDetailsResponse = await fetch('/api/companies');
                if (companyDetailsResponse.ok) {
                    const companyResult = await companyDetailsResponse.json();
                    if (companyResult.success && Array.isArray(companyResult.data)) {
                        const currentCompany = companyResult.data.find(c => c._id === companyId);
                        if (currentCompany) {
                            setCompanyName(currentCompany.name);
                        }
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [companyId, companyName]); // Added companyName to dependencies to avoid re-fetching it if already known

    useEffect(() => {
        fetchData();
    }, [companyId, fetchData, refreshTrigger]); // Add refreshTrigger to dependency array

    const handleMintSuccess = () => {
        setMintMessage("Mint successful! Refreshing collection details...");
        setRefreshTrigger(prev => prev + 1); // Increment to trigger re-fetch
        setTimeout(() => setMintMessage(null), 5000); // Clear message after 5s
    };

    // Temporary state for a global mint message if needed, or rely on individual card messages
    const [mintMessage, setMintMessage] = useState<string | null>(null);

    const pageTitle = companyName ? `Collections from ${companyName}` : `NFT Collections`;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black relative">
            {/* Background Image */}
            <div 
                className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                style={{
                    backgroundImage: `url('/background.jpg')`
                }}
            />
            
            {/* Hero Section */}
            <div className="relative bg-gradient-to-r from-amber-900/80 via-amber-800/60 to-amber-900/80 backdrop-blur-sm text-white py-20">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-amber-100">
                            {pageTitle}
                        </h1>
                        {companyName && (
                            <p className="text-xl text-amber-100 max-w-2xl mx-auto leading-relaxed font-light">
                                Discover authentic treasury-backed NFTs from <span className="text-amber-300 font-bold">{companyName}</span> assets
                            </p>
                        )}
                        {!companyName && companyId && (
                            <p className="text-amber-200">
                                Company ID: {companyId}
                            </p>
                        )}
                        {mintMessage && (
                            <div className={`mt-6 inline-block px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-sm
                                ${mintMessage.toLowerCase().includes("failed") || mintMessage.toLowerCase().includes("error") 
                                    ? 'bg-red-600/90 text-white border border-red-400/30' 
                                    : 'bg-green-600/90 text-white border border-green-400/30'}`}>
                                {mintMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {isLoading && (
                    <div className="flex flex-col justify-center items-center py-20">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-amber-500"></div>
                            <div className="absolute inset-0 animate-pulse rounded-full h-24 w-24 border-4 border-amber-300 opacity-30"></div>
                        </div>
                        <p className="text-2xl text-amber-300 mt-8 font-light">Loading collections...</p>
                    </div>
                )}
                
                {error && (
                    <div className="text-center py-20">
                        <div className="bg-gradient-to-br from-red-900/40 to-red-950/60 backdrop-blur-xl border border-red-700/30 rounded-3xl p-12 max-w-2xl mx-auto shadow-2xl">
                            <div className="text-6xl mb-6">⚠️</div>
                            <p className="text-red-300 text-xl font-medium">Error: {error}</p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && collections.length === 0 && (
                    <div className="text-center py-20">
                        <div className="bg-gradient-to-br from-amber-900/40 to-amber-950/60 backdrop-blur-xl border border-amber-700/30 rounded-3xl p-16 max-w-4xl mx-auto shadow-2xl">
                            <div className="text-8xl mb-8">🥃</div>
                            <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif mb-6">
                                No Collections Yet
                            </h3>
                            <p className="text-xl text-gray-300 leading-relaxed font-light">
                                This asset type hasn't launched any NFT collections yet. Check back soon for exciting new offerings from this treasury asset!
                            </p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && collections.length > 0 && (
                    <div>
                        <div className="text-center mb-12">
                            <h2 className="text-4xl sm:text-5xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-300 font-serif">
                                Available Collections
                            </h2>
                            <div className="h-2 w-24 bg-gradient-to-r from-amber-400 to-amber-600 mx-auto rounded-full shadow-lg shadow-amber-500/50"></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {collections.map((collection) => (
                                <NftCollectionCard
                                    key={collection._id || collection.collectionOnChainAddress}
                                    _id={collection._id}
                                    collectionOnChainAddress={collection.collectionOnChainAddress}
                                    name={collection.name}
                                    symbol={collection.symbol}
                                    metadataUri={collection.metadataUri}
                                    mintPriceLamports={collection.mintPriceLamports}
                                    mintPriceWhiskeyTokens={collection.mintPriceWhiskeyTokens}
                                    itemLimit={collection.itemLimit}
                                    itemsMintedOnChain={collection.itemsMintedOnChain}
                                    onMintSuccess={handleMintSuccess}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 