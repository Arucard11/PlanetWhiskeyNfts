#!/usr/bin/env node

// Test script for the liquidation bot
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLiquidationBot() {
    console.log('🧪 Testing Liquidation Bot...');
    
    // Load environment
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const lendingProgramId = process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID;
    
    if (!lendingProgramId || lendingProgramId === 'NOT_DEPLOYED_YET') {
        console.error('❌ NEXT_PUBLIC_LENDING_PROGRAM_ID not set or not deployed');
        process.exit(1);
    }
    
    const connection = new Connection(rpcUrl, 'confirmed');
    console.log('🌐 Connected to:', rpcUrl);
    console.log('🏦 Lending Program ID:', lendingProgramId);
    
    // Setup program
    const idlPath = path.join(__dirname, '../../planet-whiskey-nfts/src/lib/idl/lendingprogram.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    
    // We don't need a wallet for read-only operations
    const provider = new anchor.AnchorProvider(connection, null, {});
    const program = new anchor.Program(idl, provider);
    
    try {
        // Fetch all loans
        console.log('\n🔍 Scanning for active loans...');
        const loanAccounts = await program.account.loan.all();
        console.log(`📊 Found ${loanAccounts.length} total loans`);
        
        if (loanAccounts.length === 0) {
            console.log('⚠️  No loans found in the system');
            console.log('💡 To test the liquidation bot, you need to:');
            console.log('   1. Deposit an NFT as collateral');
            console.log('   2. Take out a loan');
            console.log('   3. Wait for the loan to expire (or manually set expiry)');
            return;
        }
        
        const currentTimestamp = Math.floor(Date.now() / 1000);
        let activeLoans = 0;
        let expiredLoans = 0;
        
        console.log('\n📋 Loan Status Report:');
        console.log('=' .repeat(80));
        
        for (let i = 0; i < loanAccounts.length; i++) {
            const loanAccount = loanAccounts[i];
            const loan = loanAccount.account;
            
            const startDate = new Date(loan.startTs.toNumber() * 1000);
            const gracePeriodEnd = new Date(loan.gracePeriodEndsTs.toNumber() * 1000);
            const isExpired = currentTimestamp > loan.gracePeriodEndsTs.toNumber();
            const timeRemaining = loan.gracePeriodEndsTs.toNumber() - currentTimestamp;
            
            console.log(`\n🏦 Loan #${i + 1}: ${loanAccount.publicKey.toString()}`);
            console.log(`   Borrower: ${loan.borrowerAccount.toString()}`);
            console.log(`   Principal: $${loan.principalAmountUsd.toNumber()}`);
            console.log(`   Duration: ${loan.durationSecs.toNumber()} seconds (${Math.floor(loan.durationSecs.toNumber() / 86400)} days)`);
            console.log(`   Started: ${startDate.toISOString()}`);
            console.log(`   Grace Period Ends: ${gracePeriodEnd.toISOString()}`);
            console.log(`   Status: ${Object.keys(loan.status)[0].toUpperCase()}`);
            
            if (isExpired && Object.keys(loan.status)[0] === 'active') {
                console.log(`   🚨 EXPIRED! Overdue by ${Math.floor(-timeRemaining / 3600)} hours`);
                console.log(`   💀 This loan is eligible for liquidation!`);
                expiredLoans++;
            } else if (Object.keys(loan.status)[0] === 'active') {
                console.log(`   ✅ Active - ${Math.floor(timeRemaining / 3600)} hours remaining`);
                activeLoans++;
            } else {
                console.log(`   ℹ️  Loan completed/repaid`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`📊 Summary:`);
        console.log(`   Active Loans: ${activeLoans}`);
        console.log(`   Expired Loans: ${expiredLoans}`);
        console.log(`   Total Loans: ${loanAccounts.length}`);
        
        if (expiredLoans > 0) {
            console.log(`\n🔥 ${expiredLoans} loan(s) are ready for liquidation!`);
            console.log(`🤖 You can now run the liquidation bot to burn NFTs and liquidate these loans.`);
            console.log(`\n💡 To run the liquidation bot:`);
            console.log(`   cd /home/arucard/WhiskeyPlanetNfts/solana_program`);
            console.log(`   source devnet-mainnet-ready.env`);
            console.log(`   npm run liquidation-bot`);
        } else if (activeLoans > 0) {
            console.log(`\n⏳ All loans are still active. Wait for them to expire to test liquidation.`);
            console.log(`💡 For testing purposes, you could modify the loan duration or grace period.`);
        } else {
            console.log(`\n💡 To test liquidation, create a new loan first!`);
        }
        
    } catch (error) {
        console.error('❌ Error scanning loans:', error);
    }
}

// Run the test
testLiquidationBot().catch(console.error);
