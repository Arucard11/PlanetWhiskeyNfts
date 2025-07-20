import type { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getMarketplaceProgram } from '@/lib/solanaUtils'; // ✅ FIXED - Use marketplace program
import { BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import MarketplaceListing from '@/models/MarketplaceListing';
import dbConnect from '@/lib/mongodb';

const SPL_MEMO_PROGRAM_ID = new PublicKey('Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo');

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { buyerAddress, nftMintAddress, timestamp } = req.body;
        
        if (!buyerAddress || !nftMintAddress || !timestamp) {
            return res.status(400).json({ message: 'Missing required fields: buyerAddress, nftMintAddress, and timestamp are required.' });
        }

        await dbConnect();
        const listingFromDb = await MarketplaceListing.findOne({ nftMintAddress, listingStatus: 'active' });

        if (!listingFromDb) {
            return res.status(404).json({ message: 'Active listing for this NFT not found.' });
        }

        console.log("🔍 DEBUG: Database listing details:");
        console.log(`🔍 DEBUG: Seller wallet: ${listingFromDb.sellerWalletAddress}`);
        console.log(`🔍 DEBUG: Price in WHISKEY: ${listingFromDb.priceInWhiskey}`);
        console.log(`🔍 DEBUG: Listing status: ${listingFromDb.listingStatus}`);

        const buyer = new PublicKey(buyerAddress);
        const seller = new PublicKey(listingFromDb.sellerWalletAddress);
        const nftMint = new PublicKey(nftMintAddress);

        const program = getMarketplaceProgram(); // ✅ FIXED - Use marketplace program
        const connection = program.provider.connection;

        // Derive PDAs needed for the transaction
        const [listingPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
            program.programId
        );

        // Check if listing PDA exists
        console.log("🔍 DEBUG: Checking listing PDA...");
        console.log(`🔍 DEBUG: Listing PDA: ${listingPda.toBase58()}`);
        
        try {
            const listingAccountInfo = await connection.getAccountInfo(listingPda);
            if (!listingAccountInfo) {
                console.log("❌ Listing PDA does not exist - this is a problem!");
                return res.status(400).json({ message: 'Listing not found on blockchain. It may have been cancelled.' });
            } else {
                console.log("✅ Listing PDA exists");
                console.log(`🔍 DEBUG: Listing account data length: ${listingAccountInfo.data.length}`);
                console.log(`🔍 DEBUG: Listing account owner: ${listingAccountInfo.owner.toBase58()}`);
            }
        } catch (listingAccountError) {
            console.error("Warning: Could not check listing account:", listingAccountError);
        }
        const [escrowTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), listingPda.toBuffer()],
            program.programId
        );

        // Check if escrow token account exists and has the NFT
        console.log("🔍 DEBUG: Checking escrow token account...");
        console.log(`🔍 DEBUG: Escrow account: ${escrowTokenAccount.toBase58()}`);
        
        try {
            const escrowAccountInfo = await connection.getAccountInfo(escrowTokenAccount);
            if (!escrowAccountInfo) {
                console.log("❌ Escrow token account does not exist - this is a problem!");
                return res.status(400).json({ message: 'Escrow account not found. The listing may be invalid.' });
            } else {
                console.log("✅ Escrow token account exists");
                console.log(`🔍 DEBUG: Escrow account data length: ${escrowAccountInfo.data.length}`);
                console.log(`🔍 DEBUG: Escrow account owner: ${escrowAccountInfo.owner.toBase58()}`);
                
                // Check if escrow has the NFT
                try {
                    const escrowBalance = await connection.getTokenAccountBalance(escrowTokenAccount);
                    console.log(`🔍 DEBUG: Escrow NFT balance: ${escrowBalance.value.amount}`);
                    if (parseInt(escrowBalance.value.amount) === 0) {
                        console.log("❌ Escrow account has no NFT balance!");
                        return res.status(400).json({ message: 'Escrow account has no NFT. The listing may be invalid.' });
                    }
                } catch (escrowBalanceError) {
                    console.error("Failed to check escrow balance:", escrowBalanceError);
                }
            }
        } catch (escrowAccountError) {
            console.error("Warning: Could not check escrow account:", escrowAccountError);
        }

        // Associated Token Accounts
        const whiskeyMint = new PublicKey("Hjy8sNxUneizfMaWKXmdaTrKxw8C6AchBNHu2jfXFkfu");
        const buyerWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyMint, buyer);
        const sellerWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyMint, seller);
        const buyerNftTokenAccount = await getAssociatedTokenAddress(nftMint, buyer);

        // Check if seller's WHISKEY token account exists
        console.log("🔍 DEBUG: Checking seller's WHISKEY token account...");
        console.log(`🔍 DEBUG: Seller WHISKEY account: ${sellerWhiskeyTokenAccount.toBase58()}`);
        
        try {
            const sellerTokenAccountInfo = await connection.getAccountInfo(sellerWhiskeyTokenAccount);
            if (!sellerTokenAccountInfo) {
                console.log("⚠️ Seller's WHISKEY token account does not exist - this will be created by init_if_needed");
            } else {
                console.log("✅ Seller's WHISKEY token account exists");
                console.log(`🔍 DEBUG: Seller account data length: ${sellerTokenAccountInfo.data.length}`);
                console.log(`🔍 DEBUG: Seller account owner: ${sellerTokenAccountInfo.owner.toBase58()}`);
            }
        } catch (sellerAccountError) {
            console.error("Warning: Could not check seller WHISKEY account:", sellerAccountError);
        }

        // Check if buyer's NFT token account exists
        console.log("🔍 DEBUG: Checking buyer's NFT token account...");
        console.log(`🔍 DEBUG: Buyer NFT account: ${buyerNftTokenAccount.toBase58()}`);
        
        try {
            const buyerNftAccountInfo = await connection.getAccountInfo(buyerNftTokenAccount);
            if (!buyerNftAccountInfo) {
                console.log("⚠️ Buyer's NFT token account does not exist - this will be created by init_if_needed");
            } else {
                console.log("✅ Buyer's NFT token account exists");
                console.log(`🔍 DEBUG: Buyer NFT account data length: ${buyerNftAccountInfo.data.length}`);
                console.log(`🔍 DEBUG: Buyer NFT account owner: ${buyerNftAccountInfo.owner.toBase58()}`);
            }
        } catch (buyerNftAccountError) {
            console.error("Warning: Could not check buyer NFT account:", buyerNftAccountError);
        }

        // Check buyer's WHISKEY balance before creating transaction
        console.log("🔍 DEBUG: Checking buyer's WHISKEY token balance...");
        console.log(`🔍 DEBUG: Buyer address: ${buyer.toBase58()}`);
        console.log(`🔍 DEBUG: WHISKEY mint: ${whiskeyMint.toBase58()}`);
        console.log(`🔍 DEBUG: Expected buyer WHISKEY account: ${buyerWhiskeyTokenAccount.toBase58()}`);
        console.log(`🔍 DEBUG: Required price from DB: ${listingFromDb.priceInWhiskey} (smallest units)`);
        console.log(`🔍 DEBUG: NFT mint address: ${nftMint.toBase58()}`);
        console.log(`🔍 DEBUG: Seller address: ${seller.toBase58()}`);
        
        try {
            const buyerTokenAccountInfo = await connection.getAccountInfo(buyerWhiskeyTokenAccount);
            
            if (!buyerTokenAccountInfo) {
                console.log("❌ Buyer's WHISKEY token account does not exist - this should be created by init_if_needed");
                console.log("⚠️ Proceeding with transaction creation - init_if_needed should handle account creation");
            } else {
                console.log("✅ Buyer's WHISKEY token account exists");
                console.log(`🔍 DEBUG: Account data length: ${buyerTokenAccountInfo.data.length}`);
                console.log(`🔍 DEBUG: Account owner: ${buyerTokenAccountInfo.owner.toBase58()}`);
                console.log(`🔍 DEBUG: Account lamports: ${buyerTokenAccountInfo.lamports}`);

                // Parse token account data to get balance
                try {
                    const buyerTokenAccount = await connection.getTokenAccountBalance(buyerWhiskeyTokenAccount);
                    const buyerBalanceUI = buyerTokenAccount.value.uiAmount || 0;
                    const buyerBalanceRaw = buyerTokenAccount.value.amount;
                    const requiredBalanceUI = listingFromDb.priceInWhiskey / 1e9; // Convert from smallest unit to UI amount
                    const requiredBalanceRaw = listingFromDb.priceInWhiskey;

                    console.log(`💰 DEBUG: Buyer balance UI: ${buyerBalanceUI} WHISKEY`);
                    console.log(`💰 DEBUG: Buyer balance RAW: ${buyerBalanceRaw} (smallest units)`);
                    console.log(`💰 DEBUG: Required balance UI: ${requiredBalanceUI} WHISKEY`);
                    console.log(`💰 DEBUG: Required balance RAW: ${requiredBalanceRaw} (smallest units)`);
                    console.log(`💰 DEBUG: Sufficient balance? ${parseInt(buyerBalanceRaw) >= requiredBalanceRaw}`);
                    
                    if (parseInt(buyerBalanceRaw) < requiredBalanceRaw) {
                        console.log(`❌ Insufficient balance: ${buyerBalanceRaw} < ${requiredBalanceRaw} (raw units)`);
                        return res.status(400).json({ 
                            message: `Insufficient WHISKEY tokens. You have ${buyerBalanceUI} but need ${requiredBalanceUI} WHISKEY to complete this purchase.` 
                        });
                    }
                    
                    console.log("✅ Buyer has sufficient WHISKEY tokens");
                } catch (balanceParseError) {
                    console.error("Failed to parse token account balance:", balanceParseError);
                    console.log("⚠️ Proceeding with transaction creation anyway");
                }
            }
        } catch (balanceError) {
            console.error("Warning: Could not check buyer balance:", balanceError);
            console.log("⚠️ Proceeding with transaction creation anyway - let the program handle the check");
        }

        const transaction = new Transaction();

        // Add a unique memo instruction to prevent "already processed" errors
        transaction.add(
          new TransactionInstruction({
            keys: [], // Memo does not require any accounts
            programId: SPL_MEMO_PROGRAM_ID,
            data: Buffer.from(`Buying NFT via Whiskey Planet: ${timestamp}`, 'utf-8'),
          })
        );

        // Build the instruction
        const instruction = await program.methods
            .buyNft()
            .accounts({
                buyer,
                listing: listingPda,
                seller,
                escrowTokenAccount,
                buyerNftTokenAccount,
                whiskeyTokenMint: whiskeyMint,
                buyerWhiskeyTokenAccount,
                sellerWhiskeyTokenAccount,
                nftToBuyMint: nftMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();

        transaction.add(instruction);
        
        transaction.feePayer = buyer;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        res.status(200).json({
            transaction: serializedTransaction.toString('base64'),
        });

    } catch (error: any) {
        console.error("Error creating buy_nft transaction:", error);
        res.status(500).json({ message: 'Error creating transaction', error: error.message });
    }
}

export default handler; 