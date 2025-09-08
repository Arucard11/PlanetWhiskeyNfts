"use client";

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Wallet, TrendingUp, RefreshCw, DollarSign, Send } from 'lucide-react';
import { useRealTimeWhiskeyPrice, formatWhiskeyTokens, formatUsdAmount, getPriceChangeColor, formatPercentageChange } from '@/lib/coingeckoPricing';

const WHISKEY_TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_TOKEN_MINT || "Hjy8sNxUneizfMaWKXmdaTrKxw8C6AchBNHu2jfXFkfu");
const TREASURY_WALLET = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET || "4fSp8ipFWs5NffyMX2SP6F3zGrUjT7vfwxcfrNdVafSR");
const LENDING_POOL_WALLET = new PublicKey(process.env.NEXT_PUBLIC_LENDING_POOL_WHISKEY_VAULT || "7YnB5mZMzX6Ft9jtXBxYXrZ6fCnASxkz7cNSMEGCuq4G"); // 80% of mint revenue goes here as WHISKEY (then swapped to USDC)

export default function AdminPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  
  const [treasurySolBalance, setTreasurySolBalance] = useState<number | null>(null);
  const [treasuryWhiskeyBalance, setTreasuryWhiskeyBalance] = useState<number | null>(null);
  const [lendingPoolSolBalance, setLendingPoolSolBalance] = useState<number | null>(null);
  const [treasuryValueUsd, setTreasuryValueUsd] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Real-time WHISKEY price hook
  const { priceData: whiskeyPriceData, loading: priceLoading, error: priceError } = useRealTimeWhiskeyPrice(30000);

  // Fetch treasury wallet balances and WHISKEY price
  const fetchBalances = async () => {
    if (!connected) {
      setTreasurySolBalance(null);
      setTreasuryWhiskeyBalance(null);
      setLendingPoolSolBalance(null);
      setWhiskeyPrice(null);
      setTreasuryValueUsd(null);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch treasury SOL balance
      const solBalanceLamports = await connection.getBalance(TREASURY_WALLET);
      setTreasurySolBalance(solBalanceLamports / LAMPORTS_PER_SOL);

      // Fetch lending pool SOL balance
      const lendingPoolSolLamports = await connection.getBalance(LENDING_POOL_WALLET);
      setLendingPoolSolBalance(lendingPoolSolLamports / LAMPORTS_PER_SOL);

      // Fetch treasury WHISKEY token balance
      let whiskeyBalance = 0;
      try {
        const whiskeyTokenAccount = await getAssociatedTokenAddress(
          WHISKEY_TOKEN_MINT,
          TREASURY_WALLET
        );
        const tokenAccountInfo = await connection.getTokenAccountBalance(whiskeyTokenAccount);
        whiskeyBalance = tokenAccountInfo.value.uiAmount || 0;
        setTreasuryWhiskeyBalance(whiskeyBalance);
      } catch (error) {
        console.warn('Treasury WHISKEY token account not found or error:', error);
        setTreasuryWhiskeyBalance(0);
      }

      // Calculate treasury value in USD using real-time price
      if (whiskeyBalance > 0 && whiskeyPriceData?.usd) {
        setTreasuryValueUsd(whiskeyBalance * whiskeyPriceData.usd);
      } else {
        setTreasuryValueUsd(0);
      }
    } catch (error) {
      console.error('Error fetching treasury balances:', error);
    } finally {
      setIsLoading(false);
    }
  };



  // Auto-refresh treasury balances every 30 seconds when connected
  useEffect(() => {
    if (connected) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [connected]);

  // Recalculate treasury value when price data changes
  useEffect(() => {
    if (treasuryWhiskeyBalance !== null && whiskeyPriceData?.usd) {
      setTreasuryValueUsd(treasuryWhiskeyBalance * whiskeyPriceData.usd);
    }
  }, [whiskeyPriceData, treasuryWhiskeyBalance]);

  const formatBalance = (balance: number | null, decimals: number = 4): string => {
    if (balance === null) return '--';
    return balance.toFixed(decimals);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Treasury Dashboard</h2>
        <p className="text-gray-400">Monitor revenue split: 20% WHISKEY to treasury, 80% WHISKEY → USDC to lending pool, plus marketplace fees</p>
      </div>

      {/* Wallet Connection */}
      {!connected && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <Wallet className="w-8 h-8 text-amber-400" />
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Admin Wallet</h3>
              <p className="text-gray-400 mb-4">Connect your admin wallet to view treasury balances and earnings</p>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      {connected && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* WHISKEY Price Card */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">WHISKEY Price</h3>
                  <p className="text-gray-400 text-sm">Current market price</p>
                </div>
              </div>
              <button
                onClick={fetchBalances}
                disabled={isLoading}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-green-400">
                {priceLoading ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : whiskeyPriceData?.usd ? (
                  <div>
                    <div>${whiskeyPriceData.usd.toFixed(6)}</div>
                    {whiskeyPriceData.usd_24h_change !== 0 && (
                      <div className={`text-sm ${getPriceChangeColor(whiskeyPriceData.usd_24h_change)}`}>
                        {formatPercentageChange(whiskeyPriceData.usd_24h_change)}
                      </div>
                    )}
                  </div>
                ) : (
                  '--'
                )}
              </div>
              <div className="text-sm text-gray-400">
                Per WHISKEY token
                {whiskeyPriceData?.last_updated_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    Updated: {new Date(whiskeyPriceData.last_updated_at * 1000).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Treasury SOL Balance */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Treasury SOL</h3>
                  <p className="text-gray-400 text-sm">Network fees & SOL earnings</p>
                </div>
              </div>
              <button
                onClick={fetchBalances}
                disabled={isLoading}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-white">
                {formatBalance(treasurySolBalance)} SOL
              </div>
              <button
                onClick={() => {
                  setWithdrawType('SOL');
                  setShowWithdrawModal(true);
                }}
                disabled={true}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Treasury Funds</span>
              </button>
            </div>
          </div>

          {/* WHISKEY Balance */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Treasury WHISKEY</h3>
                  <p className="text-gray-400 text-sm">Earned from NFT sales & fees</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-amber-400">
                {formatBalance(treasuryWhiskeyBalance, 2)} WHISKEY
              </div>
              <div className="text-sm text-gray-400">
                ~${formatBalance(treasuryValueUsd, 2)} USD
              </div>
              <button
                onClick={() => {
                  setWithdrawType('WHISKEY');
                  setShowWithdrawModal(true);
                }}
                disabled={true}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-black py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Treasury Earnings</span>
              </button>
            </div>
          </div>

          {/* Lending Pool SOL Balance */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Lending Pool SOL</h3>
                  <p className="text-gray-400 text-sm">80% of mint revenue (as USDC)</p>
                </div>
              </div>
              <button
                onClick={fetchBalances}
                disabled={isLoading}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-gray-300 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-blue-400">
                {formatBalance(lendingPoolSolBalance)} SOL
              </div>
              <div className="text-sm text-gray-400">
                WHISKEY → USDC via Jupiter
              </div>
              <button
                disabled={true}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <DollarSign className="w-4 h-4" />
                <span>Lending Pool</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Market Stats */}
      {connected && whiskeyPriceData && (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-white mb-4">Market Statistics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                ${whiskeyPriceData.usd.toFixed(6)}
              </div>
              <div className="text-gray-400 text-sm">Current Price</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className={`text-2xl font-bold ${getPriceChangeColor(whiskeyPriceData.usd_24h_change)}`}>
                {formatPercentageChange(whiskeyPriceData.usd_24h_change)}
              </div>
              <div className="text-gray-400 text-sm">24h Change</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">
                ${(whiskeyPriceData.usd_24h_vol / 1000000).toFixed(2)}M
              </div>
              <div className="text-gray-400 text-sm">24h Volume</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">
                ${(whiskeyPriceData.usd_market_cap / 1000000).toFixed(2)}M
              </div>
              <div className="text-gray-400 text-sm">Market Cap</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-400">
            Last updated: {new Date(whiskeyPriceData.last_updated_at * 1000).toLocaleString()}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {connected && (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-white mb-4">Earnings Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{formatBalance(treasurySolBalance)} SOL</div>
              <div className="text-gray-400 text-sm">Treasury SOL Balance</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-amber-400">{formatBalance(treasuryWhiskeyBalance, 0)} WHISKEY</div>
              <div className="text-gray-400 text-sm">Treasury WHISKEY</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {treasuryValueUsd ? `$${treasuryValueUsd.toFixed(2)}` : '$0.00'}
              </div>
              <div className="text-gray-400 text-sm">USD Value</div>
            </div>
          </div>
        </div>
      )}



      {/* Additional Management Links */}
      <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
        <p className="text-gray-400 mb-4">Manage your NFT collections and company listings</p>
        <div className="flex flex-wrap gap-4">
          <a
            href="/admin/companies"
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Manage Companies
          </a>
          <a
            href="/admin/collections"
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Manage Collections
          </a>
          <a
            href="/admin/purchases"
            className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            View Purchases
          </a>
        </div>
      </div>
    </div>
  );
} 