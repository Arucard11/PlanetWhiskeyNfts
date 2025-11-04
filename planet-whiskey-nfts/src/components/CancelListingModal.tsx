"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, XCircle } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
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
      // Build transaction client-side using Anchor program
      console.log(`[CANCEL_MODAL] 🔧 Building transaction client-side...`);
      
      const program = getMarketplaceProgram();
      const nftMint = new PublicKey(nftMintAddress);
      const seller = publicKey;
      
      // Derive listing PDA
      const [listingPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
          program.programId
      );
      
      // Derive escrow token account PDA
      const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
          [Buffer.from("escrow"), listingPda.toBuffer()],
          program.programId
      );
      
      // Get seller's NFT token account
      const sellerNftTokenAccount = await getAssociatedTokenAddress(nftMint, seller);
      
      console.log(`[CANCEL_MODAL] 📍 Derived accounts:`, {
          listingPda: listingPda.toString(),
          escrowTokenAccount: escrowTokenAccount.toString(),
          sellerNftTokenAccount: sellerNftTokenAccount.toString()
      });
      
      // Check account states before transaction
      console.log(`[CANCEL_MODAL] 🔍 Checking account states before cancellation...`);
      const listingAccountInfo = await connection.getAccountInfo(listingPda);
      const escrowAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
      const sellerNftAccountInfo = await connection.getAccountInfo(sellerNftTokenAccount);
      
      console.log(`[CANCEL_MODAL] 📊 Account states:`, {
          listingExists: listingAccountInfo !== null,
          escrowExists: escrowAccountInfo !== null,
          sellerNftExists: sellerNftAccountInfo !== null,
          escrowBalance: escrowAccountInfo ? escrowAccountInfo.data.length : 'N/A',
          sellerNftBalance: sellerNftAccountInfo ? sellerNftAccountInfo.data.length : 'N/A'
      });
      
      if (!listingAccountInfo) {
          console.log(`[CANCEL_MODAL] ❌ Listing does not exist on-chain!`);
          setCancelMessage("❌ This listing does not exist on the blockchain. It may have already been cancelled.");
          return;
      }
      
      if (!escrowAccountInfo) {
          console.log(`[CANCEL_MODAL] ❌ Escrow account does not exist!`);
          setCancelMessage("❌ The escrow account for this listing does not exist. The NFT may already be back in your wallet.");
          return;
      }
      
      // Build the cancel listing instruction
      const cancelInstruction = await program.methods
          .cancelListing()
          .accounts({
              seller: seller,
              listing: listingPda,
              sellerNftTokenAccount: sellerNftTokenAccount,
              escrowTokenAccount: escrowTokenAccount,
              nftToListMint: nftMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .instruction();
      
      // Create transaction
      const transaction = new Transaction();
      transaction.add(cancelInstruction);

      setCancelMessage("2/4: Getting fresh blockchain data...");

      // Get fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setCancelMessage("3/4: Please sign the transaction...");
      console.log(`[CANCEL_MODAL] ✅ Transaction built client-side, requesting signature...`);

      // Phantom compatibility: Sign with wallet first, then send raw transaction
      const signedTransaction = await signTransaction(transaction);
      
      setCancelMessage("4/4: Confirming cancellation...");

      // Send with proper retry settings
      let signature: string;
      try {
        signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false, // Enable preflight to catch errors early
          preflightCommitment: 'confirmed',
          maxRetries: 2, // Reduced retries to prevent duplicate issues
        });
        console.log(`[CANCEL_MODAL] ✅ Transaction sent successfully! Signature: ${signature}`);
      } catch (sendError: any) {
        console.error(`[CANCEL_MODAL] ❌ Failed to send cancel transaction:`, sendError);
        
        let userMessage = sendError.message || "Failed to send cancel transaction";
        
        // Check for common Solana errors and provide better messages
        if (userMessage.includes("This transaction has already been processed")) {
          userMessage = "This listing was already cancelled. Please refresh the page to see the updated status.";
        } else if (userMessage.includes("Account does not exist")) {
          userMessage = "The listing or escrow account does not exist. The NFT may already be back in your wallet.";
        } else if (userMessage.includes("insufficient funds")) {
          userMessage = "Insufficient SOL for transaction fees. Please add some SOL to your wallet.";
        }
        
        throw new Error(userMessage);
      }

      // Fast confirmation with aggressive polling
      console.log('[CANCEL_MODAL] 🚀 Starting fast confirmation polling...');
      let confirmed = false;
      const maxAttempts = 30; // 30 attempts over ~15 seconds
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const status = await connection.getSignatureStatus(signature);
          console.log(`[CANCEL_MODAL] 📊 Attempt ${attempt}: Status = ${status.value?.confirmationStatus || 'pending'}`);
          
          if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
        console.log(`[CANCEL_MODAL] ✅ Transaction confirmed on attempt ${attempt}!`);
        
        // Check account states after successful transaction
        console.log(`[CANCEL_MODAL] 🔍 Checking account states after cancellation...`);
        const listingAccountInfoAfter = await connection.getAccountInfo(listingPda);
        const escrowAccountInfoAfter = await connection.getAccountInfo(escrowTokenAccount);
        const sellerNftAccountInfoAfter = await connection.getAccountInfo(sellerNftTokenAccount);
        
        console.log(`[CANCEL_MODAL] 📊 Account states after:`, {
            listingExists: listingAccountInfoAfter !== null,
            escrowExists: escrowAccountInfoAfter !== null,
            sellerNftExists: sellerNftAccountInfoAfter !== null,
            escrowBalance: escrowAccountInfoAfter ? escrowAccountInfoAfter.data.length : 'N/A',
            sellerNftBalance: sellerNftAccountInfoAfter ? sellerNftAccountInfoAfter.data.length : 'N/A'
        });
        
        confirmed = true;
        break;
          } else if (status.value?.err) {
            throw new Error(`Transaction failed: ${status.value.err}`);
          }
          
          // Wait 500ms between checks for fast confirmation
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (statusError) {
          console.log(`[CANCEL_MODAL] ⚠️ Status check ${attempt} failed:`, statusError);
          if (attempt === maxAttempts) {
            throw new Error('Failed to confirm transaction after multiple attempts');
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (!confirmed) {
        console.log(`[CANCEL_MODAL] ⏰ Timeout after ${maxAttempts} attempts, but proceeding...`);
      }

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
              <p className="text-white text-sm">Listed for {(priceInWhiskey / 1e6).toLocaleString()} Three Gold Treasury</p>
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