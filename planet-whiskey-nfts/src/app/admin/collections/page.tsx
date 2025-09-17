'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, Connection } from '@solana/web3.js';
import { ICompany } from '@/models/Company';
import { convertUsdToWhiskeyTokens, getCurrentWhiskeyRate, formatWhiskeyTokens, formatUsdAmount, useRealTimeWhiskeyPrice } from '@/lib/coingeckoPricing';

// Shared Tailwind classes for form inputs
const formLabelClass = "block text-sm font-medium text-gray-700 mb-1";
  const formInputBaseClass = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-whiskey-brown focus:border-whiskey-brown text-black";
  const formSelectClass = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-whiskey-brown focus:border-whiskey-brown text-black";
const helperTextClass = "text-xs text-gray-500 mt-1";

export default function ManageCollectionsPage() {
  // Wallet connection
  const { publicKey, signTransaction } = useWallet();
  
  // Real-time WHISKEY price hook that updates every 5 seconds
  const { priceData, loading: priceLoading, error: priceError } = useRealTimeWhiskeyPrice();
  const realTimeWhiskeyRate = priceData?.usd || null;
  
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [mintPriceUsd, setMintPriceUsd] = useState('');
  const [itemLimit, setItemLimit] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collectionSymbol, setCollectionSymbol] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [nftBaseName, setNftBaseName] = useState('');
  const [nftBaseDescription, setNftBaseDescription] = useState('');
  
  const [collectionImage, setCollectionImage] = useState<File | null>(null);
  const [collectionImageConfirmed, setCollectionImageConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whiskeyRate, setWhiskeyRate] = useState<number | null>(null);
  const [calculatedWhiskeyAmount, setCalculatedWhiskeyAmount] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  // Whiskey-gated collection states
  const [showWhiskeyGatedForm, setShowWhiskeyGatedForm] = useState(false);
  const [whiskeyGatedName, setWhiskeyGatedName] = useState('');
  const [whiskeyGatedSymbol, setWhiskeyGatedSymbol] = useState('');
  const [whiskeyGatedDescription, setWhiskeyGatedDescription] = useState('');
  const [requiredWhiskeyAmount, setRequiredWhiskeyAmount] = useState('');
  const [whiskeyGatedItemLimit, setWhiskeyGatedItemLimit] = useState('');
  const [whiskeyGatedImage, setWhiskeyGatedImage] = useState<File | null>(null);
  const [whiskeyGatedImageConfirmed, setWhiskeyGatedImageConfirmed] = useState(false);
  const [isSubmittingWhiskeyGated, setIsSubmittingWhiskeyGated] = useState(false);
  const [createdCollectionMint, setCreatedCollectionMint] = useState<string | null>(null);

  // Simple price cache status function
  const getPriceCacheStatus = () => {
    return {
      source: 'CoinGecko API',
      lastUpdated: new Date().toISOString(),
      isStale: false
    };
  };

  // Fetch companies
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/admin/companies');
        if (response.ok) {
          const data = await response.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error('Error fetching companies:', error);
      }
    };

    fetchCompanies();
  }, []);

  // Use real-time WHISKEY rate from the hook
  useEffect(() => {
    if (realTimeWhiskeyRate) {
      setWhiskeyRate(realTimeWhiskeyRate);
    }
  }, [realTimeWhiskeyRate]);

  // Calculate WHISKEY amount when USD price changes
  useEffect(() => {
    const calculateWhiskeyAmount = async () => {
      if (mintPriceUsd && whiskeyRate) {
        try {
          const whiskeyAmount = await convertUsdToWhiskeyTokens(parseFloat(mintPriceUsd));
          setCalculatedWhiskeyAmount(formatWhiskeyTokens(whiskeyAmount));
        } catch (error) {
          console.error('Error calculating WHISKEY amount:', error);
          setCalculatedWhiskeyAmount('Error calculating');
        }
      } else {
        setCalculatedWhiskeyAmount('');
      }
    };

    calculateWhiskeyAmount();
  }, [mintPriceUsd, whiskeyRate]);

  // Handle regular collection image upload
  const handleCollectionImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setCollectionImage(file);
    if (file) {
      setCollectionImageConfirmed(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setCollectionImageConfirmed(false), 3000);
    } else {
      setCollectionImageConfirmed(false);
    }
  };

  // Handle whiskey-gated collection image upload
  const handleWhiskeyGatedImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setWhiskeyGatedImage(file);
    if (file) {
      setWhiskeyGatedImageConfirmed(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setWhiskeyGatedImageConfirmed(false), 3000);
    } else {
      setWhiskeyGatedImageConfirmed(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!signTransaction) {
      alert('Wallet does not support transaction signing');
      return;
    }
    
    if (!collectionImage) {
      alert('Please select a collection image');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Step 1: Prepare the transaction
      const formData = new FormData();
      formData.append('collectionImage', collectionImage);
      formData.append('collectionName', collectionName);
      formData.append('collectionSymbol', collectionSymbol);
      formData.append('collectionDescription', collectionDescription);
      formData.append('mintPriceUsd', mintPriceUsd);
      // Note: mintPriceWhiskey is calculated dynamically at mint time, not stored
      formData.append('itemLimit', itemLimit);
      formData.append('companyId', companyId);
      formData.append('nftBaseName', nftBaseName);
      formData.append('nftBaseDescription', nftBaseDescription);
      formData.append('adminWalletAddress', publicKey.toBase58());

      console.log('🔄 Preparing transaction...');
      const response = await fetch('/api/admin/collections', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error preparing transaction:', errorData);
        alert(`Error: ${errorData.message || 'Failed to prepare transaction'}`);
        return;
      }

      const { transaction, collectionData, needsWalletSignature } = await response.json();
      
      if (!needsWalletSignature) {
        alert('Transaction was processed without wallet signature (unexpected)');
        return;
      }

      // Step 2: Sign the transaction with wallet
      console.log('✍️ Please sign the transaction in your wallet...');
      const transactionBuffer = Buffer.from(transaction, 'base64');
      const transactionToSign = Transaction.from(transactionBuffer);
      
      const signedTransaction = await signTransaction(transactionToSign);
      
      // Step 3: Send the signed transaction for confirmation
      console.log('📡 Confirming transaction...');
      const confirmResponse = await fetch('/api/admin/collections/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedTransaction.serialize()).toString('base64'),
          collectionData,
        }),
      });

      if (confirmResponse.ok) {
        const result = await confirmResponse.json();
        alert('Collection created successfully! Transaction: ' + result.transactionSignature);
        console.log('✅ Collection created:', result);
        
        // Clear form
        setCollectionName('');
        setCollectionSymbol('');
        setCollectionDescription('');
        setMintPriceUsd('');
        setItemLimit('');
        setCompanyId('');
        setNftBaseName('');
        setNftBaseDescription('');
        setCollectionImage(null);
        setCalculatedWhiskeyAmount('');
        setRetryCount(0); // Reset retry count on success
      } else {
        const errorData = await confirmResponse.json();
        console.error('Error confirming transaction:', errorData);
        
        // Handle specific error types
        if (errorData.error === 'BLOCKHASH_EXPIRED' && retryCount < 3) {
          console.log(`🔄 Blockhash expired, retrying... (attempt ${retryCount + 1}/3)`);
          alert(`Transaction expired, retrying automatically... (attempt ${retryCount + 1}/3)`);
          
          // Increment retry count and retry
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            handleSubmit(event);
          }, 1000);
          return;
        } else if (errorData.error === 'BLOCKHASH_EXPIRED') {
          alert('Transaction failed after 3 retries. Please try again later.');
          setRetryCount(0); // Reset retry count
          return;
        } else if (errorData.error === 'INSUFFICIENT_FUNDS') {
          alert('❌ Insufficient SOL in your wallet for transaction fees. Please add SOL and try again.');
          return;
        } else if (errorData.error === 'CONFIRMATION_TIMEOUT') {
          alert('⏱️ Transaction confirmation timed out. The transaction may still succeed. Please check your wallet and refresh the page.');
          return;
        }
        
        alert(`Error: ${errorData.message || 'Failed to confirm transaction'}`);
      }
      
    } catch (error: any) {
      console.error('Error in collection creation flow:', error);
      if (error.message?.includes('User rejected')) {
        alert('Transaction was cancelled by user');
      } else {
        alert('An error occurred while creating the collection: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhiskeyGatedSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!signTransaction) {
      alert('Wallet does not support transaction signing');
      return;
    }
    
    if (!whiskeyGatedImage) {
      alert('Please select a collection image');
      return;
    }

    // Additional wallet connection verification
    console.log('🔐 Wallet connection status:', {
      publicKey: publicKey.toString(),
      hasSignTransaction: !!signTransaction,
      walletConnected: !!publicKey,
      signTransactionType: typeof signTransaction
    });

    // Test if signTransaction is actually callable
    if (!signTransaction || typeof signTransaction !== 'function') {
      alert('❌ Wallet signing function is not available. Please disconnect and reconnect your wallet.');
      return;
    }

    setIsSubmittingWhiskeyGated(true);
    setCreatedCollectionMint(null);

    try {
      // Create form data for API call
      const formData = new FormData();
      formData.append('name', whiskeyGatedName);
      formData.append('symbol', whiskeyGatedSymbol);
      formData.append('description', whiskeyGatedDescription);
      formData.append('requiredWhiskeyAmount', requiredWhiskeyAmount);
      formData.append('itemLimit', whiskeyGatedItemLimit);
      formData.append('isWhiskeyGated', 'true');
      formData.append('image', whiskeyGatedImage);

      console.log('🚀 Creating whiskey-gated collection...');
      
      const response = await fetch('/api/admin/collections/whiskey-gated', {
        method: 'POST',
        body: formData,
      });

      const responseData = await response.json();
      console.log('📡 API Response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
      }

      if (responseData.success && responseData.transactionData) {
        console.log('✅ Transaction data received, sending to wallet...');
        console.log('📊 Response data:', {
          hasTransactionData: !!responseData.transactionData,
          collectionMint: responseData.collectionMint,
          transactionDataLength: responseData.transactionData.length
        });
        
        // Create transaction from the response
        console.log('🔄 Creating transaction from base64 data...');
        const transaction = Transaction.from(Buffer.from(responseData.transactionData, 'base64'));
        console.log('📋 Transaction created:', {
          signatures: transaction.signatures.length,
          instructions: transaction.instructions.length,
          feePayer: transaction.feePayer?.toString(),
          recentBlockhash: transaction.recentBlockhash
        });

        // Ensure the transaction has the correct feePayer (should be the connected wallet)
        if (!transaction.feePayer || transaction.feePayer.toString() !== publicKey.toString()) {
          console.log('🔧 Setting feePayer to connected wallet...');
          transaction.feePayer = publicKey;
        }

        // Get fresh blockhash if needed
        if (!transaction.recentBlockhash) {
          console.log('🔄 Getting fresh blockhash...');
          const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
          const { blockhash } = await connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
        }
        
        // Sign and send transaction
        console.log('🖊️ Requesting wallet signature...');
        console.log('🔍 Transaction details before signing:', {
          feePayer: transaction.feePayer?.toString(),
          recentBlockhash: transaction.recentBlockhash,
          instructionCount: transaction.instructions.length,
          signaturesRequired: transaction.signatures.length
        });
        
        let signedTransaction;
        try {
          // Add a small delay to ensure UI is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          signedTransaction = await signTransaction(transaction);
          console.log('✅ Transaction signed by wallet');
        } catch (signError) {
          console.error('❌ Error signing transaction:', signError);
          console.error('❌ Full error object:', signError);
          throw new Error(`Failed to sign transaction: ${signError instanceof Error ? signError.message : 'Unknown signing error'}`);
        }
        const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        console.log('📡 Transaction sent:', signature);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
        }
        
        console.log('✅ Whiskey-gated collection created successfully!');
        
        // Show collection mint address
        if (responseData.collectionMint) {
          setCreatedCollectionMint(responseData.collectionMint);
        }
        
        // Automatically save to database
        try {
          console.log('💾 Saving collection to database...');
          const dbResponse = await fetch('/api/admin/collections/whiskey-gated-confirm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: whiskeyGatedName,
              symbol: whiskeyGatedSymbol,
              metadataUri: responseData.metadataUri,
              collectionMint: responseData.collectionMint,
              collectionConfig: responseData.collectionConfig,
              requiredWhiskeyAmount: parseInt(requiredWhiskeyAmount),
              itemLimit: parseInt(whiskeyGatedItemLimit),
            }),
          });

          const dbResponseData = await dbResponse.json();
          
          if (dbResponse.ok && dbResponseData.success) {
            console.log('✅ Collection saved to database successfully!');
            alert(`🎉 Whiskey-gated collection created and saved successfully!\n\nCollection Mint: ${responseData.collectionMint}\n\nTransaction: ${signature}\n\n✨ Collection is now visible in the Whiskey Rewards section!`);
          } else {
            console.warn('⚠️ Collection created on-chain but failed to save to database:', dbResponseData.message);
            alert(`🎉 Whiskey-gated collection created successfully!\n\nCollection Mint: ${responseData.collectionMint}\n\nTransaction: ${signature}\n\n⚠️ Note: Collection created on-chain but may not appear in frontend yet.`);
          }
        } catch (dbError) {
          console.error('Error saving to database:', dbError);
          alert(`🎉 Whiskey-gated collection created successfully!\n\nCollection Mint: ${responseData.collectionMint}\n\nTransaction: ${signature}\n\n⚠️ Note: Collection created on-chain but may not appear in frontend yet.`);
        }
        
        // Reset form
        setWhiskeyGatedName('');
        setWhiskeyGatedSymbol('');
        setWhiskeyGatedDescription('');
        setRequiredWhiskeyAmount('');
        setWhiskeyGatedItemLimit('');
        setWhiskeyGatedImage(null);
        
      } else {
        throw new Error(responseData.message || 'Failed to create whiskey-gated collection');
      }
      
    } catch (error: any) {
      console.error('Error in whiskey-gated collection creation:', error);
      if (error.message?.includes('User rejected')) {
        alert('Transaction was cancelled by user');
      } else {
        alert('An error occurred while creating the whiskey-gated collection: ' + error.message);
      }
    } finally {
      setIsSubmittingWhiskeyGated(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-whiskey-brown-dark">Create New NFT Collection</h2>

      {/* Real-Time WHISKEY Price Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-green-800 mb-2">🚀 Real-Time WHISKEY Price via CoinGecko (Updates Every 30s)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-green-700">Live Rate:</span>
            <span className="ml-2 text-green-600 font-semibold">
              {priceLoading ? '🔄 Updating...' : priceError ? '❌ Error' : realTimeWhiskeyRate ? `$${realTimeWhiskeyRate.toFixed(8)} USD` : 'No Data'}
            </span>
          </div>
          <div>
            <span className="font-medium text-green-700">Status:</span>
            <span className="ml-2 text-green-600">
              {priceLoading ? '🔄 Live' : priceError ? '❌ Error' : '✅ Live'}
            </span>
          </div>
          <div>
            <span className="font-medium text-green-700">Update Frequency:</span>
            <span className="ml-2 text-green-600">
              Every 30 seconds
            </span>
          </div>
        </div>
        {priceError && (
          <p className="text-red-600 text-sm mt-2">
            ❌ Error: {priceError}
          </p>
        )}
        <p className="text-green-700 text-sm mt-2">
          💡 This price updates automatically every 30 seconds using the CoinGecko API for accurate USD conversions.
          {!realTimeWhiskeyRate && !priceLoading && !priceError && (
            <span className="block mt-1 text-amber-600">
              ⚠️ No real-time price available. Using CoinGecko API.
            </span>
          )}
        </p>
      </div>

      {/* Legacy WHISKEY Price Status (for reference) */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-800 mb-2">📊 Manual WHISKEY Price Check</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-700">Rate:</span>
            <span className="ml-2 text-blue-600">
              {whiskeyRate ? `$${whiskeyRate.toFixed(8)} USD` : 'Loading...'}
            </span>
          </div>
          <div>
            <span className="font-medium text-blue-700">Source:</span>
            <span className="ml-2 text-blue-600">
              {getPriceCacheStatus().source}
            </span>
          </div>
          <div>
            <span className="font-medium text-blue-700">Last Updated:</span>
            <span className="ml-2 text-blue-600">
              {new Date(getPriceCacheStatus().lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>
        {getPriceCacheStatus().isStale && (
          <p className="text-orange-600 text-sm mt-2">
            ⚠️ Price may be stale. Consider refreshing.
          </p>
        )}
      </div>

      <div className="bg-cream shadow-lg rounded-lg p-6 border border-whiskey-brown-light">
        <h3 className="text-xl font-serif font-medium mb-6 text-whiskey-brown-dark">Collection Details</h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="collectionName" className={formLabelClass}>Collection Name</label>
              <input
                type="text"
                id="collectionName"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                required
                className={formInputBaseClass}
                placeholder="e.g., Whiskey Barrel Series"
              />
            </div>
            
            <div>
              <label htmlFor="collectionSymbol" className={formLabelClass}>Collection Symbol</label>
              <input
                type="text"
                id="collectionSymbol"
                value={collectionSymbol}
                onChange={(e) => setCollectionSymbol(e.target.value)}
                required
                maxLength={10}
                className={formInputBaseClass}
                placeholder="e.g., WBARREL"
              />
            </div>
            
            <div>
              <label htmlFor="collectionDescription" className={formLabelClass}>Collection Description</label>
              <textarea
                id="collectionDescription"
                value={collectionDescription}
                onChange={(e) => setCollectionDescription(e.target.value)}
                required
                rows={3}
                className={formInputBaseClass}
                placeholder="Describe what this collection represents..."
              />
            </div>
          </div>

          {/* Pricing Section */}
          <div className="bg-whiskey-brown-light/20 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-whiskey-brown-dark mb-4">💰 Pricing Configuration</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="mintPriceUsd" className={formLabelClass}>Price Per NFT (in USD)</label>
                <input 
                  type="number" 
                  id="mintPriceUsd" 
                  value={mintPriceUsd} 
                  onChange={(e) => setMintPriceUsd(e.target.value)} 
                  required 
                  step="0.01" 
                  min="0.01" 
                  className={formInputBaseClass} 
                  placeholder="e.g., 50.00" 
                />
                <p className={helperTextClass}>Set the USD value for lending protocol calculations. This determines borrowing power.</p>
              </div>
              
              <div>
                <label htmlFor="mintPriceWhiskey" className={formLabelClass}>Price Per NFT (in WHISKEY)</label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600">
                  {calculatedWhiskeyAmount || 'Enter USD price above to calculate'}
                </div>
                <p className={helperTextClass}>Auto-calculated from USD price using current WHISKEY rate</p>
              </div>
            </div>

            {/* Price Display */}
            {mintPriceUsd && calculatedWhiskeyAmount && (
              <div className="mt-4 p-3 bg-white rounded-lg border border-whiskey-brown-light">
                <h5 className="font-medium text-whiskey-brown-dark mb-2">💡 Price Summary</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">USD Price:</span>
                    <span className="ml-2 text-gray-900">{formatUsdAmount(parseFloat(mintPriceUsd))}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">WHISKEY Cost:</span>
                    <span className="ml-2 text-gray-900">{calculatedWhiskeyAmount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* NFT Base Information */}
          <div className="bg-whiskey-brown-light/20 p-4 rounded-lg">
            <h4 className="text-lg font-medium text-whiskey-brown-dark mb-4">🎨 NFT Base Information</h4>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label htmlFor="nftBaseName" className={formLabelClass}>NFT Base Name</label>
                <input
                  type="text"
                  id="nftBaseName"
                  value={nftBaseName}
                  onChange={(e) => setNftBaseName(e.target.value)}
                  required
                  className={formInputBaseClass}
                  placeholder="e.g., Whiskey Barrel #"
                />
                <p className={helperTextClass}>Base name for individual NFTs (will be appended with number)</p>
              </div>
              
              <div>
                <label htmlFor="nftBaseDescription" className={formLabelClass}>NFT Base Description</label>
                <textarea
                  id="nftBaseDescription"
                  value={nftBaseDescription}
                  onChange={(e) => setNftBaseDescription(e.target.value)}
                  required
                  rows={3}
                  className={formInputBaseClass}
                  placeholder="e.g., A premium treasury NFT from our exclusive collection..."
                />
                <p className={helperTextClass}>Base description for individual NFTs in this collection</p>
              </div>
            </div>
          </div>

          {/* Collection Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="itemLimit" className={formLabelClass}>Maximum NFTs in Collection</label>
              <input
                type="number"
                id="itemLimit"
                value={itemLimit}
                onChange={(e) => setItemLimit(e.target.value)}
                required
                min="1"
                max="10000"
                className={formInputBaseClass}
                placeholder="e.g., 1000"
              />
              <p className={helperTextClass}>Maximum number of NFTs that can be minted in this collection</p>
            </div>
            
            <div>
              <label htmlFor="companyId" className={formLabelClass}>Asset Type</label>
              <select
                id="companyId"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className={formSelectClass}
              >
                <option value="">Select Asset Type</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <p className={helperTextClass}>The type of asset this collection represents</p>
            </div>
          </div>

          {/* Collection Image */}
          <div>
            <label htmlFor="collectionImage" className={formLabelClass}>Collection Image</label>
            <input
              type="file"
              id="collectionImage"
              onChange={handleCollectionImageChange}
              accept="image/*,video/*,.gif,.mp4,.webm,.mov,.avi"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-whiskey-brown focus:border-whiskey-brown"
            />
            {collectionImageConfirmed && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-700 flex items-center">
                  <span className="mr-2">✅</span>
                  Image received and ready for collection creation!
                </p>
              </div>
            )}
            <p className={helperTextClass}>Upload an image, GIF, or video to represent this collection (supports JPG, PNG, GIF, MP4, WebM)</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-whiskey-brown text-white py-3 px-6 rounded-md hover:bg-whiskey-brown-dark focus:ring-2 focus:ring-whiskey-brown focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating Collection...' : 'Create Collection'}
          </button>
        </form>
      </div>

      {/* Whiskey-Gated Collections Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-amber-800">🥃 Whiskey-Gated Collections</h3>
            <p className="text-sm text-amber-700 mt-1">
              Create exclusive collections that require WHISKEY token holdings to mint. These NFTs are free to mint for qualified users and cannot be used for lending.
            </p>
          </div>
          <button
            onClick={() => setShowWhiskeyGatedForm(!showWhiskeyGatedForm)}
            className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 transition-colors"
          >
            {showWhiskeyGatedForm ? 'Hide Form' : 'Create Gated Collection'}
          </button>
        </div>

        {showWhiskeyGatedForm && (
          <form onSubmit={handleWhiskeyGatedSubmit} className="space-y-6">
            {/* Collection Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="whiskeyGatedName" className={formLabelClass}>Collection Name</label>
                <input
                  type="text"
                  id="whiskeyGatedName"
                  value={whiskeyGatedName}
                  onChange={(e) => setWhiskeyGatedName(e.target.value)}
                  required
                  className={formInputBaseClass}
                  placeholder="e.g., Platinum Holders Club"
                />
                <p className={helperTextClass}>Name of the exclusive collection</p>
              </div>
              
              <div>
                <label htmlFor="whiskeyGatedSymbol" className={formLabelClass}>Collection Symbol</label>
                <input
                  type="text"
                  id="whiskeyGatedSymbol"
                  value={whiskeyGatedSymbol}
                  onChange={(e) => setWhiskeyGatedSymbol(e.target.value)}
                  required
                  maxLength={10}
                  className={formInputBaseClass}
                  placeholder="e.g., PHC"
                />
                <p className={helperTextClass}>Short symbol for the collection (max 10 characters)</p>
              </div>
            </div>

            <div>
              <label htmlFor="whiskeyGatedDescription" className={formLabelClass}>Collection Description</label>
              <textarea
                id="whiskeyGatedDescription"
                value={whiskeyGatedDescription}
                onChange={(e) => setWhiskeyGatedDescription(e.target.value)}
                required
                rows={3}
                className={formInputBaseClass}
                placeholder="e.g., Exclusive NFTs for WHISKEY token holders with 10,000+ tokens..."
              />
              <p className={helperTextClass}>Description of the exclusive collection and its benefits</p>
            </div>

            {/* Gating Requirements */}
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-3">🔒 Gating Requirements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="requiredWhiskeyAmount" className={formLabelClass}>Required WHISKEY Tokens</label>
                  <input
                    type="number"
                    id="requiredWhiskeyAmount"
                    value={requiredWhiskeyAmount}
                    onChange={(e) => setRequiredWhiskeyAmount(e.target.value)}
                    required
                    min="1"
                    className={formInputBaseClass}
                    placeholder="e.g., 10000"
                  />
                  <p className={helperTextClass}>Minimum WHISKEY tokens required in wallet to mint (full tokens, not lamports)</p>
                </div>
                
                <div>
                  <label htmlFor="whiskeyGatedItemLimit" className={formLabelClass}>Maximum NFTs in Collection</label>
                  <input
                    type="number"
                    id="whiskeyGatedItemLimit"
                    value={whiskeyGatedItemLimit}
                    onChange={(e) => setWhiskeyGatedItemLimit(e.target.value)}
                    required
                    min="1"
                    max="10000"
                    className={formInputBaseClass}
                    placeholder="e.g., 500"
                  />
                  <p className={helperTextClass}>Maximum number of NFTs in this exclusive collection</p>
                </div>
              </div>
            </div>

            {/* Collection Image */}
            <div>
              <label htmlFor="whiskeyGatedImage" className={formLabelClass}>Collection Image/Media</label>
              <input
                type="file"
                id="whiskeyGatedImage"
                onChange={handleWhiskeyGatedImageChange}
                accept="image/*,video/*,.gif,.mp4,.webm,.mov,.avi"
                required
                className="w-full px-3 py-2 border border-amber-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              {whiskeyGatedImageConfirmed && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-700 flex items-center">
                    <span className="mr-2">✅</span>
                    Image received and ready for Master Distiller collection creation!
                  </p>
                </div>
              )}
              <p className={helperTextClass}>Upload an image, GIF, or video for this Master Distiller collection</p>
            </div>

            {/* Important Notice */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">⚠️ Important Notes</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• These NFTs are <strong>FREE TO MINT</strong> for qualified users</li>
                <li>• Users must hold the required WHISKEY tokens in their wallet</li>
                <li>• These NFTs <strong>CANNOT be used for lending</strong></li>
                <li>• After creation, copy the collection mint address and remove it from the lending approval list</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmittingWhiskeyGated}
              className="w-full bg-amber-600 text-white py-3 px-6 rounded-md hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmittingWhiskeyGated ? 'Creating Gated Collection...' : 'Create Whiskey-Gated Collection'}
            </button>
          </form>
        )}

        {/* Collection Mint Display Modal */}
        {createdCollectionMint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-green-800 mb-4">🎉 Collection Created Successfully!</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Collection Mint Address:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={createdCollectionMint}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(createdCollectionMint)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Next Steps:</strong>
                    <br />1. Copy the collection mint address above
                    <br />2. Go to Lending Admin → Sync Collections
                    <br />3. Remove this collection from the approved lending list
                  </p>
                </div>
                <button
                  onClick={() => setCreatedCollectionMint(null)}
                  className="w-full bg-gray-600 text-white py-2 rounded-md hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}