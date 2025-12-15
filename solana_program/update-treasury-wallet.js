#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function updateTreasuryWallet() {
    try {
        console.log('🔄 Updating treasury wallet in global market PDA...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        if (!fs.existsSync(adminKeypairPath)) {
            throw new Error(`❌ Admin keypair not found at: ${adminKeypairPath}`);
        }
        
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        console.log(`🔑 Admin wallet: ${adminKeypair.publicKey.toString()}`);
        
        // Load lending program keypair
        const lendingKeypairPath = path.join(__dirname, 'lendingprogram-keypair.json');
        if (!fs.existsSync(lendingKeypairPath)) {
            throw new Error(`❌ Lending program keypair not found at: ${lendingKeypairPath}`);
        }
        
        const lendingSecretKey = JSON.parse(fs.readFileSync(lendingKeypairPath, 'utf8'));
        const lendingKeypair = Keypair.fromSecretKey(new Uint8Array(lendingSecretKey));
        console.log(`🔑 Lending program wallet: ${lendingKeypair.publicKey.toString()}`);
        
        // Connect to Solana
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Load IDL
        const idlPath = path.join(__dirname, '../planet-whiskey-nfts/src/lib/idl/lendingprogram.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Set up Anchor provider and program
        const wallet = new Wallet(adminKeypair);
        const provider = new AnchorProvider(connection, wallet, {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed'
        });
        
        const programId = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');
        const program = new Program(idl, programId, provider);
        
        // Global market PDA
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_market")],
            programId
        );
        
        console.log(`🏦 Global Market PDA: ${globalMarketPda.toString()}`);
        
        // Fetch current global market data
        const globalMarket = await program.account.globalMarket.fetch(globalMarketPda);
        console.log(`📊 Current treasury wallet: ${globalMarket.treasuryWallet.toString()}`);
        console.log(`📊 Current liquidation authority: ${globalMarket.liquidationAuthority.toString()}`);
        
        // New treasury wallet (the lending program keypair)
        const newTreasuryWallet = lendingKeypair.publicKey;
        console.log(`🔄 New treasury wallet: ${newTreasuryWallet.toString()}`);
        
        if (globalMarket.treasuryWallet.toString() === newTreasuryWallet.toString()) {
            console.log('✅ Treasury wallet is already set correctly!');
            return;
        }
        
        // Check if we have the update_admin_settings instruction
        console.log('🔍 Checking available instructions...');
        console.log('Available instructions:', Object.keys(program.instruction));
        
        // The update_admin_settings instruction doesn't include treasury wallet updates
        // We need to check if there's a specific instruction for this or if we need to redeploy
        
        console.log('⚠️  The update_admin_settings instruction does not include treasury wallet updates.');
        console.log('📋 Treasury wallet is set during initialize_global_market and cannot be changed via instruction.');
        console.log('🔄 To change the treasury wallet, you would need to:');
        console.log('   1. Close the current global market account');
        console.log('   2. Reinitialize with the new treasury wallet');
        console.log('   3. This would require migrating all existing data');
        
        console.log('💡 Alternative: The treasury wallet is used for receiving fees and profits.');
        console.log('   You could set up a transfer system from the current treasury to the new one.');
        
    } catch (error) {
        console.error(`❌ Error updating treasury wallet: ${error.message}`);
        process.exit(1);
    }
}

// Run the update script
updateTreasuryWallet();
