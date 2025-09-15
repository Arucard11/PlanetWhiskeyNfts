#!/usr/bin/env node

// Simple test script for liquidation bot without complex dependencies
const { Connection, PublicKey } = require('@solana/web3.js');

async function testLiquidationSystem() {
    console.log('🧪 Testing Liquidation System...');
    
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
    
    try {
        // Get all program accounts for the lending program
        const programId = new PublicKey(lendingProgramId);
        console.log('\n🔍 Scanning for loan accounts...');
        
        const accounts = await connection.getProgramAccounts(programId);
        console.log(`📊 Found ${accounts.length} program accounts`);
        
        if (accounts.length === 0) {
            console.log('⚠️  No accounts found for the lending program');
            return;
        }
        
        // Filter for loan accounts (they have a specific discriminator)
        let loanAccounts = 0;
        let borrowerAccounts = 0;
        
        for (const account of accounts) {
            const data = account.account.data;
            
            // Check account discriminators to identify account types
            if (data.length >= 8) {
                // This is a simplified check - in reality, you'd parse the discriminator properly
                if (data.length > 100 && data.length < 200) {
                    // Likely a loan account based on size
                    loanAccounts++;
                } else if (data.length > 200) {
                    // Likely a borrower account based on size
                    borrowerAccounts++;
                }
            }
        }
        
        console.log(`📋 Account Summary:`);
        console.log(`   Estimated Loan Accounts: ${loanAccounts}`);
        console.log(`   Estimated Borrower Accounts: ${borrowerAccounts}`);
        console.log(`   Other Accounts: ${accounts.length - loanAccounts - borrowerAccounts}`);
        
        console.log('\n🤖 Liquidation Bot Status:');
        console.log('   ✅ RPC Connection: Working');
        console.log('   ✅ Program ID: Valid');
        console.log('   ✅ Accounts Found: Yes');
        
        if (loanAccounts > 0) {
            console.log('\n🔥 Liquidation bot can be tested!');
            console.log('💡 To run the liquidation bot:');
            console.log('   1. Make sure you have expired loans (loans past grace period)');
            console.log('   2. Run: npm install in solana_program directory');
            console.log('   3. Run: npx ts-node bots/liquidation-bot.ts');
            console.log('\n⚠️  Note: The bot will only liquidate loans that are:');
            console.log('   - Past their grace period');
            console.log('   - Still in "active" status');
            console.log('   - Have NFTs deposited as collateral');
        } else {
            console.log('\n💡 To test liquidation:');
            console.log('   1. Create a borrower account by depositing an NFT');
            console.log('   2. Take out a loan against the NFT');
            console.log('   3. Wait for the loan to expire (or modify grace period for testing)');
            console.log('   4. Run the liquidation bot');
        }
        
    } catch (error) {
        console.error('❌ Error testing liquidation system:', error);
    }
}

// Check liquidation keypair
function checkLiquidationKeypair() {
    const fs = require('fs');
    const path = require('path');
    
    const keypairPath = path.join(__dirname, 'liquidation-keypair.json');
    
    try {
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const liquidationAuthority = new PublicKey(keypairData.slice(32, 64));
        console.log('🔑 Liquidation Authority:', liquidationAuthority.toString());
        console.log('✅ Liquidation keypair is valid');
        return true;
    } catch (error) {
        console.error('❌ Error loading liquidation keypair:', error);
        return false;
    }
}

// Main function
async function main() {
    console.log('🚀 Liquidation Bot Test Suite');
    console.log('=' .repeat(50));
    
    // Check liquidation keypair
    if (!checkLiquidationKeypair()) {
        console.log('❌ Cannot proceed without valid liquidation keypair');
        return;
    }
    
    // Test the system
    await testLiquidationSystem();
}

main().catch(console.error);
