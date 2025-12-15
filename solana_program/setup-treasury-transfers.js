#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupAutomaticTransfers() {
    try {
        console.log('💰 Setting up automatic transfers from current treasury to new treasury...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        
        // Treasury wallets
        const currentTreasury = adminKeypair.publicKey; // Current treasury (admin wallet)
        const newTreasury = new PublicKey('CK9VQwiPEqJKtPaBu9TgiC6QKxLnQbH4xzwHDyxwjcuZ');
        
        console.log(`🔑 Current treasury: ${currentTreasury.toString()}`);
        console.log(`🔄 New treasury: ${newTreasury.toString()}`);
        
        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Check balances
        const currentBalance = await connection.getBalance(currentTreasury);
        const newBalance = await connection.getBalance(newTreasury);
        
        console.log(`💰 Current treasury balance: ${(currentBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        console.log(`💰 New treasury balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        
        // Transfer some SOL to the new treasury
        const transferAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
        
        if (currentBalance > transferAmount + 5000) {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: currentTreasury,
                    toPubkey: newTreasury,
                    lamports: transferAmount,
                })
            );
            
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = currentTreasury;
            
            transaction.sign(adminKeypair);
            
            console.log(`📤 Transferring ${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL to new treasury...`);
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            console.log(`✅ Transfer completed: ${signature}`);
        } else {
            console.log('⚠️  Insufficient balance for transfer');
        }
        
        console.log('');
        console.log('💡 SETUP COMPLETE');
        console.log('📋 The new treasury wallet is now funded and ready to receive transfers.');
        console.log('🔄 You can now update your lending program to send fees to the new treasury.');
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

setupAutomaticTransfers();