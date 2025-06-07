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
        // <Layout> // Remove this
        <> {/* Use React Fragment */}
            <div className="py-12 md:py-16 lg:py-20"> {/* This padding is on the direct child of main, which itself has padding. Consider adjusting. */}
                <div className="text-center mb-12 md:mb-16">
                    <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-brand-text-primary cool-gradient-text">{pageTitle}</h1>
                    {companyName && 
                        <p className="text-lg font-sans text-brand-text-secondary max-w-xl mx-auto">
                            Browse the unique NFT offerings from {companyName}.
                        </p>
                    }
                    {!companyName && companyId && 
                        <p className="text-sm font-sans text-brand-text-secondary">
                            Company ID: {companyId}
                        </p>
                    }
                    {mintMessage && (
                         <p className={`mt-4 text-sm font-sans px-4 py-2 rounded-md inline-block 
                            ${mintMessage.toLowerCase().includes("failed") || mintMessage.toLowerCase().includes("error") 
                                ? 'bg-red-700 text-red-100' // Darker bg for better contrast if needed
                                : 'bg-green-700 text-green-100'}`}>
                            {mintMessage}
                        </p>
                    )}
                </div>

                {isLoading && (
                    <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-accent"></div>
                        <p className="ml-4 text-brand-text-secondary font-sans">Loading collections...</p>
                    </div>
                )}
                {error && <p className="text-center font-sans text-red-400 py-8">Error: {error}</p>}

                {!isLoading && !error && collections.length === 0 && (
                    <p className="text-center font-sans text-brand-text-secondary py-8">No NFT collections found for this company yet. Please check back soon.</p>
                )}

                {!isLoading && !error && collections.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8"> {/* Adjusted gap for sm screens */}
                        {collections.map((collection) => (
                            <NftCollectionCard
                                key={collection._id || collection.collectionOnChainAddress}
                                _id={collection._id}
                                collectionOnChainAddress={collection.collectionOnChainAddress}
                                name={collection.name}
                                symbol={collection.symbol}
                                metadataUri={collection.metadataUri}
                                // nftBaseMetadataUri={collection.nftBaseMetadataUri} // Not a direct prop
                                // collectionMintAddress={collection.collectionMintAddress} // Not a direct prop
                                mintPriceLamports={collection.mintPriceLamports}
                                itemLimit={collection.itemLimit}
                                itemsMintedOnChain={collection.itemsMintedOnChain}
                                onMintSuccess={handleMintSuccess}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
        // </Layout> // Remove this
    );
} 