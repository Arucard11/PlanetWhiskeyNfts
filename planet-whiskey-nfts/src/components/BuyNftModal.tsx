"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Shield } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SendTransactionError, PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
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
        // Build transaction client-side using Anchor program
        console.log(`[BUY_MODAL] 🔧 Building transaction client-side...`);
        
        const program = getMarketplaceProgram();
        const nftMint = new PublicKey(nftMintAddress);
        const buyer = publicKey;
        
        // Get listing data from API first to find the seller
        const listingResponse = await fetch(`/api/marketplace/listings?nftMintAddress=${nftMintAddress}`);
        if (!listingResponse.ok) throw new Error("Failed to fetch listing data");
        const listingData = await listingResponse.json();
        const listing = listingData.listings.find((l: any) => l.nftMintAddress === nftMintAddress);
        if (!listing) throw new Error("Listing not found");
        
        const seller = new PublicKey(listing.sellerWalletAddress);
        const whiskeyMint = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_TOKEN_MINT!);
        const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
        
        // Derive PDAs
        const [listingPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
            program.programId
        );
        
        const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), listingPda.toBuffer()],
            program.programId
        );
        
        // Get token accounts
        const buyerNftTokenAccount = await getAssociatedTokenAddress(nftMint, buyer);
        const buyerWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyMint, buyer);
        const sellerWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyMint, seller);
        const treasuryWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyMint, treasuryWallet);
        
        // Get global market PDA (needed for marketplace program)
        const [globalMarket] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_market")],
            new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!)
        );
        
        console.log(`[BUY_MODAL] 📍 Derived accounts:`, {
            listingPda: listingPda.toString(),
            escrowTokenAccount: escrowTokenAccount.toString(),
            buyerNftTokenAccount: buyerNftTokenAccount.toString(),
            seller: seller.toString()
        });
        
        // Build the buy NFT instruction
        const buyInstruction = await program.methods
            .buyNft()
            .accounts({
                buyer: buyer,
                listing: listingPda,
                seller: seller,
                escrowTokenAccount: escrowTokenAccount,
                buyerNftTokenAccount: buyerNftTokenAccount,
                whiskeyTokenMint: whiskeyMint,
                buyerWhiskeyTokenAccount: buyerWhiskeyTokenAccount,
                sellerWhiskeyTokenAccount: sellerWhiskeyTokenAccount,
                treasuryWhiskeyTokenAccount: treasuryWhiskeyTokenAccount,
                treasuryWallet: treasuryWallet,
                globalMarket: globalMarket,
                nftToBuyMint: nftMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();
        
        // Create transaction
        const transaction = new Transaction();
        
        // Check if buyer NFT token account exists, create if not
        const buyerNftAccountInfo = await connection.getAccountInfo(buyerNftTokenAccount);
        if (!buyerNftAccountInfo) {
            const createBuyerNftAtaIx = createAssociatedTokenAccountInstruction(
                buyer, // payer
                buyerNftTokenAccount, // ata
                buyer, // owner
                nftMint // mint
            );
            transaction.add(createBuyerNftAtaIx);
        }
        
        transaction.add(buyInstruction);
        
        // Get fresh blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        setBuyMessage("2/4: Please sign the transaction...");
        console.log(`[BUY_MODAL] ✅ Transaction built client-side, requesting signature...`);

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
        
        // Fast confirmation with aggressive polling
        console.log('[BUY_MODAL] 🚀 Starting fast confirmation polling...');
        let confirmed = false;
        const maxAttempts = 30; // 30 attempts over ~15 seconds
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const status = await connection.getSignatureStatus(signature);
                console.log(`[BUY_MODAL] 📊 Attempt ${attempt}: Status = ${status.value?.confirmationStatus || 'pending'}`);
                
                if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                    console.log(`[BUY_MODAL] ✅ Transaction confirmed on attempt ${attempt}!`);
                    confirmed = true;
                    break;
                } else if (status.value?.err) {
                    setBuyMessage(`❌ Transaction failed: ${status.value.err}`);
                    return;
                }
                
                // Wait 500ms between checks for fast confirmation
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (statusError) {
                console.log(`[BUY_MODAL] ⚠️ Status check ${attempt} failed:`, statusError);
                if (attempt === maxAttempts) {
                    // Try to get transaction details for better error reporting
                    try {
                        const tx = await connection.getTransaction(signature, {
                            maxSupportedTransactionVersion: 0,
                        });
                        if (tx?.meta?.logMessages) {
                            console.log("📋 Transaction logs:", tx.meta.logMessages);
                            setBuyMessage(`❌ Transaction failed. Check console for detailed logs.`);
                        } else {
                            setBuyMessage(`❌ Transaction confirmation failed after multiple attempts`);
                        }
                    } catch (logError) {
                        console.error("Failed to get transaction logs:", logError);
                        setBuyMessage(`❌ Transaction confirmation failed after multiple attempts`);
                    }
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        if (!confirmed) {
            console.log(`[BUY_MODAL] ⏰ Timeout after ${maxAttempts} attempts, but proceeding...`);
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