"use client";

import { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, createTransferInstruction } from '@solana/spl-token';
import { Wallet, TrendingUp, Send, RefreshCw, DollarSign } from 'lucide-react';

const WHISKEY_TOKEN_MINT = new PublicKey("Hjy8sNxUneizfMaWKXmdaTrKxw8C6AchBNHu2jfXFkfu");

export default function AdminPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [whiskeyBalance, setWhiskeyBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'SOL' | 'WHISKEY'>('SOL');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);

  // Fetch wallet balances
  const fetchBalances = async () => {
    if (!publicKey || !connected) {
      setSolBalance(null);
      setWhiskeyBalance(null);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch SOL balance
      const solBalanceLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceLamports / LAMPORTS_PER_SOL);

      // Fetch WHISKEY token balance
      try {
        const whiskeyTokenAccount = await getAssociatedTokenAddress(
          WHISKEY_TOKEN_MINT,
          publicKey
        );
        const tokenAccountInfo = await connection.getTokenAccountBalance(whiskeyTokenAccount);
        setWhiskeyBalance(tokenAccountInfo.value.uiAmount || 0);
      } catch (error) {
        console.warn('WHISKEY token account not found or error:', error);
        setWhiskeyBalance(0);
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    if (!publicKey || !signTransaction || !withdrawAddress || !withdrawAmount) {
      setWithdrawMessage('Please fill in all fields and connect your wallet.');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount <= 0) {
      setWithdrawMessage('Please enter a valid amount greater than 0.');
      return;
    }

    let destinationPubkey: PublicKey;
    try {
      destinationPubkey = new PublicKey(withdrawAddress);
    } catch (error) {
      setWithdrawMessage('Invalid destination wallet address.');
      return;
    }

    setIsWithdrawing(true);
    setWithdrawMessage('Preparing withdrawal transaction...');

    try {
      let transaction: Transaction;

      if (withdrawType === 'SOL') {
        // Check if we have enough SOL (keeping some for fees)
        const currentBalance = solBalance || 0;
        const minKeepAmount = 0.01; // Keep 0.01 SOL for future transactions
        const maxWithdrawable = Math.max(0, currentBalance - minKeepAmount);
        
        if (amount > maxWithdrawable) {
          throw new Error(`Cannot withdraw ${amount} SOL. Maximum withdrawable: ${maxWithdrawable.toFixed(4)} SOL (keeping 0.01 SOL for transaction fees)`);
        }

        // Create SOL transfer transaction
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: destinationPubkey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
          })
        );
      } else {
        // WHISKEY token withdrawal
        const currentBalance = whiskeyBalance || 0;
        if (amount > currentBalance) {
          throw new Error(`Cannot withdraw ${amount} WHISKEY. Current balance: ${currentBalance} WHISKEY`);
        }

        // Get token accounts
        const sourceTokenAccount = await getAssociatedTokenAddress(
          WHISKEY_TOKEN_MINT,
          publicKey
        );

        const destinationTokenAccount = await getAssociatedTokenAddress(
          WHISKEY_TOKEN_MINT,
          destinationPubkey
        );

        // Check if destination token account exists
        const destAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
        if (!destAccountInfo) {
          throw new Error('Destination wallet does not have a WHISKEY token account. They need to create one first by receiving WHISKEY tokens or using a wallet that supports SPL tokens.');
        }

        // Create token transfer transaction
        transaction = new Transaction().add(
          createTransferInstruction(
            sourceTokenAccount,
            destinationTokenAccount,
            publicKey,
            Math.floor(amount * 1e9), // Convert to base units (9 decimals for WHISKEY)
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Get recent blockhash and set fee payer
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setWithdrawMessage('Please sign the transaction in your wallet...');

      // Sign and send transaction
      const signedTransaction = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());

      setWithdrawMessage('Transaction sent. Confirming...');

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      setWithdrawMessage(`✅ Successfully withdrew ${amount} ${withdrawType} to ${withdrawAddress.slice(0, 8)}...${withdrawAddress.slice(-8)}`);
      
      // Refresh balances
      setTimeout(() => {
        fetchBalances();
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setWithdrawAddress('');
        setWithdrawMessage(null);
      }, 3000);

    } catch (error: any) {
      console.error('Withdrawal error:', error);
      setWithdrawMessage(`❌ Withdrawal failed: ${error.message}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Fetch balances on component mount and wallet change
  useEffect(() => {
    fetchBalances();
  }, [publicKey, connected]);

  const formatBalance = (balance: number | null, decimals: number = 4): string => {
    if (balance === null) return '--';
    return balance.toFixed(decimals);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h2>
        <p className="text-gray-400">Monitor your earnings and manage funds from NFT sales</p>
      </div>

      {/* Wallet Connection */}
      {!connected && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-6">
          <div className="flex items-center space-x-4">
            <Wallet className="w-8 h-8 text-amber-400" />
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Admin Wallet</h3>
              <p className="text-gray-400 mb-4">Connect your admin wallet to view balances and withdraw funds</p>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      {connected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SOL Balance */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">SOL Balance</h3>
                  <p className="text-gray-400 text-sm">Transaction fees & SOL earnings</p>
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
                {formatBalance(solBalance)} SOL
              </div>
              <button
                onClick={() => {
                  setWithdrawType('SOL');
                  setShowWithdrawModal(true);
                }}
                disabled={!solBalance || solBalance <= 0.01}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Withdraw SOL</span>
              </button>
            </div>
          </div>

          {/* WHISKEY Balance */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">WHISKEY Balance</h3>
                  <p className="text-gray-400 text-sm">NFT sales earnings</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-amber-400">
                {formatBalance(whiskeyBalance, 2)} WHISKEY
              </div>
              <button
                onClick={() => {
                  setWithdrawType('WHISKEY');
                  setShowWithdrawModal(true);
                }}
                disabled={!whiskeyBalance || whiskeyBalance <= 0}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-black py-2 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Withdraw WHISKEY</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {connected && (
        <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-6 shadow-xl">
          <h3 className="text-xl font-semibold text-white mb-4">Earnings Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{formatBalance(solBalance)} SOL</div>
              <div className="text-gray-400 text-sm">SOL Balance</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-amber-400">{formatBalance(whiskeyBalance, 0)} WHISKEY</div>
              <div className="text-gray-400 text-sm">WHISKEY Earned</div>
            </div>
            <div className="text-center p-4 bg-slate-800/50 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                ${((whiskeyBalance || 0) * 0.01).toFixed(2)}
              </div>
              <div className="text-gray-400 text-sm">Est. USD Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">
              Withdraw {withdrawType}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Amount to Withdraw
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder={`Enter amount in ${withdrawType}`}
                    step="0.0001"
                    min="0"
                    max={withdrawType === 'SOL' ? (solBalance || 0) - 0.01 : whiskeyBalance || 0}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => {
                      const maxAmount = withdrawType === 'SOL' 
                        ? Math.max(0, (solBalance || 0) - 0.01) 
                        : whiskeyBalance || 0;
                      setWithdrawAmount(maxAmount.toString());
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-amber-400 text-sm hover:text-amber-300"
                  >
                    Max
                  </button>
                </div>
                <p className="text-gray-400 text-xs mt-1">
                  Available: {withdrawType === 'SOL' 
                    ? `${formatBalance((solBalance || 0) - 0.01)} SOL (keeping 0.01 for fees)` 
                    : `${formatBalance(whiskeyBalance, 2)} WHISKEY`}
                </p>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Destination Wallet Address
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="Enter wallet address"
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {withdrawMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  withdrawMessage.includes('❌') ? 'bg-red-900/20 border border-red-700/40 text-red-300' :
                  withdrawMessage.includes('✅') ? 'bg-green-900/20 border border-green-700/40 text-green-300' :
                  'bg-blue-900/20 border border-blue-700/40 text-blue-300'
                }`}>
                  {withdrawMessage}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount('');
                    setWithdrawAddress('');
                    setWithdrawMessage(null);
                  }}
                  disabled={isWithdrawing}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !withdrawAmount || !withdrawAddress}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-black py-2 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
                >
                  {isWithdrawing ? 'Processing...' : `Withdraw ${withdrawType}`}
                </button>
              </div>
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