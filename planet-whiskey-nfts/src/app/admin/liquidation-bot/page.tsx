'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface BotStatus {
  isRunning: boolean;
  pid: number | null;
  restartAttempts: number;
}

export default function LiquidationBotAdminPage() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBotStatus = async () => {
    try {
      const response = await fetch('/api/admin/liquidation-bot/status');
      const result = await response.json();
      
      if (result.success) {
        setBotStatus(result.data);
      } else {
        console.error('Failed to fetch bot status:', result.message);
      }
    } catch (error) {
      console.error('Error fetching bot status:', error);
    } finally {
      setLoading(false);
    }
  };

  const controlBot = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    
    try {
      const response = await fetch('/api/admin/liquidation-bot/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBotStatus(result.data);
        console.log(`Bot ${action} successful:`, result.message);
      } else {
        console.error(`Failed to ${action} bot:`, result.message);
      }
    } catch (error) {
      console.error(`Error ${action}ing bot:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchBotStatus();
    
    // Refresh status every 10 seconds
    const interval = setInterval(fetchBotStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (isRunning: boolean) => {
    return isRunning ? 'text-green-400' : 'text-red-400';
  };

  const getStatusIcon = (isRunning: boolean) => {
    return isRunning ? '🟢' : '🔴';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="spinner-whiskey"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            🤖 Liquidation Bot Management
          </h1>
          <p className="text-slate-400">
            Monitor and control the automated liquidation bot that burns NFTs for expired loans.
          </p>
        </motion.div>

        {/* Bot Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-whiskey p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Bot Status</h2>
            <button
              onClick={fetchBotStatus}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              disabled={loading}
            >
              🔄 Refresh
            </button>
          </div>

          {botStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getStatusIcon(botStatus.isRunning)}</span>
                  <h3 className="text-lg font-semibold text-white">Status</h3>
                </div>
                <p className={`text-lg font-bold ${getStatusColor(botStatus.isRunning)}`}>
                  {botStatus.isRunning ? 'RUNNING' : 'STOPPED'}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔢</span>
                  <h3 className="text-lg font-semibold text-white">Process ID</h3>
                </div>
                <p className="text-lg font-bold text-amber-400">
                  {botStatus.pid || 'N/A'}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🔄</span>
                  <h3 className="text-lg font-semibold text-white">Restart Attempts</h3>
                </div>
                <p className="text-lg font-bold text-blue-400">
                  {botStatus.restartAttempts}
                </p>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => controlBot('start')}
              disabled={botStatus?.isRunning || actionLoading === 'start'}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                botStatus?.isRunning || actionLoading === 'start'
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {actionLoading === 'start' ? '🔄 Starting...' : '▶️ Start Bot'}
            </button>

            <button
              onClick={() => controlBot('stop')}
              disabled={!botStatus?.isRunning || actionLoading === 'stop'}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                !botStatus?.isRunning || actionLoading === 'stop'
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {actionLoading === 'stop' ? '🔄 Stopping...' : '⏹️ Stop Bot'}
            </button>

            <button
              onClick={() => controlBot('restart')}
              disabled={actionLoading === 'restart'}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                actionLoading === 'restart'
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {actionLoading === 'restart' ? '🔄 Restarting...' : '🔄 Restart Bot'}
            </button>
          </div>
        </motion.div>

        {/* Information Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-whiskey p-6"
        >
          <h2 className="text-2xl font-bold text-white mb-4">ℹ️ How It Works</h2>
          
          <div className="space-y-4 text-slate-300">
            <div className="flex items-start gap-3">
              <span className="text-xl">🔍</span>
              <div>
                <h3 className="font-semibold text-white">Monitoring</h3>
                <p>The bot continuously scans all active loans every 5 minutes to check for expired loans.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl">⏰</span>
              <div>
                <h3 className="font-semibold text-white">Grace Period</h3>
                <p>Loans are only liquidated after they pass their grace period (loan duration + grace period).</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl">🔥</span>
              <div>
                <h3 className="font-semibold text-white">Liquidation</h3>
                <p>When a loan expires, the bot automatically burns the NFT collateral and marks the loan as defaulted.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl">🛡️</span>
              <div>
                <h3 className="font-semibold text-white">Security</h3>
                <p>Only the designated liquidation authority can perform liquidations. The bot runs with secure keypair authentication.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl">🔄</span>
              <div>
                <h3 className="font-semibold text-white">Auto-Restart</h3>
                <p>If the bot crashes, it will automatically restart up to 5 times with exponential backoff.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
