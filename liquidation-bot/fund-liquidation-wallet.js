#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function fundLiquidationWallet() {
    try {
        console.log('💰 Funding liquidation wallet...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, '../solana_program/mainnet-admin-keypair.json');
        if (!fs.existsSync(adminKeypairPath)) {
            throw new Error(`❌ Admin keypair not found at: ${adminKeypairPath}`);
        }
        
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        console.log(`🔑 Admin wallet: ${adminKeypair.publicKey.toString()}`);
        
        // Load liquidation keypair
        const liquidationKeypairPath = path.join(__dirname, 'keypairs/mainnet-liquidation-keypair.json');
        if (!fs.existsSync(liquidationKeypairPath)) {
            throw new Error(`❌ Liquidation keypair not found at: ${liquidationKeypairPath}`);
        }
        
        const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
        const liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));
        console.log(`🔑 Liquidation wallet: ${liquidationKeypair.publicKey.toString()}`);
        
        // Connect to Solana
        const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Check balances
        const adminBalance = await connection.getBalance(adminKeypair.publicKey);
        const liquidationBalance = await connection.getBalance(liquidationKeypair.publicKey);
        
        console.log(`💰 Admin balance: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        console.log(`💰 Liquidation balance: ${(liquidationBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        
        // Amount to transfer (0.02 SOL for liquidation operations - smaller amount)
        const transferAmount = 0.02 * LAMPORTS_PER_SOL;
        
        if (adminBalance < transferAmount + 5000) { // Keep some SOL for fees
            throw new Error(`❌ Insufficient admin balance. Need at least ${((transferAmount + 5000) / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        }
        
        // Create transfer transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: adminKeypair.publicKey,
                toPubkey: liquidationKeypair.publicKey,
                lamports: transferAmount,
            })
        );
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminKeypair.publicKey;
        
        // Sign and send transaction
        transaction.sign(adminKeypair);
        
        console.log(`📤 Sending ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL to liquidation wallet...`);
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            maxRetries: 3,
            preflightCommitment: 'confirmed'
        });
        
        console.log(`✅ Transfer transaction sent: ${signature}`);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) {
            throw new Error(`❌ Transaction failed: ${confirmation.value.err}`);
        }
        
        // Check new balances
        const newAdminBalance = await connection.getBalance(adminKeypair.publicKey);
        const newLiquidationBalance = await connection.getBalance(liquidationKeypair.publicKey);
        
        console.log(`✅ Transfer completed successfully!`);
        console.log(`💰 New admin balance: ${(newAdminBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        console.log(`💰 New liquidation balance: ${(newLiquidationBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        
    } catch (error) {
        console.error(`❌ Error funding liquidation wallet: ${error.message}`);
        process.exit(1);
    }
}

// Run the funding script
fundLiquidationWallet();
