#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateTreasuryWallet() {
    try {
        console.log('🔄 Updating treasury wallet in global market PDA...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        console.log(`🔑 Admin wallet: ${adminKeypair.publicKey.toString()}`);
        
        // Desired treasury wallet
        const desiredTreasuryWallet = new PublicKey('CK9VQwiPEqJKtPaBu9TgiC6QKxLnQbH4xzwHDyxwjcuZ');
        console.log(`🔄 Desired treasury wallet: ${desiredTreasuryWallet.toString()}`);
        
        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Program and PDA addresses
        const programId = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_market")],
            programId
        );
        
        console.log(`🏦 Global Market PDA: ${globalMarketPda.toString()}`);
        
        // Get current account data
        const accountInfo = await connection.getAccountInfo(globalMarketPda);
        if (!accountInfo) {
            throw new Error('Global market account not found');
        }
        
        // The treasury wallet is at offset 40 (after owner + liquidation_authority + capital_vault_usdc)
        const treasuryWalletBytes = accountInfo.data.slice(40, 72);
        const currentTreasuryWallet = new PublicKey(treasuryWalletBytes);
        
        console.log(`📊 Current treasury wallet: ${currentTreasuryWallet.toString()}`);
        
        if (currentTreasuryWallet.toString() === desiredTreasuryWallet.toString()) {
            console.log('✅ Treasury wallet is already set correctly!');
            return;
        }
        
        console.log('⚠️  Treasury wallet needs to be updated.');
        console.log('');
        console.log('📋 SOLUTION: Create a custom instruction to update the treasury wallet');
        console.log('');
        
        // Create a custom instruction to update the treasury wallet
        // We'll need to modify the account data directly
        const newAccountData = Buffer.from(accountInfo.data);
        
        // Replace the treasury wallet bytes (offset 40-72)
        const newTreasuryBytes = desiredTreasuryWallet.toBuffer();
        newTreasuryBytes.copy(newAccountData, 40);
        
        console.log('🔧 Creating instruction to update treasury wallet...');
        
        // Create a transaction that updates the account data
        const transaction = new Transaction();
        
        // We need to create a custom instruction since there's no built-in way to update treasury wallet
        // The safest approach is to close and recreate the global market account
        
        console.log('⚠️  WARNING: Updating treasury wallet requires closing and recreating the global market account.');
        console.log('   This will affect all existing loans and borrower accounts.');
        console.log('');
        console.log('🔄 RECOMMENDED APPROACH:');
        console.log('   1. Create a migration script to backup all loan data');
        console.log('   2. Close the current global market account');
        console.log('   3. Reinitialize with the correct treasury wallet');
        console.log('   4. Restore all loan data');
        console.log('');
        
        console.log('💡 ALTERNATIVE: Set up automatic transfers');
        console.log('   - Keep current treasury wallet');
        console.log('   - Set up automatic transfers from current treasury to new treasury');
        console.log('   - This is safer and doesn\'t require closing accounts');
        console.log('');
        
        console.log('🤔 Which approach would you prefer?');
        console.log('   1. Close and recreate global market (clean but risky)');
        console.log('   2. Set up automatic transfers (safer)');
        console.log('   3. Create a custom instruction (complex)');
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
updateTreasuryWallet();
