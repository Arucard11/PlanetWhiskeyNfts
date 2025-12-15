#!/usr/bin/env node

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkGlobalMarket() {
    try {
        console.log('🔍 Checking current global market configuration...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        console.log(`🔑 Admin wallet: ${adminKeypair.publicKey.toString()}`);
        
        // Load lending program keypair
        const lendingKeypairPath = path.join(__dirname, 'lendingprogram-keypair.json');
        const lendingSecretKey = JSON.parse(fs.readFileSync(lendingKeypairPath, 'utf8'));
        const lendingKeypair = Keypair.fromSecretKey(new Uint8Array(lendingSecretKey));
        console.log(`🔑 Lending program wallet: ${lendingKeypair.publicKey.toString()}`);
        
        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Global market PDA
        const programId = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_market")],
            programId
        );
        
        console.log(`🏦 Global Market PDA: ${globalMarketPda.toString()}`);
        
        // Get account info
        const accountInfo = await connection.getAccountInfo(globalMarketPda);
        if (!accountInfo) {
            throw new Error('Global market account not found');
        }
        
        console.log(`📊 Account exists: ${accountInfo.owner.toString()}`);
        console.log(`📊 Account data length: ${accountInfo.data.length} bytes`);
        
        // The treasury wallet is at offset 40 (after owner + liquidation_authority + capital_vault_usdc)
        // Each Pubkey is 32 bytes
        const treasuryWalletBytes = accountInfo.data.slice(40, 72);
        const currentTreasuryWallet = new PublicKey(treasuryWalletBytes);
        
        console.log(`📊 Current treasury wallet: ${currentTreasuryWallet.toString()}`);
        console.log(`🔄 Desired treasury wallet: ${lendingKeypair.publicKey.toString()}`);
        
        if (currentTreasuryWallet.toString() === lendingKeypair.publicKey.toString()) {
            console.log('✅ Treasury wallet is already set correctly!');
        } else {
            console.log('⚠️  Treasury wallet needs to be updated.');
            console.log('📋 The treasury wallet is set during initialize_global_market and cannot be changed via instruction.');
            console.log('🔄 To change the treasury wallet, you would need to:');
            console.log('   1. Close the current global market account');
            console.log('   2. Reinitialize with the new treasury wallet');
            console.log('   3. This would require migrating all existing data');
            console.log('');
            console.log('💡 Alternative approaches:');
            console.log('   - Set up automatic transfers from current treasury to new treasury');
            console.log('   - Update the lending program to use the new treasury wallet');
            console.log('   - Redeploy the global market with the correct treasury wallet');
        }
        
    } catch (error) {
        console.error(`❌ Error checking global market: ${error.message}`);
        process.exit(1);
    }
}

// Run the check script
checkGlobalMarket();
