'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'react-hot-toast';

interface LendingStats {
  totalLoansActive: number;
  totalDebtOutstanding: string;
  totalCollateralValue: string;
  averageNftValue: string;
  currentUtilizationRate: number;
  availableLiquidity: string;
}

export default function LendingPage() {
  const { connected } = useWallet();
  const [stats, setStats] = useState<LendingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLendingStats();
  }, []);

  const fetchLendingStats = async () => {
    try {
      const response = await fetch('/api/admin/lending/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching lending stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      title: "NFT Collateral",
      description: "Use your Planet Whiskey NFTs as collateral to unlock liquidity",
      icon: "🖼️",
      color: "from-blue-500 to-blue-600"
    },
    {
      title: "Fixed NFT Values",
      description: "Each NFT has a fixed USD value set by the protocol",
      icon: "💰",
      color: "from-green-500 to-green-600"
    },
    {
      title: "Flexible Terms",
      description: "Choose from 1, 3, or 6-month loan durations",
      icon: "📅",
      color: "from-purple-500 to-purple-600"
    },
    {
      title: "Dynamic Rates",
      description: "Interest rates adjust based on protocol utilization",
      icon: "📈",
      color: "from-amber-500 to-amber-600"
    }
  ];

  const steps = [
    {
      step: "1",
      title: "Connect Wallet",
      description: "Connect your Solana wallet containing Planet Whiskey NFTs"
    },
    {
      step: "2", 
      title: "Deposit NFTs",
      description: "Stake up to 5 NFTs as collateral (each user limit)"
    },
    {
      step: "3",
      title: "Borrow Funds",
      description: "Borrow up to 80% of your NFT value in USDC"
    },
    {
      step: "4",
      title: "Repay & Withdraw",
      description: "Repay your loan to unlock and withdraw your NFTs"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-amber-600/10" />
        <div className="container mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
                NFT Lending
              </span>
              <br />
              Protocol
            </h1>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Unlock the value of your Planet Whiskey NFTs with our decentralized lending protocol. 
              Borrow stablecoins using your NFTs as collateral.
            </p>
            
            {connected ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/lending/borrow"
                  className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  🖼️ Deposit NFTs & Borrow
                </Link>
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md mx-auto">
                <p className="text-gray-300 mb-4">Connect your wallet to access lending features</p>
                <div className="text-amber-400 text-sm">
                  Use the wallet button in the top navigation
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Stats Section */}
      {stats && (
        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Active Loans</h3>
              <p className="text-3xl font-bold text-blue-400">{stats.totalLoansActive}</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Total Borrowed</h3>
              <p className="text-3xl font-bold text-red-400">${stats.totalDebtOutstanding}</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Collateral Value</h3>
              <p className="text-3xl font-bold text-green-400">${stats.totalCollateralValue}</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Available Liquidity</h3>
              <p className="text-3xl font-bold text-purple-400">${stats.availableLiquidity}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-4">Why Choose Our Lending Protocol?</h2>
          <p className="text-xl text-gray-300">Built specifically for Planet Whiskey NFT holders</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 + index * 0.1 }}
              className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-amber-500/50 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center text-2xl mb-4`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-300">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-xl text-gray-300">Simple steps to unlock your NFT value</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 + index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center text-2xl font-bold text-white mb-4 mx-auto">
                {step.step}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
              <p className="text-gray-300">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 rounded-2xl p-8 text-center border border-amber-500/20"
        >
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Connect your wallet and start borrowing against your NFTs today
          </p>
          
          {connected ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/lending/borrow"
                className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                🏦 Start Borrowing Now
              </Link>
              <Link
                href="/lending/my-loans"
                className="inline-flex items-center justify-center px-8 py-4 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all duration-300 border border-slate-600"
              >
                📋 View My Loans
              </Link>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-md mx-auto">
              <p className="text-gray-300 mb-4">Connect your wallet to get started</p>
              <div className="text-amber-400 text-sm">
                Click the wallet button in the navigation above
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
