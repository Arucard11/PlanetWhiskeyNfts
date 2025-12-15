#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createTreasuryUpdateInstruction() {
    try {
        console.log('🔧 Creating custom instruction to update treasury wallet...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        
        // Load lending program keypair
        const lendingKeypairPath = path.join(__dirname, 'lendingprogram-keypair.json');
        const lendingSecretKey = JSON.parse(fs.readFileSync(lendingKeypairPath, 'utf8'));
        const lendingKeypair = Keypair.fromSecretKey(new Uint8Array(lendingSecretKey));
        
        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Program and PDA addresses
        const programId = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_market")],
            programId
        );
        
        console.log(`🏦 Global Market PDA: ${globalMarketPda.toString()}`);
        console.log(`🔄 New treasury wallet: ${lendingKeypair.publicKey.toString()}`);
        
        // Since we can't update the treasury wallet via instruction, we have a few options:
        
        console.log('📋 Options to update treasury wallet:');
        console.log('');
        console.log('1. 🔄 REDEPLOY GLOBAL MARKET (Recommended)');
        console.log('   - Close current global market account');
        console.log('   - Reinitialize with correct treasury wallet');
        console.log('   - Migrate all existing loan data');
        console.log('');
        console.log('2. 💰 SET UP AUTOMATIC TRANSFERS');
        console.log('   - Keep current treasury wallet');
        console.log('   - Set up automatic transfers from admin wallet to lending program wallet');
        console.log('   - Modify the lending program to send fees to the new wallet');
        console.log('');
        console.log('3. 🔧 MODIFY LENDING PROGRAM');
        console.log('   - Update the lending program to use the new treasury wallet');
        console.log('   - Redeploy the lending program');
        console.log('');
        
        console.log('⚠️  IMPORTANT: The treasury wallet is hardcoded in the GlobalMarket struct');
        console.log('   and cannot be changed without redeploying the account.');
        console.log('');
        
        console.log('💡 RECOMMENDED APPROACH:');
        console.log('   Since you want to use the lending program wallet as treasury,');
        console.log('   the cleanest solution is to redeploy the global market with the correct treasury wallet.');
        console.log('');
        console.log('🔄 Would you like me to create a script to:');
        console.log('   - Close the current global market');
        console.log('   - Reinitialize with the lending program wallet as treasury?');
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
createTreasuryUpdateInstruction();
