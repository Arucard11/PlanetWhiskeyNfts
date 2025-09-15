"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Shield } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SendTransactionError } from '@solana/web3.js';
import MediaWithFallback from './MediaWithFallback';

export interface BuyNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftMintAddress: string;
  nftName: string;
  nftImageUrl: string;
  collectionName: string;
  priceInWhiskey: number;
  onPurchaseSuccess: () => void;
}

const BuyNftModal: React.FC<BuyNftModalProps> = ({
  isOpen,
  onClose,
  nftMintAddress,
  nftName,
  nftImageUrl,
  collectionName,
  priceInWhiskey,
  onPurchaseSuccess,
}) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [isBuying, setIsBuying] = useState(false);
  const [buyMessage, setBuyMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!publicKey || !signTransaction) {
        setBuyMessage("Wallet not connected.");
        return;
    }

    setIsBuying(true);
    setBuyMessage("1/4: Preparing purchase transaction...");

    try {
        const txResponse = await fetch('/api/marketplace/transactions/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                buyerAddress: publicKey.toBase58(), 
                nftMintAddress,
                timestamp: Date.now() // Add unique timestamp
            }),
        });
        const txData = await txResponse.json();
        if (!txResponse.ok) throw new Error(txData.message || "Failed to create purchase transaction.");
        
        setBuyMessage("2/4: Please sign the transaction...");

        const transaction = Transaction.from(Buffer.from(txData.transaction, 'base64'));
        const signedTransaction = await signTransaction(transaction);
        
        console.log("🔍 DEBUG: About to send transaction to network...");
        let signature: string;
        try {
            signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: true, // Skip simulation
                preflightCommitment: 'confirmed'
            });
            console.log("✅ Transaction sent successfully! Signature:", signature);
        } catch (sendError: any) {
            console.error("❌ Failed to send transaction:", sendError);
            
            let userMessage = sendError.message || "Failed to send transaction";

            // Check for the specific simulation error
            if (userMessage.includes("Attempt to debit an account but found no record of a prior credit")) {
                console.error("💡 Likely cause: Insufficient SOL for rent/fees.");
                userMessage = "Purchase failed: Insufficient SOL. You need a small amount of SOL in your wallet (e.g., ~0.002 SOL) to pay for transaction fees and to create an account for your new NFT. Please add some SOL and try again.";
            } 
            // Try to get more detailed logs if available
            else if (sendError instanceof SendTransactionError) {
                const detailedLogs = await sendError.getLogs();
                console.log("📋 Transaction simulation logs:", detailedLogs);
                // Create a more readable summary of logs for the user if possible
                const errorSummary = detailedLogs?.find(log => log.toLowerCase().includes('error'));
                if (errorSummary) {
                    userMessage = `Transaction failed: ${errorSummary}`;
                }
            }
            
            throw new Error(userMessage);
        }

        setBuyMessage("3/4: Confirming purchase on blockchain...");

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        try {
            await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
        } catch (confirmError: any) {
            console.error("❌ Transaction confirmation failed:", confirmError);
            
            // Try to get transaction details even if confirmation failed
            try {
                const tx = await connection.getTransaction(signature, {
                    maxSupportedTransactionVersion: 0,
                });
                if (tx?.meta?.logMessages) {
                    console.log("📋 Transaction logs:", tx.meta.logMessages);
                    setBuyMessage(`❌ Transaction failed. Check console for detailed logs. Error: ${confirmError.message}`);
                } else {
                    setBuyMessage(`❌ Transaction confirmation failed: ${confirmError.message}`);
                }
            } catch (logError) {
                console.error("Failed to get transaction logs:", logError);
                setBuyMessage(`❌ Transaction confirmation failed: ${confirmError.message}`);
            }
            return;
        }

        setBuyMessage("4/4: Finalizing purchase in database...");

        const recordResponse = await fetch('/api/marketplace/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                transactionSignature: signature, 
                nftMintAddress,
                buyerWalletAddress: publicKey.toBase58(),
            }),
        });
        if (!recordResponse.ok) throw new Error("Failed to finalize purchase in database.");

        setBuyMessage("✅ Purchase complete! The NFT is yours.");
        setTimeout(() => {
            onPurchaseSuccess();
            onClose();
        }, 2000);

    } catch (error: any) {
        console.error("Purchase failed:", error);
        setBuyMessage(`❌ ${error.message}`);
    } finally {
        setIsBuying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-white">Confirm Purchase</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
          </div>
          
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-24 h-24 rounded-lg border-2 border-amber-500/50 overflow-hidden">
              {nftImageUrl ? (
                <MediaWithFallback 
                  src={nftImageUrl} 
                  alt={nftName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-amber-200 text-xs">
                  No Image
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-amber-400">{collectionName}</p>
              <h4 className="font-bold text-2xl text-white">{nftName}</h4>
            </div>
          </div>

          <div className="bg-slate-800/50 p-4 rounded-lg space-y-3">
             <div className="flex justify-between items-center text-lg">
                <span className="text-gray-300">Price:</span>
                <span className="font-bold text-white">{(priceInWhiskey / 1e6).toLocaleString()} WHISKEY</span>
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Transaction Fee:</span>
                <span className="text-gray-400">~0.001 SOL</span>
             </div>
          </div>
          
          {buyMessage && (
            <p className={`mt-4 text-sm text-center p-2 rounded-md ${buyMessage.includes('❌') ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                {buyMessage}
            </p>
          )}

          <button
            onClick={handleConfirm}
            disabled={isBuying}
            className="mt-6 w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50"
          >
            {isBuying ? 'Processing...' : 'Confirm & Buy Now'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BuyNftModal; 