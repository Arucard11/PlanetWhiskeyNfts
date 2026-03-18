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
    return <p className="text-center font-sans text-gray-400">Loading purchase records...</p>;
  }

  if (error) {
    return <p className="text-center font-sans text-red-400">Error: {error}</p>;
  }

  if (purchases.length === 0) {
    return <p className="text-center font-sans text-gray-500">No purchase records found.</p>;
  }

  return (
    <div className="bg-slate-800/50 shadow-lg rounded-lg p-6 border border-white/10">
      <h2 className="text-2xl font-serif font-semibold mb-6 text-amber-400">Wallet NFT Purchase Records</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700 font-sans">
          <thead className="bg-slate-700/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Purchase Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Wallet Address</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">NFT Mint</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Collection Mint</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Transaction Signature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {purchases.map((purchase) => (
              <tr key={purchase.transactionSignature} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{new Date(purchase.purchaseDate).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 truncate max-w-xs" title={purchase.walletAddress}>{purchase.walletAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 truncate max-w-xs" title={purchase.nftMintAddress}>{purchase.nftMintAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 truncate max-w-xs" title={purchase.collectionMintAddress}>{purchase.collectionMintAddress}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a 
                    href={`${SOLANA_EXPLORER_URL}/${purchase.transactionSignature}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 transition-colors truncate max-w-xs inline-block"
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