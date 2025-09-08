'use client';

import React, { useState, useEffect } from 'react';

interface ICollection {
  _id: string;
  name: string;
  symbol: string;
  mintPriceWhiskeyTokens: number;
  mintPriceUsd?: number; // NEW: USD price
  itemLimit: number;
  itemsMintedOnChain?: number;
  companyId: string;
  companyName?: string;
  createdAt: string;
  isActive: boolean;
}

export default function ManageCollectionsPage() {
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

  async function fetchCollections() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/collections');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch collections');
      }
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this NFT collection? This action cannot be undone and will remove all associated data.')) {
      return;
    }

    setDeletingCollectionId(collectionId);
    try {
      const response = await fetch(`/api/admin/collections/${collectionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete collection');
      }
      await fetchCollections(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingCollectionId(null);
    }
  };

  const formatWhiskeyTokens = (tokens: number) => {
    return (tokens / 1e6).toFixed(2);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-whiskey-brown-dark">Manage NFT Collections</h2>

      <div className="bg-cream shadow-lg rounded-lg p-6 border border-whiskey-brown-light">
        <h3 className="text-xl font-serif font-medium mb-4 text-whiskey-brown-dark">Existing Collections</h3>
        {isLoading && <p className="font-sans text-stone-gray-600">Loading collections...</p>}
        {error && <p className="text-sm text-red-600 font-sans">Error: {error}</p>}
        {!isLoading && !error && collections.length === 0 && <p className="font-sans text-stone-gray-500">No collections found.</p>}
        {!isLoading && !error && collections.length > 0 && (
          <div className="space-y-4">
            {collections.map((collection) => (
              <div key={collection._id} className="border border-stone-gray-200 rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-lg font-serif font-semibold text-whiskey-brown-dark">{collection.name}</h4>
                      <span className="text-sm font-mono text-stone-gray-500">({collection.symbol})</span>
                      {!collection.isActive && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-stone-gray-700">Price:</span>
                        <span className="ml-1 text-whiskey-brown-dark">
                          {collection.mintPriceUsd 
                            ? `$${collection.mintPriceUsd.toFixed(2)} (${formatWhiskeyTokens(collection.mintPriceWhiskeyTokens)} WHISKEY)`
                            : `${formatWhiskeyTokens(collection.mintPriceWhiskeyTokens)} WHISKEY`
                          }
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-stone-gray-700">Supply:</span>
                        <span className="ml-1 text-whiskey-brown-dark">{collection.itemsMintedOnChain || 0}/{collection.itemLimit}</span>
                      </div>
                      <div>
                        <span className="font-medium text-stone-gray-700">Created:</span>
                        <span className="ml-1 text-stone-gray-600">{new Date(collection.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="font-medium text-stone-gray-700">Asset Type:</span>
                        <span className="ml-1 text-stone-gray-600">{collection.companyName || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCollection(collection._id)}
                    disabled={deletingCollectionId === collection._id}
                    className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletingCollectionId === collection._id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 