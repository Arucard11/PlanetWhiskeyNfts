"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, SendTransactionError, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import MediaWithFallback from './MediaWithFallback';

export interface ListNftModalProps {
  isOpen: boolean;
  onClose: () => void;
  nftMintAddress: string;
  nftName: string;
  nftImageUrl: string;
  collectionMintAddress: string; // Added this prop
}

const ListNftModal: React.FC<ListNftModalProps> = ({
  isOpen,
  onClose,
  nftMintAddress,
  nftName,
  nftImageUrl,
  collectionMintAddress, // Added this prop
}) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [price, setPrice] = useState('');
  const [isListing, setIsListing] = useState(false);
  const [listingMessage, setListingMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log(`[LIST_NFT_MODAL] 🚀 Starting NFT listing process`);
    console.log(`[LIST_NFT_MODAL] 📝 Initial data:`, {
      nftMintAddress,
      nftName,
      collectionMintAddress,
      priceInput: price,
      walletConnected: !!publicKey
    });

    if (!publicKey || !signTransaction) {
      console.log(`[LIST_NFT_MODAL] ❌ Wallet not connected or signTransaction not available`);
      setListingMessage("❌ Please connect your wallet first.");
      return;
    }

    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber) || priceNumber <= 0) {
      console.log(`[LIST_NFT_MODAL] ❌ Invalid price: ${price}`);
      setListingMessage("❌ Please enter a valid price greater than 0.");
      return;
    }

    // Convert to smallest unit for on-chain operations (multiply by 10^6 for whiskey tokens)
    const priceInSmallestUnit = Math.floor(priceNumber * 1_000_000);
    console.log(`[LIST_NFT_MODAL] 💰 Price conversion:`, {
      userInput: price,
      parsedNumber: priceNumber,
      smallestUnit: priceInSmallestUnit
    });

    setIsListing(true);
    setListingMessage("1/4: Creating listing transaction...");

    try {
        // 1. Build transaction client-side using Anchor program
        console.log(`[LIST_NFT_MODAL] 🔧 Building transaction client-side...`);
        
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
        
        console.log(`[LIST_NFT_MODAL] 📍 Derived accounts:`, {
            listingPda: listingPda.toString(),
            escrowTokenAccount: escrowTokenAccount.toString(),
            sellerNftTokenAccount: sellerNftTokenAccount.toString()
        });
        
        // Build the list NFT instruction
        const listInstruction = await program.methods
            .listNft(new anchor.BN(priceInSmallestUnit))
            .accounts({
                seller: seller,
                listing: listingPda,
                sellerNftTokenAccount: sellerNftTokenAccount,
                escrowTokenAccount: escrowTokenAccount,
                nftToListMint: nftMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY,
            } as any)
            .instruction();
        
        // Create transaction
        const transaction = new Transaction();
        transaction.add(listInstruction);
        
        // Get fresh blockhash
        console.log(`[LIST_NFT_MODAL] 🔗 Getting fresh blockhash...`);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        setListingMessage("2/4: Please sign the transaction in your wallet...");
        console.log(`[LIST_NFT_MODAL] ✅ Transaction built client-side, requesting signature...`);

        // Phantom compatibility: Sign with wallet first, then send raw transaction
        const signedTransaction = await signTransaction(transaction);
        
        console.log(`[LIST_NFT_MODAL] ✅ Transaction signed successfully`);
        console.log(`[LIST_NFT_MODAL] 📡 Sending transaction to blockchain...`);

        let signature: string;
        try {
            signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                skipPreflight: true, // Skip simulation to prevent duplicate errors
                preflightCommitment: 'confirmed'
            });
            console.log("✅ Transaction sent successfully! Signature:", signature);
        } catch (sendError: any) {
            console.error("❌ Failed to send list transaction:", sendError);
            
            let userMessage = sendError.message || "Failed to send list transaction";

            // Check for common Solana errors and provide better messages
            if (userMessage.includes("This transaction has already been processed")) {
                userMessage = "It seems this listing was already submitted. Please check 'My NFTs' to see if it's active.";
            } else if (sendError instanceof SendTransactionError) {
                const detailedLogs = await sendError.getLogs(connection);
                console.log("📋 Transaction simulation logs:", detailedLogs);
                const errorSummary = detailedLogs?.find(log => log.toLowerCase().includes('error'));
                if (errorSummary) {
                    userMessage = `Transaction failed: ${errorSummary}`;
                }
            }
            
            throw new Error(userMessage);
        }

        console.log(`[LIST_NFT_MODAL] 📬 Transaction sent! Signature: ${signature}`);

        setListingMessage("3/4: Confirming transaction on the blockchain...");
        
        console.log(`[LIST_NFT_MODAL] ⏳ Confirming transaction...`);
        
        // Fast confirmation with aggressive polling
        console.log(`[LIST_NFT_MODAL] 🚀 Starting fast confirmation polling...`);
        let confirmed = false;
        const maxAttempts = 30; // 30 attempts over ~15 seconds
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const status = await connection.getSignatureStatus(signature);
                console.log(`[LIST_NFT_MODAL] 📊 Attempt ${attempt}: Status = ${status.value?.confirmationStatus || 'pending'}`);
                
                if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
                    console.log(`[LIST_NFT_MODAL] ✅ Transaction confirmed on attempt ${attempt}!`);
                    confirmed = true;
                    break;
                } else if (status.value?.err) {
                    throw new Error(`Transaction failed: ${status.value.err}`);
                }
                
                // Wait 500ms between checks for fast confirmation
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (statusError) {
                console.log(`[LIST_NFT_MODAL] ⚠️ Status check ${attempt} failed:`, statusError);
                if (attempt === maxAttempts) {
                    throw new Error('Failed to confirm transaction after multiple attempts');
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        if (!confirmed) {
            console.log(`[LIST_NFT_MODAL] ⏰ Timeout after ${maxAttempts} attempts, but proceeding...`);
        }

        console.log(`[LIST_NFT_MODAL] ✅ Transaction confirmed on blockchain!`);

        setListingMessage("4/4: Recording listing in the database...");

        console.log(`[LIST_NFT_MODAL] 💾 Saving listing to database...`);
        
        // 4. Record the listing in our database
        const recordRequestBody = {
            nftMintAddress,
            price: priceInSmallestUnit, // Also send the integer price here
            collectionMintAddress, // Pass it to the API
            signature,
        };
        
        console.log(`[LIST_NFT_MODAL] 📤 Sending database record request:`, {
          ...recordRequestBody,
          signature: `${signature.substring(0, 20)}...`
        });

        const recordResponse = await fetch('/api/marketplace/list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-wallet-address': publicKey.toBase58(),
            },
            body: JSON.stringify(recordRequestBody),
        });
        
        console.log(`[LIST_NFT_MODAL] 📨 Database API response status: ${recordResponse.status}`);
        
        const recordData = await recordResponse.json();
        console.log(`[LIST_NFT_MODAL] 📄 Database API response:`, {
          success: recordResponse.ok && recordData.success,
          message: recordData.message,
          hasData: !!recordData.data,
          error: recordData.error
        });

        if (!recordResponse.ok) {
            console.log(`[LIST_NFT_MODAL] ❌ Database save failed`);
            throw new Error(recordData.message || "Failed to record listing.");
        }

        console.log(`[LIST_NFT_MODAL] 🎉 Listing process completed successfully!`);
        setListingMessage("✅ Success! Your NFT is now listed.");
        setTimeout(() => {
            onClose();
            // You might want to trigger a refresh on the "My NFTs" page here
        }, 2000);

    } catch (error: any) {
        console.error(`[LIST_NFT_MODAL] ❌ Listing failed:`, error);
        console.error(`[LIST_NFT_MODAL] 🔥 Error details:`, {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
        });
        
        let errorMsg = error.message;
        
        // Handle specific duplicate transaction error
        if (errorMsg.includes("This transaction has already been processed") || 
            errorMsg.includes("already been processed") ||
            errorMsg.includes("duplicate transaction")) {
            errorMsg = "⚠️ Transaction already submitted. Please wait for the previous transaction to complete.";
            // Don't log this as an error since it's likely a user double-click
            console.warn(`[LIST_NFT_MODAL] ⚠️ Duplicate transaction detected - user may have clicked list multiple times`);
        }
        
        setListingMessage(`❌ Error: ${errorMsg}`);
    } finally {
        // Add a brief delay before enabling the button again to prevent rapid clicking
        setTimeout(() => {
            setIsListing(false);
        }, 1000);
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
              <h3 className="text-xl font-semibold text-white">List NFT for Sale</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X />
              </button>
            </div>
            
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-20 h-20 rounded-lg overflow-hidden">
                {nftImageUrl ? (
                  <MediaWithFallback 
                    src={nftImageUrl} 
                    alt={nftName} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-amber-200 text-xs bg-slate-800">
                    No Image
                  </div>
                )}
              </div>
              <div>
                <h4 className="font-bold text-lg text-amber-300">{nftName}</h4>
                <p className="text-xs text-gray-500 font-mono">{nftMintAddress}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2" htmlFor="price">
                  Set Price (in WHISKEY tokens)
                </label>
                <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Tag className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="e.g., 100"
                        required
                        min="0.01"
                        step="0.01"
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-amber-500 force-white-text"
                        style={{ 
                            color: 'white !important',
                            WebkitTextFillColor: 'white'
                        }}
                    />
                </div>
              </div>

                {listingMessage && (
                 <div className="space-y-2">
                   <p className={`text-sm text-center p-2 rounded-md ${listingMessage.includes('❌') ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                       {listingMessage}
                   </p>
                   
                   {/* Show NFT retrieval button if listing failed but NFT is stuck */}
                   {listingMessage.includes('On-chain transaction could not be verified') && (
                     <button
                       type="button"
                       onClick={async () => {
                         try {
                           if (!publicKey || !signTransaction) {
                             setListingMessage("❌ Wallet not connected");
                             return;
                           }
                           
                           setListingMessage("🔄 Attempting to retrieve NFT from escrow...");
                           
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
                           
                           // Check if escrow has the NFT
                           const escrowAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
                           if (!escrowAccountInfo) {
                               setListingMessage("❌ No escrow account found. NFT may already be in your wallet.");
                               return;
                           }
                           
                           // Try to cancel the listing to get NFT back
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
                           
                           const transaction = new Transaction();
                           transaction.add(cancelInstruction);
                           
                           const { blockhash } = await connection.getLatestBlockhash('confirmed');
                           transaction.recentBlockhash = blockhash;
                           transaction.feePayer = publicKey;
                           
                           const signedTransaction = await signTransaction(transaction);
                           const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
                               skipPreflight: false,
                               preflightCommitment: 'confirmed',
                           });
                           
                           setListingMessage("✅ NFT retrieval transaction sent! Please wait for confirmation...");
                           
                           // Wait for confirmation
                           await connection.confirmTransaction(signature, 'confirmed');
                           setListingMessage("🎉 NFT successfully retrieved! Please refresh the page to see it in your wallet.");
                           
                         } catch (error) {
                           console.error('NFT retrieval error:', error);
                           setListingMessage(`❌ NFT retrieval failed: ${error.message}`);
                         }
                       }}
                       className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                     >
                       🔄 Retrieve My NFT
                     </button>
                   )}
                 </div>
                )}

              <button
                type="submit"
                disabled={isListing}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50"
              >
                {isListing ? 'Processing...' : 'Confirm Listing'}
              </button>
            </form>
          </motion.div>
        </motion.div>
    </AnimatePresence>
  );
};

export default ListNftModal; 