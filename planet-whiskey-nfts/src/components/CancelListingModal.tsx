"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, XCircle } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import MediaWithFallback from './MediaWithFallback';

export interface CancelListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftMintAddress: string;
  nftName: string;
  nftImageUrl: string;
  collectionName: string;
  priceInWhiskey: number;
  onCancelSuccess: () => void;
}

const CancelListingModal: React.FC<CancelListingModalProps> = ({
  isOpen,
  onClose,
  nftMintAddress,
  nftName,
  nftImageUrl,
  collectionName,
  priceInWhiskey,
  onCancelSuccess,
}) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!publicKey || !signTransaction) {
      setCancelMessage("Wallet not connected.");
      return;
    }

    // Prevent multiple submissions
    if (isCancelling) {
      console.log("[CANCEL_MODAL] Already processing, ignoring duplicate click");
      return;
    }

    setIsCancelling(true);
    setCancelMessage("1/4: Creating cancel transaction...");

    try {
      // Add timestamp for transaction uniqueness
      const cancelTimestamp = Date.now();
      
      // Create cancel transaction via API
      const txResponse = await fetch('/api/marketplace/transactions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sellerAddress: publicKey.toBase58(), 
          nftMintAddress,
          timestamp: cancelTimestamp
        }),
      });
      
      const txData = await txResponse.json();
      if (!txResponse.ok) {
        throw new Error(txData.message || "Failed to create cancel transaction.");
      }

      setCancelMessage("2/4: Getting fresh blockchain data...");

      // Get fresh blockhash BEFORE deserializing the transaction
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      // Deserialize and update the transaction with fresh blockhash
      const transaction = Transaction.from(Buffer.from(txData.transaction, 'base64'));
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setCancelMessage("3/4: Please sign the transaction...");

      const signedTransaction = await signTransaction(transaction);
      
      setCancelMessage("4/4: Confirming cancellation...");

      // Send with proper retry settings
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 2, // Reduced retries to prevent duplicate issues
      });

      // Confirm the transaction
      await connection.confirmTransaction({ 
        signature, 
        blockhash, 
        lastValidBlockHeight 
      }, 'confirmed');

      // Update the database to mark as cancelled
      const updateResponse = await fetch('/api/marketplace/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transactionSignature: signature, 
          nftMintAddress,
          sellerWalletAddress: publicKey.toBase58(),
        }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update listing status.");
      }

      setCancelMessage("✅ Listing cancelled successfully!");
      setTimeout(() => {
        onCancelSuccess();
        onClose();
      }, 2000);

    } catch (error: any) {
      console.error("Cancel failed:", error);
      
      let errorMsg = error.message;
      
      // Handle specific blockchain errors
      if (errorMsg.includes("Blockhash not found")) {
        errorMsg = "⚠️ Transaction expired. Please try again.";
      } else if (errorMsg.includes("Transaction simulation failed")) {
        errorMsg = "⚠️ Transaction failed simulation. Please try again.";
      } else if (errorMsg.includes("already been processed") || errorMsg.includes("This transaction has already been processed")) {
        errorMsg = "⚠️ Transaction already submitted. Please wait for it to complete or refresh the page.";
      } else if (errorMsg.includes("instruction spent from the balance of an account it does not own")) {
        errorMsg = "⚠️ Program update needed. Please contact support - your NFT is still listed but cannot be cancelled through the UI right now.";
      } else if (errorMsg.includes("Error processing Instruction")) {
        errorMsg = "⚠️ Blockchain program error. Please try again or contact support.";
      }
      
      setCancelMessage(`❌ Error: ${errorMsg}`);
    } finally {
      setTimeout(() => {
        setIsCancelling(false);
      }, 2000); // Longer delay to prevent rapid clicking
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
            <h3 className="text-xl font-semibold text-white">Cancel Listing</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X /></button>
          </div>
          
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-24 h-24 rounded-lg border-2 border-red-500/50 overflow-hidden">
              {nftImageUrl ? (
                <MediaWithFallback 
                  src={nftImageUrl} 
                  alt={nftName} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-red-200 text-xs">
                  No Image
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-red-400">{collectionName}</p>
              <h4 className="font-bold text-2xl text-white">{nftName}</h4>
              <p className="text-white text-sm">Listed for {(priceInWhiskey / 1e6).toLocaleString()} WHISKEY</p>
            </div>
          </div>

          <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg mb-4">
            <p className="text-red-200 text-sm">
              ⚠️ This will cancel your listing and return the NFT to your wallet. You can list it again later if desired.
            </p>
          </div>
          
          {cancelMessage && (
            <p className={`mt-4 text-sm text-center p-2 rounded-md ${cancelMessage.includes('❌') ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
              {cancelMessage}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-600 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Keep Listed
            </button>
            <button
              onClick={handleConfirm}
              disabled={isCancelling}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-500 disabled:hover:to-red-600 flex items-center justify-center gap-2 transition-all duration-300"
            >
              <XCircle className="h-4 w-4" />
              {isCancelling ? 'Cancelling...' : 'Cancel Listing'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CancelListingModal; 