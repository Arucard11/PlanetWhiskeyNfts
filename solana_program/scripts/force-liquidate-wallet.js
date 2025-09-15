#!/usr/bin/env node

// Script to force liquidate NFTs for a specific wallet (for testing)
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

async function forceLiquidateWallet(targetWallet) {
    console.log('🔥 Force Liquidation Script');
    console.log('=' .repeat(60));
    console.log(`🎯 Target Wallet: ${targetWallet}`);
    
    try {
        // Setup connection and program
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        
        // Load liquidation keypair
        const liquidationKeypairPath = path.join(__dirname, '../liquidation-keypair.json');
        const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
        const liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));
        
        console.log('🔑 Liquidation Authority:', liquidationKeypair.publicKey.toString());
        
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
        
        console.log('\n📊 Borrower Account Details:');
        console.log(`  Owner: ${borrowerAccount.owner.toString()}`);
        console.log(`  Deposited NFTs: ${borrowerAccount.depositedNfts.length}`);
        console.log(`  Active Loans: ${borrowerAccount.activeLoans.length}`);
        
        const totalBorrowingPowerUsd = Number(borrowerAccount.totalBorrowingPowerUsd) / 1_000_000;
        const totalDebtUsd = Number(borrowerAccount.totalDebtUsd) / 1_000_000;
        
        console.log(`  Total Borrowing Power: $${totalBorrowingPowerUsd}`);
        console.log(`  Total Debt: $${totalDebtUsd}`);
        
        // List deposited NFTs
        if (borrowerAccount.depositedNfts.length > 0) {
            console.log('\n🖼️  Deposited NFTs:');
            borrowerAccount.depositedNfts.forEach((nft, index) => {
                console.log(`    ${index + 1}. ${nft.toString()}`);
            });
        } else {
            console.log('\n⚠️  No NFTs deposited - nothing to liquidate');
            return;
        }
        
        // Check active loans
        if (borrowerAccount.activeLoans.length > 0) {
            console.log('\n💰 Active Loans:');
            for (let i = 0; i < borrowerAccount.activeLoans.length; i++) {
                const loanPda = borrowerAccount.activeLoans[i];
                console.log(`    ${i + 1}. Loan PDA: ${loanPda.toString()}`);
                
                try {
                    const loanAccount = await program.account.loan.fetch(loanPda);
                    const principalUsd = Number(loanAccount.principalAmountUsd) / 1_000_000;
                    const interestPaidUsd = Number(loanAccount.interestPaidUsd) / 1_000_000;
                    const currentTimestamp = Math.floor(Date.now() / 1000);
                    const gracePeriodEnd = loanAccount.gracePeriodEndsTs.toNumber();
                    const isExpired = currentTimestamp > gracePeriodEnd;
                    
                    console.log(`       Principal: $${principalUsd}`);
                    console.log(`       Interest Rate: ${loanAccount.interestRateAtOriginationBps / 100}%`);
                    console.log(`       Interest Paid: $${interestPaidUsd}`);
                    console.log(`       Status: ${Object.keys(loanAccount.status)[0]}`);
                    console.log(`       Grace Period Ends: ${new Date(gracePeriodEnd * 1000).toISOString()}`);
                    console.log(`       Is Expired: ${isExpired ? '🚨 YES' : '✅ NO'}`);
                    
                    // Force liquidate if requested
                    if (process.argv.includes('--force')) {
                        console.log(`\n🔥 FORCE LIQUIDATING LOAN: ${loanPda.toString()}`);
                        await forceLiquidateLoan(program, connection, loanPda, loanAccount, borrowerAccount, liquidationKeypair);
                    }
                    
                } catch (loanError) {
                    console.log(`       ❌ Error fetching loan data: ${loanError.message}`);
                }
            }
        } else {
            console.log('\n✅ No active loans found');
            
            // If no loans but has NFTs, we can still burn the NFTs directly
            if (process.argv.includes('--force') && borrowerAccount.depositedNfts.length > 0) {
                console.log('\n🔥 No loans but NFTs are deposited. Burning NFTs directly...');
                await burnDepositedNfts(program, borrowerAccount, liquidationKeypair);
            }
        }
        
        if (!process.argv.includes('--force')) {
            console.log('\n💡 To force liquidate this wallet, run:');
            console.log(`   node scripts/force-liquidate-wallet.js ${targetWallet} --force`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function forceLiquidateLoan(program, connection, loanPda, loanAccount, borrowerAccount, liquidationKeypair) {
    try {
        if (borrowerAccount.depositedNfts.length === 0) {
            console.log('⚠️  No NFTs to liquidate');
            return;
        }
        
        // Get the first deposited NFT
        const nftMint = borrowerAccount.depositedNfts[0];
        console.log(`🔥 Liquidating NFT: ${nftMint.toString()}`);
        
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
        
        console.log('📍 PDAs:');
        console.log(`  Global Market: ${globalMarketPda.toString()}`);
        console.log(`  NFT Escrow: ${nftEscrowPda.toString()}`);
        
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
        const signature = await connection.sendRawTransaction(transaction.serialize());
        
        console.log('📡 Transaction sent:', signature);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
        }
        
        console.log('🔥 NFT BURNED - Liquidation completed!');
        console.log(`  Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        console.log(`  NFT Mint: ${nftMint.toString()}`);
        console.log(`  Loan: ${loanPda.toString()}`);
        
    } catch (error) {
        console.error('❌ Error liquidating loan:', error);
    }
}

async function burnDepositedNfts(program, borrowerAccount, liquidationKeypair) {
    console.log('🔥 Burning deposited NFTs without active loans...');
    
    // This would require a different approach since there's no loan to liquidate
    // You might need to withdraw the NFTs first or create a special admin function
    console.log('⚠️  This feature requires additional implementation');
    console.log('💡 Consider withdrawing NFTs first if no outstanding debt exists');
}

// Main execution
async function main() {
    const targetWallet = process.argv[2];
    
    if (!targetWallet) {
        console.log('❌ Please provide a wallet address');
        console.log('Usage: node scripts/force-liquidate-wallet.js <WALLET_ADDRESS> [--force]');
        console.log('');
        console.log('Examples:');
        console.log('  # Check wallet status');
        console.log('  node scripts/force-liquidate-wallet.js CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n');
        console.log('');
        console.log('  # Force liquidate');
        console.log('  node scripts/force-liquidate-wallet.js CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n --force');
        process.exit(1);
    }
    
    try {
        new PublicKey(targetWallet);
    } catch (error) {
        console.log('❌ Invalid wallet address provided');
        process.exit(1);
    }
    
    await forceLiquidateWallet(targetWallet);
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { forceLiquidateWallet };
