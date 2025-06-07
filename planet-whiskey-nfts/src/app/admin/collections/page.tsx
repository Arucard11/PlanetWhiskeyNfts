'use client';

import React, { useState, useEffect } from 'react';
import { ICompany } from '@/models/Company'; 

// Shared Tailwind classes for form inputs
const formInputBaseClass = "mt-1 block w-full px-4 py-2 font-sans border border-stone-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-gold-DEFAULT focus:border-amber-gold-DEFAULT sm:text-sm text-stone-gray-900 placeholder-stone-gray-400";
const formLabelClass = "block text-sm font-medium text-stone-gray-700 font-sans mb-1";
const fileInputClass = `block w-full text-sm text-stone-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-amber-gold-DEFAULT/80 file:text-white hover:file:bg-amber-gold-DEFAULT cursor-pointer file:cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-gold-DEFAULT focus:border-amber-gold-DEFAULT ${formInputBaseClass}`;
const helperTextClass = "text-xs font-sans text-stone-gray-500 mt-1";

export default function ManageCollectionsPage() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [mintPriceSOL, setMintPriceSOL] = useState('');
  const [itemLimit, setItemLimit] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [collectionImageFile, setCollectionImageFile] = useState<File | null>(null);

  const [collectionDescription, setCollectionDescription] = useState('');
  const [nftDescription, setNftDescription] = useState('');

  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/admin/companies');
        if (!res.ok) throw new Error('Failed to fetch companies');
        const data = await res.json();
        if (data && Array.isArray(data.companies)) {
          setCompanies(data.companies);
          if (data.companies.length > 0) {
            setCompanyId(data.companies[0]._id);
          }
        } else {
          console.error('Fetched companies data is not in the expected format:', data);
          setCompanies([]);
          setMessage({ type: 'error', text: 'Failed to load companies: unexpected data format.' });
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
        setMessage({ type: 'error', text: 'Failed to load companies for selection.' });
      }
    };
    fetchCompanies();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('symbol', symbol);
    formData.append('mintPriceSOL', mintPriceSOL);
    formData.append('itemLimit', itemLimit);
    formData.append('companyId', companyId);

    formData.append('collectionDescription', collectionDescription);
    formData.append('collectionSellerFee', '500');
    formData.append('nftBaseName', name);
    formData.append('nftBaseDescription', nftDescription);

    if (collectionImageFile) {
      formData.append('collectionImageFile', collectionImageFile);
      formData.append('nftBaseImageFile', collectionImageFile);
    }

    try {
      const res = await fetch('/api/admin/collections', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || 'Failed to create collection');
      }
      setMessage({ type: 'success', text: `Collection created successfully! Your NFT collection "${name}" is now ready for minting.` });
      setName('');
      setSymbol('');
      setMintPriceSOL('');
      setItemLimit('');
      setCollectionImageFile(null);
      setCollectionDescription('');
      setNftDescription('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'An unexpected error occurred.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-serif text-whiskey-brown-dark font-semibold mb-6">Create New NFT Collection</h2>
      {message && (
        <div className={`mb-4 p-4 rounded-md text-sm font-sans 
          ${message.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="companyId" className={formLabelClass}>Select Company</label>
          <select id="companyId" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required className={formInputBaseClass}>
            {companies.length === 0 && <option value="">Loading companies...</option>}
            {companies.map((comp) => (<option key={comp._id} value={comp._id}>{comp.name}</option>))}
          </select>
          <p className={helperTextClass}>Choose which company this NFT collection belongs to.</p>
        </div>

        <div>
          <label htmlFor="name" className={formLabelClass}>Collection Name</label>
          <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className={formInputBaseClass} placeholder="e.g., Highland Reserve 2024" />
          <p className={helperTextClass}>This is the main name for your NFT collection. It will appear in wallets and marketplaces.</p>
        </div>

        <div>
          <label htmlFor="symbol" className={formLabelClass}>Collection Symbol</label>
          <input type="text" id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} required className={formInputBaseClass} placeholder="e.g., HR24" />
          <p className={helperTextClass}>A short abbreviation for your collection (usually 3-6 characters). This helps identify your NFTs on blockchain explorers.</p>
        </div>

        <div>
          <label htmlFor="collectionDescription" className={formLabelClass}>Collection Description</label>
          <textarea id="collectionDescription" value={collectionDescription} onChange={(e) => setCollectionDescription(e.target.value)} rows={4} required className={formInputBaseClass} placeholder="Describe what makes this collection special - its story, heritage, and significance."></textarea>
          <p className={helperTextClass}>This description appears on marketplaces and tells potential buyers about your collection's story and value.</p>
        </div>

        <div>
          <label htmlFor="nftDescription" className={formLabelClass}>Individual NFT Description</label>
          <textarea id="nftDescription" value={nftDescription} onChange={(e) => setNftDescription(e.target.value)} rows={3} required className={formInputBaseClass} placeholder="Describe what each NFT represents (e.g., ownership of one premium whiskey barrel from Highland Reserve 2024)."></textarea>
          <p className={helperTextClass}>This description will appear on every individual NFT in your collection. It should explain what owning one NFT means.</p>
        </div>
        
        <div>
          <label htmlFor="collectionImageFile" className={formLabelClass}>Collection & NFT Image</label>
          <input type="file" id="collectionImageFile" onChange={(e) => setCollectionImageFile(e.target.files ? e.target.files[0] : null)} required className={fileInputClass} />
          <p className={helperTextClass}>Upload one high-quality image that will represent both your collection and all individual NFTs. This should be your best product photo (e.g., whiskey bottle, barrel, or distillery image).</p>
        </div>

        <hr className="my-8 border-stone-gray-300" />
        <h3 className="text-2xl font-serif text-whiskey-brown-dark font-semibold mb-4">Pricing & Supply</h3>

        <div>
          <label htmlFor="mintPriceSOL" className={formLabelClass}>Price Per NFT (in SOL)</label>
          <input type="number" id="mintPriceSOL" value={mintPriceSOL} onChange={(e) => setMintPriceSOL(e.target.value)} required step="0.001" min="0.001" className={formInputBaseClass} placeholder="e.g., 1.5" />
          <p className={helperTextClass}>How much will customers pay to mint one NFT? SOL is Solana's cryptocurrency. 1 SOL ≈ $20-200 (varies by market).</p>
        </div>

        <div>
          <label htmlFor="itemLimit" className={formLabelClass}>Total Supply (Maximum NFTs)</label>
          <input type="number" id="itemLimit" value={itemLimit} onChange={(e) => setItemLimit(e.target.value)} required step="1" min="1" className={formInputBaseClass} placeholder="e.g., 100"/>
          <p className={helperTextClass}>How many NFTs can be minted from this collection? Once all are minted, no more can be created. Lower numbers create more scarcity.</p>
        </div>

        <button 
            type="submit" 
            disabled={isLoading || companies.length === 0}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold font-sans text-white bg-amber-gold-DEFAULT hover:bg-amber-gold-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-gold-dark disabled:opacity-70 disabled:bg-stone-gray-400 transition-colors mt-8"
        >
          {isLoading ? 'Creating Collection...' : 'Create NFT Collection'}
        </button>
      </form>
    </div>
  );
}