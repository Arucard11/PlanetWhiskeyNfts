'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { getSolanaConnection, getAnchorProvider } from '../../../lib/solanaUtils';

interface LendingConfig {
  // Interest rates (2.5% - 25%)
  interestRate1MonthBps: number;
  interestRate2MonthBps: number;
  interestRate3MonthBps: number;
  
  // Utilization-based rate parameters
  optimalUtilizationRateBps: number;     // 50% - 95%
  maxInterestRateMultiplierBps: number;  // 1x - 5x (10000-50000 bps)
  utilizationSlope1Bps: number;          // Rate increase before optimal
  utilizationSlope2Bps: number;          // Rate increase after optimal
  
  // Fee configuration (1% - 5% transaction fee)
  transactionFeeBps: number;
  
  // NFT collateral limits (500 - 10,000)
  maxStakedNfts: number;
  currentStakedNfts: number;
  
  // Loan-to-Value ratio (40% - 90%)
  loanToValueRatioBps: number;
  
  
  // Revenue split (configurable)
  lendingWalletShareBps: number;
  treasuryWalletShareBps: number;
}

interface LendingStats {
  totalLoansActive: number;
  totalDebtOutstanding: string;
  totalCollateralValue: string;
  averageNftValue: string;
}

export default function LendingAdminPage() {
  const { connected, publicKey, signTransaction, wallet } = useWallet();
  const [config, setConfig] = useState<LendingConfig | null>(null);
  const [stats, setStats] = useState<LendingStats | null>(null);
  const [loading, setLoading] = useState(false); // Changed to false since we're not auto-loading
  const [updating, setUpdating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [updatingValues, setUpdatingValues] = useState(false);
  const [deploymentInfo, setDeploymentInfo] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data has been loaded
  
  // Collection Registry state
  const [collections, setCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [newCollectionMint, setNewCollectionMint] = useState('');
  const [newCollectionValue, setNewCollectionValue] = useState('');
  const [addingCollection, setAddingCollection] = useState(false);

  
  // Solana connection - memoized to prevent recreation on every render
  const connection = React.useMemo(() => 
    new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'),
    []
  );
  
  // Form state for updates - memoized to prevent unnecessary re-renders
  const [formData, setFormData] = useState({
    interestRate1Month: '',
    interestRate2Month: '',
    interestRate3Month: '',
    optimalUtilizationRate: '',
    maxInterestRateMultiplier: '',
    utilizationSlope1: '',
    utilizationSlope2: '',
    loanToValueRatio: '',
    transactionFee: '',
    maxStakedNfts: '',
    lendingWalletShare: '',
    treasuryWalletShare: '',
  });

  // Memoized form update function to prevent unnecessary re-renders
  const updateFormData = React.useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Remove automatic loading - admin will manually fetch data
  // useEffect(() => {
  //   // Data loading removed to prevent memory issues
  // }, []);

  // Manual data loading function
  const handleLoadOnChainData = async () => {
    if (isLoadingData) return;
    
    setIsLoadingData(true);
    setLoading(true);
    
    try {
      await Promise.all([
        fetchLendingConfig(),
        fetchLendingStats(),
        loadDeploymentInfo()
      ]);
      setDataLoaded(true);
      toast.success('On-chain data loaded successfully!');
    } catch (error) {
      console.error('Error loading on-chain data:', error);
      toast.error('Failed to load on-chain data');
    } finally {
      setIsLoadingData(false);
      setLoading(false);
    }
  };

  const fetchLendingConfig = async () => {
    try {
      const response = await fetch('/api/admin/lending/config');
      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          setConfig(result);
          
          // Populate form with current values
          setFormData({
            interestRate1Month: (result.interestRate1MonthBps / 100).toString(),
            interestRate2Month: (result.interestRate2MonthBps / 100).toString(),
            interestRate3Month: (result.interestRate3MonthBps / 100).toString(),
            optimalUtilizationRate: (result.optimalUtilizationRateBps / 100).toString(),
            maxInterestRateMultiplier: (result.maxInterestRateMultiplierBps / 100).toString(),
            utilizationSlope1: (result.utilizationSlope1Bps / 100).toString(),
            utilizationSlope2: (result.utilizationSlope2Bps / 100).toString(),
            loanToValueRatio: (result.loanToValueRatioBps / 100).toString(),
            transactionFee: (result.transactionFeeBps / 100).toString(),
            maxStakedNfts: result.maxStakedNfts.toString(),
            lendingWalletShare: (result.lendingWalletShareBps / 100).toString(),
            treasuryWalletShare: (result.treasuryWalletShareBps / 100).toString(),
          });
        } else {
          console.error('API returned error:', result.message);
          toast.error(result.message || 'Failed to fetch lending configuration');
        }
      }
    } catch (error) {
      console.error('Error fetching lending config:', error);
      toast.error('Failed to fetch lending configuration');
    }
  };

  const fetchLendingStats = async () => {
    try {
      const response = await fetch('/api/admin/lending/stats');
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Stats API Response:', data);
        if (data.success && data.stats) {
          setStats({
            totalLoansActive: data.stats.totalLoansActive,
            totalDebtOutstanding: data.stats.totalDebtOutstanding,
            totalCollateralValue: data.stats.totalCollateralValue,
            averageNftValue: data.stats.averageNftValue,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching lending stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeploymentInfo = async () => {
    try {
      // Set the deployment info with the program ID from environment variables
      const lendingProgramId = process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ';
      
      // Derive the GlobalMarket PDA (this matches what the API does)
      const globalMarketSeed = Buffer.from('global_market');
      const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [globalMarketSeed],
        new PublicKey(lendingProgramId)
      );
      
      setDeploymentInfo({
        lendingProgramId,
        globalMarketPda: globalMarketPda.toString(),
        network: process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('devnet') ? 'Devnet' : 'Mainnet'
      });
    } catch (error) {
      console.error('Error loading deployment info:', error);
      // Set fallback deployment info
      setDeploymentInfo({
        lendingProgramId: '25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ',
        globalMarketPda: 'Deriving...',
        network: 'Devnet'
      });
    }
  };



  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);

    try {
      // Validate ranges
      const interestRate1Month = parseFloat(formData.interestRate1Month);
      const interestRate2Month = parseFloat(formData.interestRate2Month);
      const interestRate3Month = parseFloat(formData.interestRate3Month);
      const optimalUtilizationRate = parseFloat(formData.optimalUtilizationRate);
      const maxInterestRateMultiplier = parseFloat(formData.maxInterestRateMultiplier);
      const utilizationSlope1 = parseFloat(formData.utilizationSlope1);
      const utilizationSlope2 = parseFloat(formData.utilizationSlope2);
      const loanToValueRatio = parseFloat(formData.loanToValueRatio);
      const transactionFee = parseFloat(formData.transactionFee);
      const maxStakedNfts = parseInt(formData.maxStakedNfts);
      const lendingWalletShare = parseFloat(formData.lendingWalletShare);
      const treasuryWalletShare = parseFloat(formData.treasuryWalletShare);

      // Validation
      if (interestRate1Month < 2.5 || interestRate1Month > 25) {
        toast.error('Interest rates must be between 2.5% and 25%');
        return;
      }
      if (interestRate2Month < 2.5 || interestRate2Month > 25) {
        toast.error('Interest rates must be between 2.5% and 25%');
        return;
      }
      if (interestRate3Month < 2.5 || interestRate3Month > 25) {
        toast.error('Interest rates must be between 2.5% and 25%');
        return;
      }
      if (optimalUtilizationRate < 50 || optimalUtilizationRate > 95) {
        toast.error('Optimal utilization rate must be between 50% and 95%');
        return;
      }
      if (maxInterestRateMultiplier < 100 || maxInterestRateMultiplier > 500) {
        toast.error('Max interest rate multiplier must be between 100% (1x) and 500% (5x)');
        return;
      }
      if (utilizationSlope1 < 0 || utilizationSlope1 > 100) {
        toast.error('Utilization slope 1 must be between 0% and 100%');
        return;
      }
      if (utilizationSlope2 < 0 || utilizationSlope2 > 200) {
        toast.error('Utilization slope 2 must be between 0% and 200%');
        return;
      }
      if (loanToValueRatio < 40 || loanToValueRatio > 90) {
        toast.error('Loan-to-Value ratio must be between 40% and 90%');
        return;
      }
      if (transactionFee < 1 || transactionFee > 5) {
        toast.error('Transaction fee must be between 1% and 5%');
        return;
      }
      if (maxStakedNfts < 500 || maxStakedNfts > 10000) {
        toast.error('Max staked NFTs must be between 500 and 10,000');
        return;
      }
      if (config && maxStakedNfts < config.currentStakedNfts) {
        toast.error('Max staked NFTs cannot be lower than currently staked NFTs');
        return;
      }
      if (Math.abs(lendingWalletShare + treasuryWalletShare - 100) > 0.01) {
        toast.error('Revenue split percentages must add up to 100%');
        return;
      }

      const response = await fetch('/api/admin/lending/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interestRate1MonthBps: Math.round(interestRate1Month * 100),
          interestRate2MonthBps: Math.round(interestRate2Month * 100),
          interestRate3MonthBps: Math.round(interestRate3Month * 100),
          optimalUtilizationRateBps: Math.round(optimalUtilizationRate * 100),
          maxInterestRateMultiplierBps: Math.round(maxInterestRateMultiplier * 100),
          utilizationSlope1Bps: Math.round(utilizationSlope1 * 100),
          utilizationSlope2Bps: Math.round(utilizationSlope2 * 100),
          loanToValueRatioBps: Math.round(loanToValueRatio * 100),
          transactionFeeBps: Math.round(transactionFee * 100),
          lendingWalletShareBps: Math.round(lendingWalletShare * 100),
          treasuryWalletShareBps: Math.round(treasuryWalletShare * 100),
          maxStakedNfts,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔍 API Response:', result);
        console.log('🔍 Connected wallet:', publicKey?.toString());
        console.log('🔍 Required admin wallet:', result.adminWallet);
        console.log('🔍 Wallet connected:', connected);
        console.log('🔍 Requires wallet signing:', result.requiresWalletSigning);
        
        if (result.requiresWalletSigning) {
          // Check if user has the correct wallet connected
          if (!connected || !publicKey) {
            toast.error('Please connect your admin wallet to sign this transaction');
            return;
          }
          
          if (publicKey.toString() !== result.adminWallet) {
            toast.error(`Please connect the admin wallet: ${result.adminWallet}`);
            return;
          }
          
          // Sign and send the transaction
          try {
            if (!wallet || !wallet.adapter) {
              throw new Error('Wallet not properly connected');
            }
            
            // Deserialize the transaction
            const transactionBytes = result.transaction;
            const transaction = Transaction.from(Buffer.from(transactionBytes));
            
            // Send the transaction (wallet will sign it)
            const signature = await wallet.adapter.sendTransaction(transaction, connection);
            
            // Wait for confirmation
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            
            if (confirmation.value.err) {
              throw new Error('Transaction failed to confirm');
            }
            
            toast.success('Configuration updated successfully on-chain!');
          } catch (txError) {
            console.error('Transaction error:', txError);
            toast.error('Transaction failed: ' + (txError instanceof Error ? txError.message : 'Unknown error'));
            return;
          }
        } else {
          toast.success('Lending configuration updated successfully');
        }
        
        await fetchLendingConfig();
        await fetchLendingStats();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update configuration');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error('Failed to update configuration');
    } finally {
      setUpdating(false);
    }
  };

  const handleClientSideCollectionSync = async (
    collectionsToAdd: Array<{ mintAddress: string; valueUsd: number }>, 
    registryAddress: string, 
    globalMarketAddress: string
  ) => {
    if (!publicKey || !signTransaction) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Setup connection and provider
      const connection = getSolanaConnection();
      const provider = new anchor.AnchorProvider(
        connection,
        wallet?.adapter as any,
        { preflightCommitment: 'confirmed' }
      );
      
      // Load the lending program IDL
      const lendingIdl = require('../../../lib/idl/lendingprogram.json');
      const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
      const program = new anchor.Program(lendingIdl as any, provider);
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add instructions for each collection
      for (const collection of collectionsToAdd) {
        console.log(`Adding collection ${collection.mintAddress} with value $${collection.valueUsd}`);
        
        const addCollectionInstruction = await program.methods
          .addCollection(
            new PublicKey(collection.mintAddress),
            new anchor.BN(collection.valueUsd * 1_000_000) // Convert to microdollars
          )
          .accounts({
            collectionRegistry: new PublicKey(registryAddress),
            admin: publicKey,
          })
          .instruction();
          
        transaction.add(addCollectionInstruction);
      }
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      console.log('🔐 Requesting wallet signature...');
      toast('Please sign the transaction in your wallet');
      
      // Sign transaction
      const signedTransaction = await signTransaction(transaction);
      
      console.log('📤 Sending transaction...');
      toast('Sending transaction...');
      
      // Send and confirm transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      console.log('⏳ Confirming transaction:', signature);
      toast('Confirming transaction...');
      
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      });
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log('✅ Transaction confirmed:', signature);
      toast.success(`Successfully added ${collectionsToAdd.length} collections to lending protocol!`);
      
      // Refresh the lending config to show updated data
      await fetchLendingConfig();
      await fetchCollections();
      
    } catch (error) {
      console.error('❌ Error adding collections:', error);
      toast.error(`Failed to add collections: ${error.message || error}`);
    }
  };

  const handleSyncCollections = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/lending/sync-collections', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.requiresClientSideSigning && result.collectionsToAdd?.length > 0) {
          toast(`Found ${result.collectionsToAdd.length} collections to add. Please check your wallet to sign the transaction.`);
          console.log('Collections to add:', result.collectionsToAdd);
          
          // Implement client-side transaction signing for adding collections
          await handleClientSideCollectionSync(result.collectionsToAdd, result.registryAddress, result.globalMarketAddress);
        } else if (result.newCollectionsAdded !== undefined) {
          toast.success(`Synced ${result.newCollectionsAdded} new collections with lending protocol`);
        } else {
          toast('No new collections to sync');
        }
        
        await fetchLendingConfig(); // Refresh data
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to sync collections');
      }
    } catch (error) {
      console.error('Error syncing collections:', error);
      toast.error('Failed to sync collections');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateNftValues = async () => {
    setUpdatingValues(true);
    try {
      const response = await fetch('/api/admin/lending/update-nft-values', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'NFT values updated successfully');
        await fetchLendingConfig(); // Refresh config
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update NFT values');
      }
    } catch (error) {
      console.error('Error updating NFT values:', error);
      toast.error('Failed to update NFT values');
    } finally {
      setUpdatingValues(false);
    }
  };

  // Collection Registry Management Functions
  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const response = await fetch('/api/admin/lending/collections');
      if (response.ok) {
        const result = await response.json();
        setCollections(result.collections || []);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to fetch collections');
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      toast.error('Failed to fetch collections');
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleAddCollection = async () => {
    if (!newCollectionMint || !newCollectionValue) {
      toast.error('Please fill in all fields');
      return;
    }

    setAddingCollection(true);
    try {
      const response = await fetch('/api/admin/lending/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionMint: newCollectionMint,
          valueUsd: parseFloat(newCollectionValue)
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.needsWalletSignature) {
          // Handle wallet signature
          const transactionBuffer = Buffer.from(result.transaction, 'base64');
          const transaction = Transaction.from(transactionBuffer);
          
          if (signTransaction) {
            const signedTransaction = await signTransaction(transaction);
            
            // Send signed transaction
            const confirmResponse = await fetch('/api/admin/lending/collections/confirm', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                signedTransaction: Buffer.from(signedTransaction.serialize()).toString('base64'),
                collectionMint: newCollectionMint,
                valueUsd: parseFloat(newCollectionValue)
              }),
            });

            if (confirmResponse.ok) {
              toast.success('Collection added successfully');
              setNewCollectionMint('');
              setNewCollectionValue('');
              await fetchCollections();
            } else {
              const error = await confirmResponse.json();
              toast.error(error.message || 'Failed to confirm transaction');
            }
          } else {
            toast.error('Wallet does not support transaction signing');
          }
        } else {
          toast.success('Collection added successfully');
          setNewCollectionMint('');
          setNewCollectionValue('');
          await fetchCollections();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to add collection');
      }
    } catch (error) {
      console.error('Error adding collection:', error);
      toast.error('Failed to add collection');
    } finally {
      setAddingCollection(false);
    }
  };

  const handleToggleCollectionApproval = async (collectionMint: string) => {
    try {
      const response = await fetch('/api/admin/lending/collections', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionMint,
          toggleApproval: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.needsWalletSignature) {
          // Handle wallet signature
          const transactionBuffer = Buffer.from(result.transaction, 'base64');
          const transaction = Transaction.from(transactionBuffer);
          
          if (signTransaction) {
            const signedTransaction = await signTransaction(transaction);
            
            // Send signed transaction
            const confirmResponse = await fetch('/api/admin/lending/collections/confirm', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                signedTransaction: Buffer.from(signedTransaction.serialize()).toString('base64'),
                collectionMint,
                toggleApproval: true
              }),
            });

            if (confirmResponse.ok) {
              toast.success('Collection approval toggled successfully');
              await fetchCollections();
            } else {
              const error = await confirmResponse.json();
              toast.error(error.message || 'Failed to confirm transaction');
            }
          } else {
            toast.error('Wallet does not support transaction signing');
          }
        } else {
          toast.success('Collection approval toggled successfully');
          await fetchCollections();
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to toggle collection approval');
      }
    } catch (error) {
      console.error('Error toggling collection approval:', error);
      toast.error('Failed to toggle collection approval');
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-amber-200 rounded mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-white rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-6 admin-page">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🏦 Lending Protocol Administration
          </h1>
          <p className="text-gray-600">
            Manage NFT collateral lending, interest rates, and protocol settings
          </p>
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>✅ Admin Access:</strong> Configure lending protocol settings and monitor borrowing activity.
            </p>
          </div>
          
          {/* Wallet Connection for Treasury Operations */}
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-800">
                  <strong>🔐 Admin Wallet:</strong> Required for protocol configuration changes
                </p>
                {connected && publicKey && (
                  <p className="text-xs text-amber-600 mt-1">
                    Connected: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                  </p>
                )}
              </div>
              <WalletMultiButton className="!bg-amber-600 hover:!bg-amber-700" />
            </div>
          </div>

          {/* Manual Data Loading Button */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-800">
                  <strong>📊 On-Chain Data:</strong> Click to load current lending protocol data
                </p>
                {dataLoaded && (
                  <p className="text-xs text-blue-600 mt-1">
                    ✅ Data loaded successfully
                  </p>
                )}
              </div>
              <button
                onClick={handleLoadOnChainData}
                disabled={isLoadingData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingData ? '🔄 Loading...' : '📊 Load On-Chain Data'}
              </button>
            </div>
          </div>
        </div>

        {/* No Data Loaded Message */}
        {!dataLoaded && !isLoadingData && (
          <div className="text-center py-12">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md mx-auto">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Data Loaded
              </h3>
              <p className="text-gray-600 mb-4">
                Click the "Load On-Chain Data" button above to fetch current lending protocol information.
              </p>
              <button
                onClick={handleLoadOnChainData}
                disabled={isLoadingData}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📊 Load On-Chain Data
              </button>
            </div>
          </div>
        )}

        {/* Loading Message */}
        {isLoadingData && (
          <div className="text-center py-12">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md mx-auto">
              <div className="text-6xl mb-4">🔄</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Loading On-Chain Data
              </h3>
              <p className="text-gray-600 mb-4">
                Fetching current lending protocol information...
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </div>
        )}

        {/* Stats Dashboard */}
        {dataLoaded && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Loans</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.totalLoansActive}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Outstanding Debt</h3>
              <p className="text-3xl font-bold text-red-600">${stats.totalDebtOutstanding}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Collateral Value</h3>
              <p className="text-3xl font-bold text-green-600">${stats.totalCollateralValue}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg NFT Value</h3>
              <p className="text-3xl font-bold text-purple-600">${stats.averageNftValue}</p>
            </div>
          </div>
        )}

        {dataLoaded && config && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Configuration Form */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                ⚙️ Protocol Configuration
              </h2>
              
              <form onSubmit={handleUpdateConfig} className="space-y-6">
                {/* Interest Rates */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    📈 Base Interest Rates (2.5% - 25%)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        1 Month Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2.5"
                        max="25"
                        value={formData.interestRate1Month}
                        onChange={(e) => updateFormData('interestRate1Month', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        2 Month Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2.5"
                        max="25"
                        value={formData.interestRate2Month}
                        onChange={(e) => updateFormData('interestRate2Month', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        3 Month Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="2.5"
                        max="25"
                        value={formData.interestRate3Month}
                        onChange={(e) => updateFormData('interestRate3Month', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Base rates when utilization is 0%. Actual rates increase with utilization.
                  </p>
                </div>

                {/* Utilization-Based Rate Parameters */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    📊 Utilization-Based Rate Parameters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Optimal Utilization Rate (50% - 95%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="50"
                        max="95"
                        value={formData.optimalUtilizationRate}
                        onChange={(e) => updateFormData('optimalUtilizationRate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Target utilization rate for optimal lending efficiency
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Rate Multiplier (100% - 500%)
                      </label>
                      <input
                        type="number"
                        step="10"
                        min="100"
                        max="500"
                        value={formData.maxInterestRateMultiplier}
                        onChange={(e) => updateFormData('maxInterestRateMultiplier', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maximum multiplier at 100% utilization (e.g., 300% = 3x base rate)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Utilization Slope 1 (0% - 100%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.utilizationSlope1}
                        onChange={(e) => updateFormData('utilizationSlope1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Rate increase before optimal utilization (gradual slope)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Utilization Slope 2 (0% - 200%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="200"
                        value={formData.utilizationSlope2}
                        onChange={(e) => updateFormData('utilizationSlope2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Rate increase after optimal utilization (steep slope)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Loan-to-Value Ratio */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    🏦 Loan-to-Value Configuration
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Loan-to-Value Ratio (40% - 90%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="40"
                        max="90"
                        value={formData.loanToValueRatio}
                        onChange={(e) => updateFormData('loanToValueRatio', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Percentage of NFT value that can be borrowed (e.g., 70% = users can borrow 70% of NFT value)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Fee Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    💰 Universal Fee Configuration
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transaction Fee (1% - 5%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={formData.transactionFee}
                        onChange={(e) => updateFormData('transactionFee', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Applied to all transactions across the entire platform (borrowing, marketplace, minting) - goes to treasury wallet
                      </p>
                    </div>
                  </div>
                </div>

                {/* NFT Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    🖼️ NFT Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Staked NFTs (500 - 10,000)
                      </label>
                      <input
                        type="number"
                        min="500"
                        max="10000"
                        value={formData.maxStakedNfts}
                        onChange={(e) => updateFormData('maxStakedNfts', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Current: {config.currentStakedNfts} NFTs staked
                      </p>
                    </div>
                  </div>
                </div>

                {/* Revenue Split Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    💰 Revenue Split Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lending Pool Share (%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.lendingWalletShare}
                        onChange={(e) => updateFormData('lendingWalletShare', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Percentage of mint revenue going to lending pool (converted to USDC)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Treasury Share (%)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.treasuryWalletShare}
                        onChange={(e) => updateFormData('treasuryWalletShare', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Percentage of mint revenue staying as WHISKEY in treasury
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Both percentages must add up to 100%
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating Configuration...' : 'Update Configuration'}
                </button>

                <button
                  type="button"
                  onClick={handleSyncCollections}
                  disabled={syncing}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {syncing ? 'Syncing Collections...' : '🔄 Sync NFT Collections'}
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Auto-register all active collections from database with lending protocol
                </p>

                <button
                  type="button"
                  onClick={handleLoadOnChainData}
                  disabled={isLoadingData}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {isLoadingData ? '🔄 Refreshing...' : '🔄 Refresh On-Chain Data'}
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Refresh current lending protocol data from blockchain
                </p>

                <button
                  type="button"
                  onClick={handleUpdateNftValues}
                  disabled={updatingValues}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {updatingValues ? 'Updating NFT Values...' : '💰 Update NFT Values from USD Prices'}
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Update lending protocol NFT values based on collection USD prices
                </p>

                {/* Collection Registry Management Section */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">📚 Collection Registry Management</h3>
                  
                  {/* Add New Collection */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h4 className="text-md font-medium text-gray-800 mb-3">Add New Collection</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Collection Mint Address
                        </label>
                        <input
                          type="text"
                          value={newCollectionMint}
                          onChange={(e) => setNewCollectionMint(e.target.value)}
                          placeholder="Enter collection mint address"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          USD Value per NFT
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={newCollectionValue}
                          onChange={(e) => setNewCollectionValue(e.target.value)}
                          placeholder="Enter USD value"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddCollection}
                      disabled={addingCollection || !newCollectionMint || !newCollectionValue}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingCollection ? 'Adding Collection...' : '➕ Add Collection'}
                    </button>
                  </div>

                  {/* Collections List */}
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="text-md font-medium text-gray-800">Approved Collections</h4>
                      <button
                        onClick={fetchCollections}
                        disabled={loadingCollections}
                        className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
                      >
                        {loadingCollections ? 'Loading...' : '🔄 Refresh'}
                      </button>
                    </div>
                    
                    {collections.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <div className="text-4xl mb-2">📚</div>
                        <p>No collections in registry</p>
                        <p className="text-sm">Add collections above or sync from database</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {collections.map((collection, index) => (
                          <div key={index} className="p-4 flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-sm text-gray-600">
                                  {collection.mint.slice(0, 8)}...{collection.mint.slice(-8)}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  collection.isApproved 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {collection.isApproved ? 'Approved' : 'Disapproved'}
                                </span>
                                {collection.isWhiskeyGated && (
                                  <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                    🥃 Whiskey Gated
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                Value: ${collection.valueUsd.toFixed(2)} USD
                                {collection.isWhiskeyGated && collection.requiredWhiskeyAmount > 0 && (
                                  <span className="ml-2 text-amber-600">
                                    • Requires {collection.requiredWhiskeyAmount} WHISKEY
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleCollectionApproval(collection.mint)}
                              className={`px-3 py-1 text-sm rounded-md ${
                                collection.isApproved
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {collection.isApproved ? 'Disapprove' : 'Approve'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>


              </form>
            </div>

            {/* Current Settings & Treasury Info */}
            <div className="space-y-6">
              {/* Current Settings */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  📊 Current Settings
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800">Base Interest Rates</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>1 Month: {(config.interestRate1MonthBps / 100).toFixed(1)}%</p>
                      <p>2 Months: {(config.interestRate2MonthBps / 100).toFixed(1)}%</p>
                      <p>3 Months: {(config.interestRate3MonthBps / 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800">Utilization Parameters</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Optimal Utilization: {(config.optimalUtilizationRateBps / 100).toFixed(1)}%</p>
                      <p>Max Rate Multiplier: {(config.maxInterestRateMultiplierBps / 100).toFixed(0)}% ({(config.maxInterestRateMultiplierBps / 10000).toFixed(1)}x)</p>
                      <p>Slope 1: {(config.utilizationSlope1Bps / 100).toFixed(1)}%</p>
                      <p>Slope 2: {(config.utilizationSlope2Bps / 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800">Loan Configuration</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>LTV Ratio: {(config.loanToValueRatioBps / 100).toFixed(1)}% (users can borrow {(config.loanToValueRatioBps / 100).toFixed(1)}% of NFT value)</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800">Universal Fees</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Transaction Fee: {(config.transactionFeeBps / 100).toFixed(1)}% → Treasury Wallet</p>
                      <p>Applied to all platform operations (lending, marketplace, minting)</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold text-gray-800">NFT Configuration</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Per-Collection Values: Set by collection USD prices</p>
                      <p>Max Staked: {config.maxStakedNfts.toLocaleString()}</p>
                      <p>Currently Staked: {config.currentStakedNfts.toLocaleString()}</p>
                      <p>Available: {(config.maxStakedNfts - config.currentStakedNfts).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>



              {/* Revenue Split Information */}
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  💰 Revenue Split
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800">NFT Mint Revenue Distribution</h4>
                    <div className="text-sm text-gray-600 space-y-2">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                        <span>Lending Pool (USDC)</span>
                        <span className="font-bold text-blue-600">{(config.lendingWalletShareBps / 100)}%</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-amber-50 rounded">
                        <span>Treasury (WHISKEY)</span>
                        <span className="font-bold text-amber-600">{(config.treasuryWalletShareBps / 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-sm text-gray-700">
                      <strong>How it works:</strong> When NFTs are minted, {(config.lendingWalletShareBps / 100)}% of revenue is automatically converted to stablecoins via Jupiter and sent to the lending pool. The remaining {(config.treasuryWalletShareBps / 100)}% stays as WHISKEY tokens in the treasury.
                    </p>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  ⚠️ Important Notes
                </h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• All interest payments go directly to protocol treasury</li>
                  <li>• Admin can configure all protocol settings</li>
                  <li>• NFTs have dynamic USD values based on collection pricing</li>
                  <li>• Global NFT collateral limit prevents over-leveraging</li>
                  <li>• Revenue split: 80% to lending, 20% to treasury</li>
                  <li>• Fees apply to borrowing, marketplace, and minting</li>
                </ul>
              </div>

              {/* Deployment Information */}
              {deploymentInfo && (
                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    🔗 Deployment Information
                  </h3>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div className="flex justify-between">
                      <span>Network:</span>
                      <span className="font-mono">{deploymentInfo.network}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lending Program ID:</span>
                      <span className="font-mono text-xs">{deploymentInfo.lendingProgramId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Global Market PDA:</span>
                      <span className="font-mono text-xs">{deploymentInfo.globalMarketPda}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
