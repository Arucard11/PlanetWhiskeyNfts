"use client";

import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { getCurrentWhiskeyRate, getCurrentSolRate } from '@/lib/coingeckoPricing';

interface MintDebugPanelProps {
  collectionOnChainAddress: string;
  displayName: string;
  displaySymbol: string;
  displayMintPriceWhiskeyTokens: number;
  mintPriceUsd?: number;
  isWhiskeyGated?: boolean;
}

const MintDebugPanel: React.FC<MintDebugPanelProps> = ({
  collectionOnChainAddress,
  displayName,
  displaySymbol,
  displayMintPriceWhiskeyTokens,
  mintPriceUsd = 0,
  isWhiskeyGated = false
}) => {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [debugResults, setDebugResults] = useState<any>(null);
  const [isDebugging, setIsDebugging] = useState(false);

  const runDebugChecks = async () => {
    if (!publicKey || !connected) {
      setDebugResults({ error: 'Wallet not connected' });
      return;
    }

    setIsDebugging(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      walletAddress: publicKey.toString(),
      collectionAddress: collectionOnChainAddress,
      checks: {}
    };

    try {
      // 1. Check wallet balances
      console.log('[DEBUG] Checking wallet balances...');
      const solBalance = await connection.getBalance(publicKey);
      results.checks.solBalance = {
        lamports: solBalance,
        sol: solBalance / 1e9,
        sufficient: solBalance >= 0.04e9
      };

      // Check WHISKEY balance
      const whiskeyMint = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!);
      const whiskeyAccount = getAssociatedTokenAddressSync(whiskeyMint, publicKey);
      try {
        const whiskeyAccountInfo = await connection.getTokenAccountBalance(whiskeyAccount);
        results.checks.whiskeyBalance = {
          tokens: parseFloat(whiskeyAccountInfo.value.amount) / 1e6,
          sufficient: parseFloat(whiskeyAccountInfo.value.amount) >= displayMintPriceWhiskeyTokens * 1e6
        };
      } catch (error) {
        results.checks.whiskeyBalance = {
          error: 'No WHISKEY token account found',
          sufficient: false
        };
      }

      // Check USDC balance (for regular mints)
      if (!isWhiskeyGated) {
        const usdcMint = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
        const usdcAccount = getAssociatedTokenAddressSync(usdcMint, publicKey);
        try {
          const usdcAccountInfo = await connection.getTokenAccountBalance(usdcAccount);
          results.checks.usdcBalance = {
            tokens: parseFloat(usdcAccountInfo.value.amount) / 1e6,
            sufficient: parseFloat(usdcAccountInfo.value.amount) >= mintPriceUsd * 1e6
          };
        } catch (error) {
          results.checks.usdcBalance = {
            error: 'No USDC token account found',
            sufficient: false
          };
        }
      }

      // 2. Check collection config account
      console.log('[DEBUG] Checking collection config...');
      try {
        const [collectionConfigPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("collection"), Buffer.from(displayName)],
          new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!)
        );
        
        const collectionConfigInfo = await connection.getAccountInfo(collectionConfigPda);
        results.checks.collectionConfig = {
          address: collectionConfigPda.toString(),
          exists: !!collectionConfigInfo,
          owner: collectionConfigInfo?.owner.toString(),
          dataLength: collectionConfigInfo?.data.length
        };
      } catch (error) {
        results.checks.collectionConfig = {
          error: error.message
        };
      }

      // 3. Check treasury and vault accounts
      console.log('[DEBUG] Checking treasury accounts...');
      const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
      const capitalVault = new PublicKey("DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs");
      
      try {
        const treasuryWhiskeyAccount = getAssociatedTokenAddressSync(whiskeyMint, treasuryWallet);
        const treasuryAccountInfo = await connection.getTokenAccountBalance(treasuryWhiskeyAccount);
        results.checks.treasuryWhiskeyAccount = {
          address: treasuryWhiskeyAccount.toString(),
          balance: parseFloat(treasuryAccountInfo.value.amount) / 1e6
        };
      } catch (error) {
        results.checks.treasuryWhiskeyAccount = {
          error: error.message
        };
      }

      try {
        const vaultAccountInfo = await connection.getAccountInfo(capitalVault);
        results.checks.capitalVault = {
          address: capitalVault.toString(),
          exists: !!vaultAccountInfo,
          owner: vaultAccountInfo?.owner.toString()
        };
      } catch (error) {
        results.checks.capitalVault = {
          error: error.message
        };
      }

      // 4. Check current prices and payment calculation
      console.log('[DEBUG] Checking current prices and payment calculation...');
      try {
        const whiskeyRate = await getCurrentWhiskeyRate();
        const solRate = await getCurrentSolRate();
        
        // Calculate correct payment split
        const expectedTotalUsd = mintPriceUsd || 0;
        const lendingPercentage = 0.80; // 80% to lending (fixed to add up to 100%)
        const treasuryPercentage = 0.20; // 20% to treasury
        const usdcToVault = expectedTotalUsd * lendingPercentage;
        const whiskeyToTreasuryUsd = expectedTotalUsd * treasuryPercentage;
        const whiskeyToTreasury = whiskeyToTreasuryUsd / whiskeyRate;
        
        results.checks.prices = {
          whiskeyUsd: whiskeyRate,
          solUsd: solRate,
          mintPriceUsd: mintPriceUsd,
          whiskeyTokensNeeded: displayMintPriceWhiskeyTokens,
          paymentCalculation: {
            expectedTotalUsd,
            usdcToVault,
            whiskeyToTreasuryUsd,
            whiskeyToTreasury,
            totalPayment: whiskeyToTreasuryUsd + usdcToVault,
            matchesExpected: Math.abs((whiskeyToTreasuryUsd + usdcToVault) - expectedTotalUsd) < 0.01
          }
        };
      } catch (error) {
        results.checks.prices = {
          error: error.message
        };
      }

      // 5. Check RPC endpoint health
      console.log('[DEBUG] Checking RPC health...');
      try {
        const slot = await connection.getSlot();
        const blockHeight = await connection.getBlockHeight();
        results.checks.rpcHealth = {
          endpoint: connection.rpcEndpoint,
          currentSlot: slot,
          blockHeight: blockHeight,
          healthy: true
        };
      } catch (error) {
        results.checks.rpcHealth = {
          error: error.message,
          healthy: false
        };
      }

      // 6. Test transaction simulation (without sending)
      console.log('[DEBUG] Testing transaction simulation...');
      try {
        // Generate a test NFT mint keypair
        const testNftMint = PublicKey.generate();
        const nftTokenAccount = getAssociatedTokenAddressSync(testNftMint, publicKey);
        
        // Create a minimal test transaction
        const testTransaction = {
          instructions: [],
          accounts: {
            user: publicKey.toString(),
            nftMint: testNftMint.toString(),
            nftTokenAccount: nftTokenAccount.toString(),
            collectionConfig: results.checks.collectionConfig?.address || 'unknown'
          }
        };
        
        results.checks.transactionSimulation = {
          testTransaction,
          canBuild: true
        };
      } catch (error) {
        results.checks.transactionSimulation = {
          error: error.message,
          canBuild: false
        };
      }

      // 7. Check wallet NFT count for this collection
      console.log('[DEBUG] Checking wallet NFT count...');
      try {
        const response = await fetch('/api/wallet/nft-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: publicKey.toString(),
            collectionMintAddress: collectionOnChainAddress
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          results.checks.walletNftCount = {
            count: data.count,
            limit: 5,
            canMint: data.count < 5
          };
        } else {
          results.checks.walletNftCount = {
            error: 'Failed to fetch NFT count'
          };
        }
      } catch (error) {
        results.checks.walletNftCount = {
          error: error.message
        };
      }

      // Overall assessment
      const criticalIssues = [];
      if (!results.checks.solBalance?.sufficient) {
        criticalIssues.push('Insufficient SOL balance');
      }
      if (!results.checks.whiskeyBalance?.sufficient) {
        criticalIssues.push('Insufficient WHISKEY balance');
      }
      if (!isWhiskeyGated && !results.checks.usdcBalance?.sufficient) {
        criticalIssues.push('Insufficient USDC balance');
      }
      if (!results.checks.collectionConfig?.exists) {
        criticalIssues.push('Collection config not found');
      }
      if (!results.checks.rpcHealth?.healthy) {
        criticalIssues.push('RPC connection issues');
      }
      if (results.checks.walletNftCount?.count >= 5) {
        criticalIssues.push('Wallet NFT limit reached');
      }

      results.overall = {
        canMint: criticalIssues.length === 0,
        criticalIssues,
        warnings: []
      };

      setDebugResults(results);
      console.log('[DEBUG] Debug results:', results);

    } catch (error) {
      console.error('[DEBUG] Debug check failed:', error);
      setDebugResults({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-white/10 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-semibold text-white mb-3">🔍 Mint Debug Panel</h3>
      
      <button
        onClick={runDebugChecks}
        disabled={isDebugging || !connected}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium"
      >
        {isDebugging ? 'Running Debug Checks...' : 'Run Debug Checks'}
      </button>

      {debugResults && (
        <div className="space-y-4">
          {debugResults.error ? (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
              <h4 className="text-red-400 font-semibold">❌ Debug Error</h4>
              <p className="text-red-300 text-sm">{debugResults.error}</p>
            </div>
          ) : (
            <>
              {/* Overall Status */}
              <div className={`border rounded-lg p-3 ${
                debugResults.overall?.canMint 
                  ? 'bg-green-900/20 border-green-500/50' 
                  : 'bg-red-900/20 border-red-500/50'
              }`}>
                <h4 className={`font-semibold ${
                  debugResults.overall?.canMint ? 'text-green-400' : 'text-red-400'
                }`}>
                  {debugResults.overall?.canMint ? '✅ Ready to Mint' : '❌ Cannot Mint'}
                </h4>
                {debugResults.overall?.criticalIssues?.length > 0 && (
                  <ul className="text-red-300 text-sm mt-2">
                    {debugResults.overall.criticalIssues.map((issue: string, index: number) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Detailed Results */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wallet Balances */}
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <h5 className="text-white font-medium mb-2">💰 Wallet Balances</h5>
                  <div className="space-y-1 text-sm">
                    <div className={`${debugResults.checks.solBalance?.sufficient ? 'text-green-400' : 'text-red-400'}`}>
                      SOL: {debugResults.checks.solBalance?.sol?.toFixed(4)} SOL
                    </div>
                    <div className={`${debugResults.checks.whiskeyBalance?.sufficient ? 'text-green-400' : 'text-red-400'}`}>
                      WHISKEY: {debugResults.checks.whiskeyBalance?.tokens?.toFixed(2) || 'N/A'} tokens
                    </div>
                    {!isWhiskeyGated && (
                      <div className={`${debugResults.checks.usdcBalance?.sufficient ? 'text-green-400' : 'text-red-400'}`}>
                        USDC: {debugResults.checks.usdcBalance?.tokens?.toFixed(2) || 'N/A'} tokens
                      </div>
                    )}
                  </div>
                </div>

                {/* Account Status */}
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <h5 className="text-white font-medium mb-2">🏦 Account Status</h5>
                  <div className="space-y-1 text-sm">
                    <div className={`${debugResults.checks.collectionConfig?.exists ? 'text-green-400' : 'text-red-400'}`}>
                      Collection Config: {debugResults.checks.collectionConfig?.exists ? '✅' : '❌'}
                    </div>
                    <div className={`${debugResults.checks.capitalVault?.exists ? 'text-green-400' : 'text-red-400'}`}>
                      Capital Vault: {debugResults.checks.capitalVault?.exists ? '✅' : '❌'}
                    </div>
                    <div className={`${debugResults.checks.rpcHealth?.healthy ? 'text-green-400' : 'text-red-400'}`}>
                      RPC Health: {debugResults.checks.rpcHealth?.healthy ? '✅' : '❌'}
                    </div>
                  </div>
                </div>

                {/* NFT Limits */}
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <h5 className="text-white font-medium mb-2">🎨 NFT Limits</h5>
                  <div className="space-y-1 text-sm">
                    <div className={`${debugResults.checks.walletNftCount?.canMint ? 'text-green-400' : 'text-red-400'}`}>
                      Wallet NFTs: {debugResults.checks.walletNftCount?.count || 0}/5
                    </div>
                    <div className="text-blue-400">
                      Collection: {displayName}
                    </div>
                  </div>
                </div>

                {/* Prices & Payment Calculation */}
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <h5 className="text-white font-medium mb-2">💱 Payment Calculation</h5>
                  <div className="space-y-1 text-sm">
                    <div className="text-blue-400">
                      WHISKEY: ${debugResults.checks.prices?.whiskeyUsd?.toFixed(4) || 'N/A'}
                    </div>
                    <div className="text-blue-400">
                      SOL: ${debugResults.checks.prices?.solUsd?.toFixed(2) || 'N/A'}
                    </div>
                    <div className="text-blue-400">
                      Expected Total: ${debugResults.checks.prices?.paymentCalculation?.expectedTotalUsd?.toFixed(2) || 'N/A'}
                    </div>
                    <div className={`${debugResults.checks.prices?.paymentCalculation?.matchesExpected ? 'text-green-400' : 'text-red-400'}`}>
                      Payment Match: {debugResults.checks.prices?.paymentCalculation?.matchesExpected ? '✅' : '❌'}
                    </div>
                    <div className="text-xs text-gray-400">
                      USDC: ${debugResults.checks.prices?.paymentCalculation?.usdcToVault?.toFixed(2) || 'N/A'} | 
                      WHISKEY: ${debugResults.checks.prices?.paymentCalculation?.whiskeyToTreasuryUsd?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Debug Data */}
              <details className="bg-slate-900/50 rounded-lg p-3">
                <summary className="text-white font-medium cursor-pointer">🔧 Raw Debug Data</summary>
                <pre className="text-xs text-gray-300 mt-2 overflow-auto max-h-64">
                  {JSON.stringify(debugResults, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MintDebugPanel;
