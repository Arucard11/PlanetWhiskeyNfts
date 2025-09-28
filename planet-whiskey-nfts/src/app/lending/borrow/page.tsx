'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { Transaction, Connection } from '@solana/web3.js';
import MediaWithFallback from '../../../components/MediaWithFallback';

interface UserNft {
  mintAddress: string;
  name: string;
  imageUrl: string;
  collectionName: string;
  collectionMintAddress: string;
  isEligible: boolean; // Whether this NFT is from an approved collection
}

interface BorrowingStats {
  perNftValue: number; // Average value for display
  ltvRatio: number; // 80% = 8000 bps
  maxNftsPerUser: number;
  currentBorrowingPower: number;
  currentDebt: number;
  availableToBorrow: number;
  depositedNfts: number;
  collectionValues: { [collectionMint: string]: number }; // Individual collection values
  transactionFeeBps: number; // Transaction fee in basis points (e.g., 200 = 2%)
}

export default function BorrowPage() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [userNfts, setUserNfts] = useState<UserNft[]>([]);
  const [borrowingStats, setBorrowingStats] = useState<BorrowingStats | null>(null);
  const [selectedNfts, setSelectedNfts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const [loanAmount, setLoanAmount] = useState<string>('');
  const [loanDuration, setLoanDuration] = useState<number>(1);

  const fetchUserNfts = useCallback(async (walletAddress: string) => {
    console.log('🔍 Fetching user NFTs...');
    try {
      const response = await fetch(`/api/my-nfts?walletAddress=${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ User NFTs fetched:', data);
        
        const nfts = data.ownedCollectionNfts?.map((nft: any) => {
          console.log(`🔍 [borrow-page] Processing NFT: ${nft.name}`);
          console.log(`🔍 [borrow-page] NFT data:`, {
            address: nft.address,
            name: nft.name,
            uri: nft.uri,
            hasJson: !!nft.json,
            jsonImage: nft.json?.image,
            collectionName: nft.collectionName,
            collectionMintAddress: nft.collectionMintAddress
          });
          
          const imageUrl = nft.json?.image || '/placeholder-image.svg';
          console.log(`🔍 [borrow-page] Final imageUrl for ${nft.name}: "${imageUrl}"`);
          
          return {
            mintAddress: nft.address,
            name: nft.name,
            imageUrl: imageUrl,
            collectionName: nft.collectionName,
            collectionMintAddress: nft.collectionMintAddress,
            isEligible: true // Will be updated after checking collection approval
          };
        }) || [];
        
        // Check collection approval status for all unique collections
        if (nfts.length > 0) {
          const uniqueCollections = [...new Set(nfts.map(nft => nft.collectionMintAddress))];
          console.log('🔍 Checking approval status for collections:', uniqueCollections);
          
          try {
            const approvalResponse = await fetch('/api/lending/check-collection-approval', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                collectionMintAddresses: uniqueCollections
              }),
            });
            
            if (approvalResponse.ok) {
              const approvalData = await approvalResponse.json();
              console.log('✅ Collection approval status:', approvalData.results);
              
              // Create a map of collection approval status
              const approvalMap = new Map();
              approvalData.results.forEach((result: any) => {
                approvalMap.set(result.collectionMint, result.isApproved);
              });
              
              // Update NFT eligibility based on collection approval
              const eligibleNfts = nfts.map(nft => ({
                ...nft,
                isEligible: approvalMap.get(nft.collectionMintAddress) || false
              }));
              
              console.log('✅ NFTs with eligibility status:', eligibleNfts);
              setUserNfts(eligibleNfts);
            } else {
              console.log('⚠️ Failed to check collection approval, marking all as ineligible');
              const ineligibleNfts = nfts.map(nft => ({ ...nft, isEligible: false }));
              setUserNfts(ineligibleNfts);
            }
          } catch (approvalError) {
            console.error('❌ Error checking collection approval:', approvalError);
            // Mark all as ineligible if we can't check approval
            const ineligibleNfts = nfts.map(nft => ({ ...nft, isEligible: false }));
            setUserNfts(ineligibleNfts);
          }
        } else {
          setUserNfts([]);
        }
      } else {
        // If the request fails, clear the NFTs
        setUserNfts([]);
        toast.error('Could not load your NFTs.');
      }
    } catch (error) {
      console.error('❌ Error fetching user NFTs:', error);
      toast.error('Could not load your NFTs.');
      setUserNfts([]);
    }
  }, []);

  const fetchBorrowingStats = useCallback(async (walletAddress: string) => {
    console.log('🔍 Fetching borrowing stats...');
    try {
      const response = await fetch(`/api/lending/user-stats?walletAddress=${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Borrowing stats fetched:', data);
        setBorrowingStats(data);
      } else {
        setBorrowingStats(null);
      }
    } catch (error) {
      console.error('❌ Error fetching borrowing stats:', error);
      setBorrowingStats(null);
    }
  }, []);

  useEffect(() => {
    const fetchPageData = async () => {
      if (connected && publicKey) {
        setLoading(true);
        // Reset state for new wallet connection
        setUserNfts([]);
        setBorrowingStats(null);
        setSelectedNfts(new Set());
        
        await Promise.all([
          fetchUserNfts(publicKey.toString()),
          fetchBorrowingStats(publicKey.toString())
        ]);
        
        setLoading(false);
      } else {
        // Clear data and stop loading if wallet is disconnected
        setLoading(false);
        setUserNfts([]);
        setBorrowingStats(null);
      }
    };

    fetchPageData();
  }, [connected, publicKey, fetchUserNfts, fetchBorrowingStats]);
  
  const handleNftSelection = (mintAddress: string) => {
    const nft = userNfts.find(n => n.mintAddress === mintAddress);
    
    // Check if NFT is eligible for lending
    if (!nft?.isEligible) {
      toast.error('This NFT cannot be used as collateral.', {
        duration: 5000,
        style: {
          background: '#dc2626',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500',
        }
      });
      return;
    }
    
    const newSelected = new Set(selectedNfts);
    if (newSelected.has(mintAddress)) {
      newSelected.delete(mintAddress);
    } else {
      if (newSelected.size < 5) { // Max 5 NFTs per user
        newSelected.add(mintAddress);
      } else {
        toast.error('You can only use 5 NFTs max.');
      }
    }
    setSelectedNfts(newSelected);
  };

  const handleTakeLoan = async () => {
    if (!connected || !publicKey || !loanAmount || parseFloat(loanAmount) <= 0) {
      toast.error('Enter a loan amount.');
      return;
    }

    if (!borrowingStats || borrowingStats.availableToBorrow < parseFloat(loanAmount)) {
      toast.error('Amount too high. Lower the loan amount.');
      return;
    }

    setBorrowing(true);
    try {
      console.log('🏦 Taking loan...', {
        amount: loanAmount,
        duration: loanDuration,
        wallet: publicKey.toString()
      });

      const response = await fetch('/api/lending/take-loan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          loanAmount: parseFloat(loanAmount),
          duration: loanDuration,
          asset: 'USDC'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create loan');
      }

      const data = await response.json();
      console.log('✅ Loan transaction created:', data);

      // Deserialize and send transaction
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      const transaction = Transaction.from(Buffer.from(data.transaction, 'base64'));
      
      console.log('🔍 Transaction details:', {
        instructions: transaction.instructions.length,
        feePayer: transaction.feePayer?.toString(),
        recentBlockhash: transaction.recentBlockhash
      });

      // Simulate transaction first to check for errors
      try {
        console.log('🧪 Simulating transaction first...');
        const simulationResult = await connection.simulateTransaction(transaction);
        console.log('📊 Simulation result:', simulationResult);
        
        if (simulationResult.value.err) {
          console.error('❌ Transaction simulation failed:', simulationResult.value.err);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
        }
        
        console.log('✅ Transaction simulation successful');
      } catch (simError) {
        console.error('❌ Simulation error:', simError);
        throw new Error(`Simulation failed: ${simError instanceof Error ? simError.message : 'Unknown simulation error'}`);
      }

      const signature = await sendTransaction(transaction, connection);
      console.log('🚀 Loan transaction sent:', signature);
      toast.success(`Loan taken successfully! Transaction: ${signature.slice(0, 8)}...`);

      // Reset form and refresh data
      setLoanAmount('');
      await fetchBorrowingStats(publicKey.toString());

    } catch (error) {
      console.error('Error taking loan:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // Check for specific wallet errors
      if (error?.toString().includes('WalletSendTransactionError')) {
        console.error('❌ Wallet transaction error detected');
        toast.error('Wallet problem. Check connection and try again.');
      } else if (error?.toString().includes('simulation failed')) {
        console.error('❌ Transaction simulation failed');
        toast.error('Not enough funds or permissions.');
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to take loan');
      }
    } finally {
      setBorrowing(false);
    }
  };

  const handleDepositNfts = async () => {
    if (selectedNfts.size === 0) {
      toast.error('Select at least 1 NFT.');
      return;
    }

    if (!sendTransaction) {
      toast.error('Wallet not connected.');
      return;
    }

    setDepositing(true);
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
    
    try {
      let successCount = 0;
      
      for (const mintAddress of selectedNfts) {
        try {
          // Find the NFT data to get the collection mint address
          const nftData = userNfts.find(nft => nft.mintAddress === mintAddress);
          if (!nftData) {
            throw new Error('NFT data not found');
          }

          // Get transaction from API
          const response = await fetch('/api/lending/deposit-nft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              nftMintAddress: mintAddress,
              walletAddress: publicKey?.toString(),
              collectionMintAddress: nftData.collectionMintAddress,
            }),
          });

          if (!response.ok) {
            const error = await response.json();
            
            // Handle specific error codes from API
            if (error.errorCode === 'INVALID_NFT_COLLECTION') {
              throw new Error(`❌ ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'This NFT'} is not from an approved collection. Only NFTs from approved collections can be used as collateral.`);
            }
            
            throw new Error(error.message || 'Failed to create deposit transaction');
          }

          const { transaction: serializedTransaction, lastValidBlockHeight } = await response.json();
          
          // Deserialize and send transaction
          const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));
          
          const signature = await sendTransaction(transaction, connection);
          console.log(`✅ NFT ${mintAddress} deposited, signature:`, signature);
          
          // Use a more robust confirmation strategy with shorter timeout
          try {
            await connection.confirmTransaction({
              signature,
              lastValidBlockHeight,
              blockhash: transaction.recentBlockhash!
            }, 'confirmed');
          } catch (confirmError) {
            // If confirmation times out, check if transaction actually succeeded
            console.log('⏰ Confirmation timeout, checking transaction status...');
            const status = await connection.getSignatureStatus(signature);
            if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
              console.log('✅ Transaction confirmed despite timeout');
            } else if (status.value?.err) {
              throw new Error(`Transaction failed: ${status.value.err}`);
            } else {
              console.log('⚠️ Transaction status unclear, but proceeding...');
            }
          }
          
          successCount++;
          toast.success(`Successfully deposited ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'NFT'}`);

        } catch (innerError) {
          console.error(`Failed to deposit NFT ${mintAddress}:`, innerError);
          
          // Check for specific error types
          let errorMessage = `Failed to deposit ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'NFT'}. Please try again.`;
          
          if (innerError instanceof Error) {
            const errorString = innerError.message.toLowerCase();
            
            // Check for collection approval error
            if (errorString.includes('invalidnftcollection') || 
                errorString.includes('not from an approved collection') ||
                errorString.includes('custom program error: 0x1786')) {
              errorMessage = `❌ ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'This NFT'} is not from an approved collection. Only NFTs from approved collections can be used as collateral.`;
            }
            // Check for other specific errors
            else if (errorString.includes('insufficient')) {
              errorMessage = `❌ Insufficient balance for ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'NFT'}. Please check your wallet.`;
            }
            else if (errorString.includes('unauthorized')) {
              errorMessage = `❌ Unauthorized access for ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'NFT'}. Please check your permissions.`;
            }
            else if (errorString.includes('simulation failed')) {
              errorMessage = `❌ Transaction would fail for ${userNfts.find(n => n.mintAddress === mintAddress)?.name || 'NFT'}. This NFT may not be eligible for lending.`;
            }
          }
          
          toast.error(errorMessage, {
            duration: 6000, // Show for 6 seconds
            style: {
              background: '#dc2626',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
            }
          });
          // Stop on first failure
          break;
        }
      }
      
      if (successCount > 0) {
        console.log('Refreshing data after deposit...');
        await Promise.all([
            fetchUserNfts(publicKey!.toString()),
            fetchBorrowingStats(publicKey!.toString())
        ]);
        setSelectedNfts(new Set());
      }

    } catch (error) {
      console.error('Error in deposit process:', error);
      toast.error('Something went wrong. Try again.');
    } finally {
      setDepositing(false);
    }
  };
  
  const calculateGrossBorrowingPower = () => {
    if (!borrowingStats) return 0;
    const ltv = borrowingStats.ltvRatio / 10000;
    
    // Calculate gross borrowing power based on individual NFT collection values (before fees)
    let totalValue = 0;
    selectedNfts.forEach(nftMintAddress => {
      const nft = userNfts.find(n => n.mintAddress === nftMintAddress);
      if (nft && borrowingStats.collectionValues[nft.collectionMintAddress]) {
        totalValue += borrowingStats.collectionValues[nft.collectionMintAddress];
      } else {
        // Fallback to average value if collection value not found
        totalValue += borrowingStats.perNftValue;
      }
    });
    
    return totalValue * ltv;
  };

  const calculateBorrowingPower = () => {
    if (!borrowingStats) return 0;
    const transactionFee = borrowingStats.transactionFeeBps / 10000; // Convert from basis points to decimal
    
    const grossBorrowingPower = calculateGrossBorrowingPower();
    // Subtract transaction fee from the borrowable amount
    const netBorrowingPower = grossBorrowingPower * (1 - transactionFee);
    
    return netBorrowingPower;
  };

  const calculateTotalValue = () => {
    if (!borrowingStats) return 0;
    
    // Calculate total value based on individual NFT collection values
    let totalValue = 0;
    selectedNfts.forEach(nftMintAddress => {
      const nft = userNfts.find(n => n.mintAddress === nftMintAddress);
      if (nft && borrowingStats.collectionValues[nft.collectionMintAddress]) {
        totalValue += borrowingStats.collectionValues[nft.collectionMintAddress];
      } else {
        // Fallback to average value if collection value not found
        totalValue += borrowingStats.perNftValue;
      }
    });
    
    return totalValue;
  };

  const getNftValue = (nft: UserNft) => {
    if (!borrowingStats) return 0;
    
    // Get individual collection value or fallback to average
    return borrowingStats.collectionValues[nft.collectionMintAddress] || borrowingStats.perNftValue;
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300 mb-8">You need to connect your wallet to access lending features</p>
          <Link
            href="/lending"
            className="inline-flex items-center justify-center px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all duration-300"
          >
            ← Back to Lending
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              Deposit NFTs
            </span>
            <br />
            as Collateral
          </h1>
          <p className="text-xl text-gray-300">
            Use your Planet Whiskey NFTs to unlock borrowing power
          </p>
        </motion.div>

        {/* Borrowing Stats */}
        {borrowingStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">LTV Ratio</h3>
              <p className="text-3xl font-bold text-blue-400">{borrowingStats.ltvRatio / 100}%</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Available to Borrow</h3>
              <div className="text-right">
                <p className="text-lg font-medium text-gray-400">
                  Gross: ${borrowingStats.availableToBorrow.toFixed(2)}
                </p>
                <p className="text-3xl font-bold text-purple-400">
                  ${(() => {
                    const transactionFee = borrowingStats.transactionFeeBps / 10000;
                    const netAvailable = borrowingStats.availableToBorrow * (1 - transactionFee);
                    return Math.max(0, netAvailable).toFixed(2);
                  })()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  (after {(borrowingStats.transactionFeeBps / 100).toFixed(1)}% fee)
                </p>
              </div>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Deposited NFTs</h3>
              <p className="text-3xl font-bold text-amber-400">{borrowingStats.depositedNfts}/5</p>
            </div>
          </motion.div>
        )}

        {/* Selection Summary */}
        {selectedNfts.size > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 rounded-xl p-6 mb-8"
          >
            <h3 className="text-xl font-bold text-white mb-4">Selection Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-300">Selected NFTs</p>
                <p className="text-2xl font-bold text-amber-400">{selectedNfts.size}</p>
              </div>
              <div>
                <p className="text-gray-300">Total Value</p>
                <p className="text-2xl font-bold text-green-400">
                  ${borrowingStats ? calculateTotalValue().toFixed(2) : 0}
                </p>
              </div>
              <div>
                <p className="text-gray-300">Borrowing Power</p>
                <div className="text-right">
                  <p className="text-sm text-gray-400">
                    Gross: ${calculateGrossBorrowingPower().toFixed(2)}
                  </p>
                  <p className="text-2xl font-bold text-purple-400">
                    ${calculateBorrowingPower()}
                  </p>
                  <p className="text-xs text-gray-500">
                    (after {(borrowingStats.transactionFeeBps / 100).toFixed(1)}% fee)
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleDepositNfts}
              disabled={depositing}
              className="w-full mt-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {depositing ? 'Depositing NFTs...' : `Deposit ${selectedNfts.size} NFT(s) as Collateral`}
            </button>
          </motion.div>
        )}

        {/* NFT Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6">Your Eligible NFTs</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4"></div>
              <p className="text-xl text-gray-300 mb-2">Loading your NFTs...</p>
              <p className="text-gray-400">Please wait while we fetch your eligible NFTs</p>
            </div>
          ) : userNfts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-gray-300 mb-4">No eligible NFTs found</p>
              <p className="text-gray-400 mb-8">
                You need Planet Whiskey NFTs to use as collateral
              </p>
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all duration-300"
              >
                Browse Marketplace
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {userNfts.map((nft) => (
                <motion.div
                  key={nft.mintAddress}
                  whileHover={{ scale: nft.isEligible ? 1.05 : 1.02 }}
                  className={`bg-slate-800 rounded-xl p-4 border-2 transition-all duration-300 ${
                    !nft.isEligible
                      ? 'border-red-500/50 bg-red-500/5 cursor-not-allowed opacity-60'
                      : selectedNfts.has(nft.mintAddress)
                      ? 'border-amber-500 bg-amber-500/10 cursor-pointer'
                      : 'border-slate-700 hover:border-slate-600 cursor-pointer'
                  }`}
                  onClick={() => nft.isEligible && handleNftSelection(nft.mintAddress)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden mb-4">
                    <MediaWithFallback
                      src={nft.imageUrl}
                      alt={nft.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{nft.name}</h3>
                  <p className="text-sm text-gray-400 mb-2">{nft.collectionName}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-400">
                      ${getNftValue(nft).toFixed(2)} value
                    </span>
                    {selectedNfts.has(nft.mintAddress) && (
                      <span className="text-amber-400">✓ Selected</span>
                    )}
                  </div>
                  
                  {/* Eligibility Status */}
                  <div className="mt-2 flex items-center justify-between">
                    {nft.isEligible ? (
                      <span className="text-xs text-green-400 flex items-center">
                        ✓ Approved for lending
                      </span>
                    ) : (
                      <span className="text-xs text-red-400 flex items-center">
                        ❌ Not approved for lending
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Borrowing Section */}
        {borrowingStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`bg-slate-800 rounded-2xl p-8 border border-slate-700 mt-8 ${
              borrowingStats.availableToBorrow <= 0 ? 'opacity-60' : ''
            }`}
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
                Take a Loan
              </span>
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Loan Form */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Loan Amount (USDC)
                  </label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="Enter amount"
                    max={borrowingStats.availableToBorrow}
                    min="1"
                    step="0.01"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 force-white-text"
                  />
                  <div className="text-sm text-gray-400 mt-2">
                    <p>Gross available: ${borrowingStats.availableToBorrow.toFixed(2)}</p>
                    <p className="font-bold text-green-400">
                      Net available: ${(() => {
                        const transactionFee = borrowingStats.transactionFeeBps / 10000;
                        const netAvailable = borrowingStats.availableToBorrow * (1 - transactionFee);
                        return Math.max(0, netAvailable).toFixed(2);
                      })()} (after {(borrowingStats.transactionFeeBps / 100).toFixed(1)}% fee)
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Loan Duration
                  </label>
                  <select
                    value={loanDuration}
                    onChange={(e) => setLoanDuration(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value={1}>1 Month</option>
                    <option value={2}>2 Months</option>
                    <option value={3}>3 Months</option>
                  </select>
                </div>

                {borrowingStats.availableToBorrow <= 0 && (
                  <div className="mb-4 p-4 bg-amber-900/50 border border-amber-700 rounded-xl">
                    <p className="text-amber-300 text-sm">
                      💡 <strong>Deposit NFT collateral first</strong> to unlock borrowing functionality. 
                      Use the "Deposit NFT" section above to get started.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleTakeLoan}
                  disabled={borrowing || !loanAmount || parseFloat(loanAmount) <= 0 || borrowingStats.availableToBorrow <= 0}
                  className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300"
                >
                  {borrowing ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Taking Loan...
                    </div>
                  ) : (
                    'Take Loan'
                  )}
                </button>
              </div>

              {/* Loan Info */}
              <div className="bg-slate-900 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Loan Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      {selectedNfts.size > 0 ? 'Selected NFTs Power:' : 'Current Borrowing Power:'}
                    </span>
                    <div className="text-right">
                      <span className="text-white font-medium">
                        ${selectedNfts.size > 0 
                          ? calculateGrossBorrowingPower().toFixed(2) 
                          : borrowingStats.currentBorrowingPower.toFixed(2)
                        }
                      </span>
                      <div className="text-xs text-gray-500">
                        (before fees)
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Debt:</span>
                    <span className="text-white font-medium">${borrowingStats.currentDebt.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      {selectedNfts.size > 0 ? 'Available from Selection:' : 'Available to Borrow:'}
                    </span>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        Gross: ${selectedNfts.size > 0 
                          ? calculateGrossBorrowingPower().toFixed(2)
                          : borrowingStats.availableToBorrow.toFixed(2)
                        }
                      </div>
                      <span className="text-green-400 font-medium">
                        ${selectedNfts.size > 0 
                          ? calculateBorrowingPower().toFixed(2)
                          : (() => {
                              // Calculate available amount after fees from current borrowing stats
                              const transactionFee = borrowingStats.transactionFeeBps / 10000;
                              const netAvailable = borrowingStats.availableToBorrow * (1 - transactionFee);
                              return Math.max(0, netAvailable).toFixed(2);
                            })()
                        }
                      </span>
                      <div className="text-xs text-gray-500">
                        (after {(borrowingStats.transactionFeeBps / 100).toFixed(1)}% fee)
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Deposited NFTs:</span>
                    <span className="text-white font-medium">{borrowingStats.depositedNfts}</span>
                  </div>
                  {loanAmount && parseFloat(loanAmount) > 0 && (
                    <div className="pt-3 border-t border-slate-700">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Requested Amount:</span>
                        <span className="text-amber-400 font-medium">${parseFloat(loanAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-amber-400 font-medium">{loanDuration} month{loanDuration > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex justify-center space-x-4">
          <Link
            href="/lending"
            className="px-6 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all duration-300"
          >
            ← Back to Lending
          </Link>
          <Link
            href="/lending/my-loans"
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all duration-300"
          >
            View My Loans →
          </Link>
        </div>
      </div>
    </div>
  );
}
