'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import { Connection, Transaction } from '@solana/web3.js';
import { getCurrentWhiskeyRate } from '../../../lib/coingeckoPricing';
import MediaWithFallback from '../../../components/MediaWithFallback';

interface LoanInfo {
  loanId: string;
  principalAmount: number;
  interestRate: number;
  duration: string;
  startDate: string;
  dueDate: string;
  status: 'active' | 'defaulted' | 'repaid';
  interestPaid: number;
  totalOwed: number;
  daysRemaining: number;
  asset: 'USDC';
}

interface CollateralNft {
  mintAddress: string;
  name: string;
  imageUrl: string;
  collectionName: string;
  value: number;
}

interface UserLendingData {
  totalBorrowingPower: number;
  totalDebt: number;
  availableToBorrow: number;
  depositedNfts: CollateralNft[];
  activeLoans: LoanInfo[];
}

export default function MyLoansPage() {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [lendingData, setLendingData] = useState<UserLendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowDuration, setBorrowDuration] = useState('1'); // months
  const [borrowAsset, setBorrowAsset] = useState<'USDC'>('USDC');
  const [whiskeyPrice, setWhiskeyPrice] = useState<number>(0);
  const [loanPreview, setLoanPreview] = useState<any>(null);

  useEffect(() => {
    if (connected && publicKey) {
      fetchUserLendingData();
      fetchWhiskeyPrice();
    }
  }, [connected, publicKey]);

  const fetchWhiskeyPrice = async () => {
    try {
      const price = await getCurrentWhiskeyRate();
      setWhiskeyPrice(price);
      console.log(`🪙 WHISKEY Price fetched: $${price}`);
    } catch (error) {
      console.error('Error fetching WHISKEY price:', error);
      // Set a fallback price or keep 0 to show loading
    }
  };

  const fetchLoanPreview = async (amount: string, duration: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setLoanPreview(null);
      return;
    }

    try {
      const response = await fetch('/api/lending/loan-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanAmount: parseFloat(amount),
          duration: parseInt(duration)
        })
      });

      if (response.ok) {
        const preview = await response.json();
        setLoanPreview(preview);
        console.log('📊 Loan preview:', preview);
      } else {
        setLoanPreview(null);
      }
    } catch (error) {
      console.error('Error fetching loan preview:', error);
      setLoanPreview(null);
    }
  };

  const fetchUserLendingData = async () => {
    try {
      const response = await fetch(`/api/lending/user-data?walletAddress=${publicKey?.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLendingData(data);
      }
    } catch (error) {
      console.error('Error fetching lending data:', error);
      toast.error('Failed to fetch lending data');
    } finally {
      setLoading(false);
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) {
      toast.error('Please enter a valid borrow amount');
      return;
    }

    const amount = parseFloat(borrowAmount);
    if (lendingData && amount > lendingData.availableToBorrow) {
      toast.error('Amount exceeds available borrowing power');
      return;
    }

    try {
      const response = await fetch('/api/lending/take-loan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey?.toString(),
          loanAmount: amount,
          duration: parseInt(borrowDuration),
          asset: borrowAsset,
        }),
      });

      if (response.ok) {
        toast.success(`Successfully borrowed $${amount} ${borrowAsset}`);
        setShowBorrowModal(false);
        setBorrowAmount('');
        await fetchUserLendingData();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to take loan');
      }
    } catch (error) {
      console.error('Error taking loan:', error);
      toast.error('Failed to take loan');
    }
  };

  const handleWithdrawNft = async (nftMintAddress: string) => {
    if (!connected || !publicKey || !sendTransaction) {
      toast.error('Wallet not connected');
      return;
    }

    let toastId: string | undefined;
    try {
      console.log('🔄 Creating NFT withdrawal transaction...', { nftMintAddress });
      
      const response = await fetch('/api/lending/withdraw-nft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          nftMintAddress
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create withdrawal transaction');
      }

      const data = await response.json();
      console.log('✅ Withdrawal transaction created:', data);

      // Deserialize and send transaction
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
      const transaction = Transaction.from(Buffer.from(data.transaction, 'base64'));
      
      // Simulate transaction first to get better error details
      console.log('🧪 Simulating NFT withdrawal transaction...');
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error('❌ Transaction simulation failed:', simulation.value.err);
          console.error('📋 Simulation logs:', simulation.value.logs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log('✅ Transaction simulation successful');
      } catch (simError) {
        console.error('❌ Simulation error:', simError);
        throw new Error(`Transaction simulation failed: ${simError.message}`);
      }
      
      console.log('🚀 Sending NFT withdrawal transaction...');
      const signature = await sendTransaction(transaction, connection);
      console.log('📡 Transaction sent:', signature);
      
      // Wait for confirmation
      toastId = toast.loading('⏳ Confirming NFT withdrawal...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        toast.dismiss(toastId);
        throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
      }
      
      console.log('✅ Withdrawal transaction confirmed:', signature);
      toast.success(`🎨 NFT withdrawn successfully! Transaction: ${signature.slice(0, 8)}...`, { id: toastId });
      
      // Refresh data
      await fetchUserLendingData();
    } catch (error) {
      console.error('Error withdrawing NFT:', error);
      if (toastId) toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw NFT');
    }
  };

  const handleRepayLoan = async (loanId: string, amount: number) => {
    if (!connected || !publicKey || !sendTransaction) {
      toast.error('Wallet not connected');
      return;
    }

    let toastId: string | undefined;
    try {
      console.log('🔄 Creating repayment transaction...', { loanId, amount });
      
      const response = await fetch('/api/lending/repay-loan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          loanId,
          repaymentAmountUsd: amount, // Amount in USD
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create repayment transaction');
      }

      const data = await response.json();
      console.log('✅ Repayment transaction created:', data);

      // Deserialize and send transaction
      const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com');
      const transaction = Transaction.from(Buffer.from(data.transaction, 'base64'));
      
      // Simulate transaction first to get better error details
      console.log('🧪 Simulating repayment transaction...');
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error('❌ Transaction simulation failed:', simulation.value.err);
          console.error('📋 Simulation logs:', simulation.value.logs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log('✅ Transaction simulation successful');
      } catch (simError) {
        console.error('❌ Simulation error:', simError);
        throw new Error(`Transaction simulation failed: ${simError.message}`);
      }
      
      console.log('🚀 Sending repayment transaction...');
      const signature = await sendTransaction(transaction, connection);
      console.log('📡 Transaction sent:', signature);
      
      // Wait for confirmation
      toastId = toast.loading('⏳ Confirming loan repayment...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        toast.dismiss(toastId);
        throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
      }
      
      console.log('✅ Repayment transaction confirmed:', signature);
      toast.success(`💰 Loan repayment successful! Transaction: ${signature.slice(0, 8)}...`, { id: toastId });
      
      // Refresh data
      await fetchUserLendingData();
    } catch (error) {
      console.error('Error repaying loan:', error);
      if (toastId) toast.dismiss(toastId);
      toast.error(error instanceof Error ? error.message : 'Failed to repay loan');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400';
      case 'defaulted': return 'text-red-400';
      case 'repaid': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };


  const getLoanUrgencyStatus = (daysRemaining: number) => {
    if (daysRemaining <= 0) {
      return {
        status: 'EXPIRED',
        color: 'text-red-500',
        bgColor: 'bg-red-900/30 border-red-500',
        message: '🚨 LOAN EXPIRED - NFT will be burned soon!',
        urgency: 'critical'
      };
    } else if (daysRemaining === 1) {
      return {
        status: 'CRITICAL',
        color: 'text-red-400',
        bgColor: 'bg-red-900/20 border-red-400',
        message: '⚠️ FINAL DAY - Repay immediately to save your NFT!',
        urgency: 'critical'
      };
    } else if (daysRemaining <= 3) {
      return {
        status: 'URGENT',
        color: 'text-orange-400',
        bgColor: 'bg-orange-900/20 border-orange-400',
        message: '⏰ Only ' + daysRemaining + ' days left - NFT at risk!',
        urgency: 'high'
      };
    } else if (daysRemaining <= 7) {
      return {
        status: 'WARNING',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-900/20 border-yellow-400',
        message: '📅 ' + daysRemaining + ' days remaining - Consider repaying soon',
        urgency: 'medium'
      };
    } else {
      return {
        status: 'SAFE',
        color: 'text-green-400',
        bgColor: 'bg-slate-800 border-slate-700',
        message: daysRemaining + ' days remaining',
        urgency: 'low'
      };
    }
  };


  const calculateWhiskeyAmount = (usdAmount: number): number => {
    if (whiskeyPrice === 0) return 0;
    return usdAmount / whiskeyPrice;
  };

  const calculateDualPaymentBreakdown = (loan: LoanInfo) => {
    const principal = loan.principalAmount;
    const totalInterest = loan.totalOwed - loan.principalAmount;
    const interestInWhiskey = calculateWhiskeyAmount(totalInterest);
    
    return {
      principalUSDC: principal,
      interestUSD: totalInterest,
      interestWhiskey: interestInWhiskey
    };
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300 mb-8">You need to connect your wallet to view your loans</p>
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
              My Loans
            </span>
            <br />
            & Collateral
          </h1>
          <p className="text-xl text-gray-300">
            Manage your borrowing position and collateral
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-gray-300">Loading your lending data...</p>
          </div>
        ) : !lendingData ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-300 mb-4">No lending data found</p>
            <p className="text-gray-400 mb-8">
              Start by depositing NFTs as collateral to unlock borrowing power
            </p>
            <Link
              href="/lending/borrow"
              className="inline-flex items-center justify-center px-6 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-all duration-300"
            >
              Deposit NFTs
            </Link>
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Total Debt</h3>
                <p className="text-3xl font-bold text-red-400">${lendingData.totalDebt}</p>
              </div>
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Available to Borrow</h3>
                <p className="text-3xl font-bold text-purple-400">${lendingData.availableToBorrow}</p>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 mb-8"
            >
              <button
                onClick={() => setShowBorrowModal(true)}
                disabled={lendingData.availableToBorrow <= 0}
                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                💰 Borrow Funds
              </button>
              <Link
                href="/lending/borrow"
                className="flex-1 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all duration-300 text-center"
              >
                🖼️ Deposit More NFTs
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Active Loans */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold text-white mb-6">Active Loans</h2>
                
                {lendingData.activeLoans.length === 0 ? (
                  <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
                    <p className="text-gray-300 mb-4">No active loans</p>
                    <p className="text-gray-400 text-sm">
                      Use your collateral to borrow stablecoins
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lendingData.activeLoans.map((loan) => {
                      const urgencyStatus = getLoanUrgencyStatus(loan.daysRemaining);
                      return (
                        <div key={loan.loanId} className={`p-6 rounded-xl border-2 ${urgencyStatus.bgColor}`}>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">
                              ${loan.principalAmount} {loan.asset}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${urgencyStatus.color} bg-black/20`}>
                                {urgencyStatus.status}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(loan.status)}`}>
                                {loan.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Urgency Warning Message */}
                          <div className={`mb-4 p-2 rounded-lg border ${urgencyStatus.bgColor}`}>
                            <p className={`text-sm font-bold ${urgencyStatus.color} text-center`}>
                              {urgencyStatus.message}
                            </p>
                          </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400">Interest Rate</p>
                            <p className="text-white font-bold">{loan.interestRate}% APY</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Duration</p>
                            <p className="text-white font-bold">{loan.duration}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Days Remaining</p>
                            <p className="text-white font-bold">{loan.daysRemaining}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total Owed</p>
                            <p className="text-white font-bold">${loan.totalOwed}</p>
                          </div>
                        </div>

                        {loan.status === 'active' && (() => {
                          const breakdown = calculateDualPaymentBreakdown(loan);
                          return (
                            <div className="mt-4 space-y-3">
                              <div className="bg-slate-700 p-3 rounded-lg">
                                <div className="text-xs font-bold text-amber-400 mb-2 text-center">
                                  💰 Dual Payment Required
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div className="text-center">
                                    <p className="text-gray-400">Principal (USDC)</p>
                                    <p className="text-blue-400 font-bold">${breakdown.principalUSDC.toFixed(2)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-gray-400">Interest (WHISKEY)</p>
                                    <p className="text-amber-400 font-bold">
                                      {breakdown.interestWhiskey.toFixed(4)} WHISKEY
                                    </p>
                                    <p className="text-gray-500 text-xs">≈${breakdown.interestUSD.toFixed(2)}</p>
                                  </div>
                                </div>
                                {whiskeyPrice > 0 && (
                                  <div className="text-gray-400 text-xs text-center mt-2">
                                    WHISKEY Price: ${whiskeyPrice.toFixed(4)}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleRepayLoan(loan.loanId, loan.totalOwed)}
                                className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-all duration-300"
                                disabled={whiskeyPrice === 0}
                              >
                                {whiskeyPrice === 0 ? 'Loading WHISKEY Price...' : 
                                  `Repay Loan (${breakdown.principalUSDC.toFixed(0)} USDC + ${breakdown.interestWhiskey.toFixed(2)} WHISKEY)`
                                }
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {/* Collateral NFTs */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-2xl font-bold text-white mb-6">Collateral NFTs</h2>
                
                {lendingData.depositedNfts.length === 0 ? (
                  <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 text-center">
                    <p className="text-gray-300 mb-4">No collateral deposited</p>
                    <p className="text-gray-400 text-sm mb-4">
                      Deposit NFTs to unlock borrowing power
                    </p>
                    <Link
                      href="/lending/borrow"
                      className="inline-flex items-center justify-center px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-all duration-300"
                    >
                      Deposit NFTs
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {lendingData.depositedNfts.map((nft) => {
                      console.log(`🔥 [my-loans-page] Rendering NFT: ${nft.name}, imageUrl: "${nft.imageUrl}"`);
                      return (
                      <div key={nft.mintAddress} className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <div className="aspect-square rounded-lg overflow-hidden mb-3">
                          <MediaWithFallback
                            src={nft.imageUrl}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">{nft.name}</h3>
                        <p className="text-sm text-gray-400 mb-2">{nft.collectionName}</p>
                        <p className="text-sm text-green-400 font-bold mb-3">${nft.value.toFixed(2)} value</p>
                        
                        {lendingData.totalDebt === 0 ? (
                          <button
                            onClick={() => handleWithdrawNft(nft.mintAddress)}
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-all duration-300 text-sm"
                          >
                            Withdraw NFT
                          </button>
                        ) : (
                          <p className="text-xs text-amber-400 text-center">
                            Repay all loans to withdraw
                          </p>
                        )}
                      </div>
                    )})}
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}

        {/* Borrow Modal */}
        {showBorrowModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 rounded-xl p-6 w-full max-w-md"
            >
              <h3 className="text-xl font-bold text-white mb-4">Borrow Funds</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={borrowAmount}
                    onChange={(e) => {
                      setBorrowAmount(e.target.value);
                      fetchLoanPreview(e.target.value, borrowDuration);
                    }}
                    max={lendingData?.availableToBorrow || 0}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    placeholder="Enter amount to borrow"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Available: ${lendingData?.availableToBorrow || 0}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration
                  </label>
                  <select
                    value={borrowDuration}
                    onChange={(e) => {
                      setBorrowDuration(e.target.value);
                      fetchLoanPreview(borrowAmount, e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="1">1 Month</option>
                    <option value="2">2 Months</option>
                    <option value="3">3 Months</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Asset
                  </label>
                  <select
                    value={borrowAsset}
                    onChange={(e) => setBorrowAsset(e.target.value as 'USDC')}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="USDC">USDC</option>
                  </select>
                </div>

                {/* Loan Preview */}
                {loanPreview && (
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-600">
                    <h4 className="text-lg font-bold text-white mb-3">📊 Loan Preview</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400">Loan Amount</p>
                        <p className="text-white font-bold">${loanPreview.loanAmount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Duration</p>
                        <p className="text-white font-bold">{loanPreview.duration} months ({loanPreview.durationInDays} days)</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Interest Rate (APR)</p>
                        <p className="text-amber-400 font-bold">{loanPreview.interestRate.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Interest Amount</p>
                        <p className="text-red-400 font-bold">${loanPreview.interestAmount.toFixed(2)}</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-600">
                        <p className="text-gray-400">Total Repayment</p>
                        <p className="text-green-400 font-bold text-lg">${loanPreview.totalRepayment.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-amber-900/20 rounded border-l-4 border-amber-500">
                      <p className="text-amber-400 text-xs">
                        💡 This is simple interest calculated at loan origination. 
                        You'll pay exactly ${loanPreview.totalRepayment.toFixed(2)} regardless of when you repay within the {loanPreview.duration}-month term.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowBorrowModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBorrow}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all duration-300"
                >
                  Borrow
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-12 flex justify-center space-x-4">
          <Link
            href="/lending"
            className="px-6 py-3 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all duration-300"
          >
            ← Back to Lending
          </Link>
        </div>
      </div>
    </div>
  );
}
