'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, Transaction } from '@solana/web3.js';
import { simulateTransactionBeforeSigning } from '@/lib/solanaUtils';

interface ICollection {
  _id: string;
  name: string;
  symbol: string;
  mintPriceWhiskeyTokens: number;
  mintPriceUsd?: number;
  baseMintPriceUsd?: number;
  priceIncreaseBps?: number;
  nftsPerPriceStep?: number;
  itemLimit: number;
  itemsMintedOnChain?: number;
  companyId: string;
  companyName?: string;
  collectionOnChainAddress?: string;
  createdAt: string;
  isActive: boolean;
}

export default function ManageCollectionsPage() {
  const { publicKey, signTransaction } = useWallet();
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [editingPriceConfig, setEditingPriceConfig] = useState<string | null>(null);
  const [editPriceIncreaseIndex, setEditPriceIncreaseIndex] = useState(4);
  const [editNftsPerStep, setEditNftsPerStep] = useState(15);
  const [isSavingPriceConfig, setIsSavingPriceConfig] = useState(false);
  const [syncingCollectionId, setSyncingCollectionId] = useState<string | null>(null);

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
      await fetchCollections();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingCollectionId(null);
    }
  };

  const startEditPriceConfig = (collection: ICollection) => {
    setEditingPriceConfig(collection._id);
    setEditPriceIncreaseIndex((collection.priceIncreaseBps || 0) / 50);
    setEditNftsPerStep(collection.nftsPerPriceStep || 15);
  };

  const handleSavePriceConfig = async (collection: ICollection) => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    setIsSavingPriceConfig(true);
    try {
      const response = await fetch('/api/admin/collections/update-price-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: collection._id,
          priceIncreaseBps: editPriceIncreaseIndex * 50,
          nftsPerPriceStep: editNftsPerStep,
          collectionName: collection.name,
          adminWalletAddress: publicKey.toBase58(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to prepare price config update');
      }

      const { transaction } = await response.json();
      const txBuffer = Buffer.from(transaction, 'base64');
      const tx = Transaction.from(txBuffer);

      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      await simulateTransactionBeforeSigning(connection, tx, publicKey);
      const signedTx = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      alert(`Price config updated! TX: ${sig}`);
      setEditingPriceConfig(null);
      await fetchCollections();
    } catch (err: any) {
      alert('Error updating price config: ' + err.message);
    } finally {
      setIsSavingPriceConfig(false);
    }
  };

  const handleSyncToLending = async (collection: ICollection) => {
    if (!publicKey || !signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    setSyncingCollectionId(collection._id);
    try {
      const response = await fetch('/api/admin/lending/sync-price-from-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: collection.name,
          collectionMint: collection.collectionOnChainAddress,
          adminWalletAddress: publicKey.toBase58(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sync price');
      }

      const { transaction } = await response.json();
      const txBuffer = Buffer.from(transaction, 'base64');
      const tx = Transaction.from(txBuffer);

      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      await simulateTransactionBeforeSigning(connection, tx, publicKey);
      const signedTx = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      alert(`Lending price synced! TX: ${sig}`);
    } catch (err: any) {
      alert('Error syncing price: ' + err.message);
    } finally {
      setSyncingCollectionId(null);
    }
  };

  const formatWhiskeyTokens = (tokens: number) => {
    return (tokens / 1e6).toFixed(2);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-amber-400">Manage NFT Collections</h2>

      <div className="bg-slate-800/50 shadow-lg rounded-lg p-6 border border-white/10">
        <h3 className="text-xl font-serif font-medium mb-4 text-amber-400">Existing Collections</h3>
        {isLoading && <p className="font-sans text-gray-400">Loading collections...</p>}
        {error && <p className="text-sm text-red-400 font-sans">Error: {error}</p>}
        {!isLoading && !error && collections.length === 0 && <p className="font-sans text-gray-500">No collections found.</p>}
        {!isLoading && !error && collections.length > 0 && (
          <div className="space-y-4">
            {collections.map((collection) => (
              <div key={collection._id} className="border border-slate-700 rounded-lg p-4 bg-slate-800/50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-lg font-serif font-semibold text-amber-300">{collection.name}</h4>
                      <span className="text-sm font-mono text-gray-500">({collection.symbol})</span>
                      {!collection.isActive && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-900/30 text-red-400 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-400">Current Price:</span>
                        <span className="ml-1 text-white font-semibold">
                          {collection.mintPriceUsd 
                            ? `$${collection.mintPriceUsd.toFixed(2)}`
                            : `${formatWhiskeyTokens(collection.mintPriceWhiskeyTokens)} WHISKEY`
                          }
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-400">Base Price:</span>
                        <span className="ml-1 text-gray-300">
                          {collection.baseMintPriceUsd ? `$${collection.baseMintPriceUsd.toFixed(2)}` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-400">Supply:</span>
                        <span className="ml-1 text-white">{collection.itemsMintedOnChain || 0}/{collection.itemLimit}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-400">Price Config:</span>
                        <span className="ml-1 text-gray-300">
                          {collection.priceIncreaseBps != null
                            ? `${(collection.priceIncreaseBps / 100).toFixed(1)}% / ${collection.nftsPerPriceStep || '?'} NFTs`
                            : 'Not set'}
                        </span>
                      </div>
                    </div>

                    {/* Price Config Editor */}
                    {editingPriceConfig === collection._id && (
                      <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
                        <h5 className="font-medium text-green-400 mb-3">Edit Dynamic Pricing</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Price Increase: <span className="text-green-400 font-semibold">{(editPriceIncreaseIndex * 0.5).toFixed(1)}%</span>
                            </label>
                            <input
                              type="range"
                              min="0" max="6" step="1"
                              value={editPriceIncreaseIndex}
                              onChange={(e) => setEditPriceIncreaseIndex(parseInt(e.target.value))}
                              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>0%</span><span>1%</span><span>2%</span><span>3%</span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              NFTs Per Step: <span className="text-green-400 font-semibold">{editNftsPerStep}</span>
                            </label>
                            <input
                              type="range"
                              min="10" max="25" step="1"
                              value={editNftsPerStep}
                              onChange={(e) => setEditNftsPerStep(parseInt(e.target.value))}
                              className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>10</span><span>15</span><span>20</span><span>25</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleSavePriceConfig(collection)}
                            disabled={isSavingPriceConfig}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                          >
                            {isSavingPriceConfig ? 'Saving...' : 'Save On-Chain'}
                          </button>
                          <button
                            onClick={() => setEditingPriceConfig(null)}
                            className="px-4 py-2 bg-slate-600 text-gray-300 rounded-md hover:bg-slate-500 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col gap-2">
                    <button
                      onClick={() => startEditPriceConfig(collection)}
                      className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors"
                    >
                      Edit Pricing
                    </button>
                    <button
                      onClick={() => handleSyncToLending(collection)}
                      disabled={syncingCollectionId === collection._id}
                      className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {syncingCollectionId === collection._id ? 'Syncing...' : 'Sync to Lending'}
                    </button>
                    <button
                      onClick={() => handleDeleteCollection(collection._id)}
                      disabled={deletingCollectionId === collection._id}
                      className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deletingCollectionId === collection._id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}