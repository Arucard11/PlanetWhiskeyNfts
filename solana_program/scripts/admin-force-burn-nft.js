#!/usr/bin/env node

// Admin script to force burn NFT for testing (bypasses loan expiration check)
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

async function adminForceBurnNft(targetWallet, nftMint) {
    console.log('🔥 Admin Force NFT Burn Script');
    console.log('=' .repeat(60));
    console.log(`🎯 Target Wallet: ${targetWallet}`);
    console.log(`🖼️  NFT to Burn: ${nftMint || 'Auto-detect from wallet'}`);
    
    try {
        // Setup connection and program
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        
        // Load liquidation keypair (acts as admin)
        const liquidationKeypairPath = path.join(__dirname, '../liquidation-keypair.json');
        const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
        const liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));
        
        console.log('🔑 Admin Authority:', liquidationKeypair.publicKey.toString());
        
        // Setup program
        const lendingProgramId = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID);
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(liquidationKeypair),
            {}
        );
        
        // Load IDL
        const idlPath = path.join(__dirname, '../../planet-whiskey-nfts/src/lib/idl/lendingprogram.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        const program = new anchor.Program(idl, provider);
        
        // Derive borrower account PDA
        const targetWalletPubkey = new PublicKey(targetWallet);
        const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('borrower_account'), targetWalletPubkey.toBuffer()],
            lendingProgramId
        );
        
        console.log('📍 Borrower Account PDA:', borrowerAccountPda.toString());
        
        // Fetch borrower account
        let borrowerAccount;
        try {
            borrowerAccount = await program.account.borrowerAccount.fetch(borrowerAccountPda);
            console.log('✅ Found borrower account');
        } catch (error) {
            console.log('❌ Borrower account not found - wallet has no lending activity');
            return;
        }
        
        // Get NFT to burn
        let targetNftMint;
        if (nftMint) {
            targetNftMint = new PublicKey(nftMint);
        } else if (borrowerAccount.depositedNfts.length > 0) {
            targetNftMint = borrowerAccount.depositedNfts[0];
        } else {
            console.log('❌ No NFTs found to burn');
            return;
        }
        
        console.log(`🔥 Target NFT: ${targetNftMint.toString()}`);
        
        // Derive NFT escrow PDA
        const [nftEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('collateral_escrow'), targetWalletPubkey.toBuffer(), targetNftMint.toBuffer()],
            lendingProgramId
        );
        
        console.log(`📍 NFT Escrow PDA: ${nftEscrowPda.toString()}`);
        
        // Check if escrow account exists
        try {
            const escrowAccount = await connection.getAccountInfo(nftEscrowPda);
            if (!escrowAccount) {
                console.log('❌ NFT escrow account not found - NFT may not be deposited');
                return;
            }
            console.log('✅ NFT escrow account found');
        } catch (error) {
            console.log('❌ Error checking escrow account:', error);
            return;
        }
        
        // Method 1: Try to withdraw the NFT (if no outstanding debt)
        const totalDebtUsd = Number(borrowerAccount.totalDebtUsd) / 1_000_000;
        
        if (totalDebtUsd === 0) {
            console.log('💡 No outstanding debt - attempting to withdraw NFT instead of burning...');
            await withdrawNft(program, connection, borrowerAccount, targetNftMint, liquidationKeypair);
        } else {
            console.log(`⚠️  Outstanding debt: $${totalDebtUsd} - cannot withdraw, need to liquidate`);
            
            // Method 2: Force liquidate by finding the associated loan
            if (borrowerAccount.activeLoans.length > 0) {
                const loanPda = borrowerAccount.activeLoans[0];
                console.log(`🔥 Force liquidating via loan: ${loanPda.toString()}`);
                
                try {
                    const loanAccount = await program.account.loan.fetch(loanPda);
                    await forceLiquidateLoan(program, connection, loanPda, loanAccount, borrowerAccount, targetNftMint, liquidationKeypair);
                } catch (error) {
                    console.error('❌ Error force liquidating:', error);
                }
            } else {
                console.log('❌ No active loans found but debt exists - inconsistent state');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function withdrawNft(program, connection, borrowerAccount, nftMint, adminKeypair) {
    try {
        console.log('🔄 Attempting to withdraw NFT...');
        
        // Derive global market PDA
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('global_market')],
            program.programId
        );
        
        // Derive collection registry PDA
        const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('collection_registry_v2')],
            program.programId
        );
        
        // Get user's NFT token account
        const userWallet = borrowerAccount.owner;
        const userNftAccount = anchor.utils.token.associatedAddress(nftMint, userWallet);
        
        // Derive NFT escrow PDA
        const [nftEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('collateral_escrow'), userWallet.toBuffer(), nftMint.toBuffer()],
            program.programId
        );
        
        console.log('📍 Withdraw PDAs:');
        console.log(`  Global Market: ${globalMarketPda.toString()}`);
        console.log(`  Collection Registry: ${collectionRegistryPda.toString()}`);
        console.log(`  User NFT Account: ${userNftAccount.toString()}`);
        console.log(`  NFT Escrow: ${nftEscrowPda.toString()}`);
        
        // Build withdraw transaction
        const instruction = await program.methods
            .withdrawNft()
            .accounts({
                globalMarket: globalMarketPda,
                collectionRegistry: collectionRegistryPda,
                borrowerAccount: borrowerAccount.publicKey,
                nftMint: nftMint,
                userNftAccount: userNftAccount,
                nftEscrow: nftEscrowPda,
                user: userWallet, // This should be the actual user, not admin
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            })
            .instruction();
        
        console.log('⚠️  Note: This transaction should be signed by the actual user, not admin');
        console.log('💡 For testing, you might need to modify the program to allow admin withdrawals');
        
    } catch (error) {
        console.error('❌ Error withdrawing NFT:', error);
    }
}

async function forceLiquidateLoan(program, connection, loanPda, loanAccount, borrowerAccount, nftMint, liquidationKeypair) {
    try {
        console.log('🔥 Force liquidating via loan...');
        
        // Derive global market PDA
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('global_market')],
            program.programId
        );
        
        // Derive NFT escrow PDA
        const borrowerWallet = borrowerAccount.owner;
        const [nftEscrowPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('collateral_escrow'), borrowerWallet.toBuffer(), nftMint.toBuffer()],
            program.programId
        );
        
        console.log('📍 Liquidation PDAs:');
        console.log(`  Global Market: ${globalMarketPda.toString()}`);
        console.log(`  NFT Escrow: ${nftEscrowPda.toString()}`);
        console.log(`  Loan: ${loanPda.toString()}`);
        
        // Build liquidation transaction
        const instruction = await program.methods
            .liquidateExpiredLoan(loanPda)
            .accounts({
                borrowerAccount: loanAccount.borrowerAccount,
                globalMarket: globalMarketPda,
                loan: loanPda,
                nftMint: nftMint,
                nftEscrow: nftEscrowPda,
                liquidator: liquidationKeypair.publicKey,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .instruction();
        
        const transaction = new Transaction().add(instruction);
        transaction.feePayer = liquidationKeypair.publicKey;
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        // Sign and send transaction
        transaction.sign(liquidationKeypair);
        
        console.log('📡 Sending liquidation transaction...');
        const signature = await connection.sendRawTransaction(transaction.serialize());
        
        console.log('⏳ Waiting for confirmation...');
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
        
        console.log('🔥 NFT BURNED - Force liquidation completed!');
        console.log(`  Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log(`  NFT Mint: ${nftMint.toString()}`);
        console.log(`  Loan: ${loanPda.toString()}`);
        
    } catch (error) {
        console.error('❌ Error in force liquidation:', error);
        
        if (error.message.includes('custom program error: 0xbc4')) {
            console.log('💡 This error suggests the loan is not expired yet.');
            console.log('   The program only allows liquidation of expired loans.');
            console.log('   For testing, you might need to:');
            console.log('   1. Wait for the loan to expire naturally');
            console.log('   2. Modify the program to allow admin force liquidations');
            console.log('   3. Create a loan with a very short duration for testing');
        }
    }
}

// Main execution
async function main() {
    const targetWallet = process.argv[2];
    const nftMint = process.argv[3];
    
    if (!targetWallet) {
        console.log('❌ Please provide a wallet address');
        console.log('Usage: node scripts/admin-force-burn-nft.js <WALLET_ADDRESS> [NFT_MINT]');
        console.log('');
        console.log('Examples:');
        console.log('  # Auto-detect NFT from wallet');
        console.log('  node scripts/admin-force-burn-nft.js CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n');
        console.log('');
        console.log('  # Specific NFT');
        console.log('  node scripts/admin-force-burn-nft.js CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n BPZ8H8MdMDJcEkhDoEZfWjK4eRdfsnVBZWs8EE7Hgnbi');
        process.exit(1);
    }
    
    try {
        new PublicKey(targetWallet);
        if (nftMint) {
            new PublicKey(nftMint);
        }
    } catch (error) {
        console.log('❌ Invalid public key provided');
        process.exit(1);
    }
    
    await adminForceBurnNft(targetWallet, nftMint);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { adminForceBurnNft };
