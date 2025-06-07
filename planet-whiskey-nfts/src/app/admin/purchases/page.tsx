'use client';

import React, { useEffect, useState } from 'react';
import { IWalletNftPurchase } from '@/models/WalletNftPurchase'; // Assuming path is correct from root

const SOLANA_EXPLORER_URL = 'https://explorer.solana.com/tx';

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState<IWalletNftPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPurchases() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/purchases');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch purchases');
        }
        const data = await response.json();
        setPurchases(data.data || []); 
      } catch (err: any) {
        console.error('Error fetching purchases:', err);
        setError(err.message || 'An unexpected error occurred.');
      }
      setIsLoading(false);
    }
    fetchPurchases();
  }, []);

  if (isLoading) {
    return <p className="text-center font-sans text-stone-gray-600">Loading purchase records...</p>;
  }

  if (error) {
    return <p className="text-center font-sans text-red-600">Error: {error}</p>;
  }

  if (purchases.length === 0) {
    return <p className="text-center font-sans text-stone-gray-500">No purchase records found.</p>;
  }

  return (
    <div className="bg-cream shadow-lg rounded-lg p-6 border border-whiskey-brown-light">
      <h2 className="text-2xl font-serif font-semibold mb-6 text-whiskey-brown-dark">Wallet NFT Purchase Records</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-gray-300 font-sans">
          <thead className="bg-stone-gray-100">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-gray-500 uppercase tracking-wider">Purchase Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-gray-500 uppercase tracking-wider">Wallet Address</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-gray-500 uppercase tracking-wider">NFT Mint</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-gray-500 uppercase tracking-wider">Collection Mint</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-stone-gray-500 uppercase tracking-wider">Transaction Signature</th>
            </tr>
          </thead>
          <tbody className="bg-cream divide-y divide-stone-gray-200">
            {purchases.map((purchase) => (
              <tr key={purchase.transactionSignature} className="hover:bg-stone-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-gray-900">{new Date(purchase.purchaseDate).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-gray-700 truncate max-w-xs" title={purchase.walletAddress}>{purchase.walletAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-gray-700 truncate max-w-xs" title={purchase.nftMintAddress}>{purchase.nftMintAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-gray-700 truncate max-w-xs" title={purchase.collectionMintAddress}>{purchase.collectionMintAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a 
                    href={`${SOLANA_EXPLORER_URL}/${purchase.transactionSignature}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-amber-gold-DEFAULT hover:text-amber-gold-dark transition-colors truncate max-w-xs inline-block"
                    title={purchase.transactionSignature}
                  >
                    {purchase.transactionSignature}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 