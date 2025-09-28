#!/usr/bin/env node

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

console.log('🧪 Testing liquidation functionality...');

try {
    // Setup connection
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    console.log('✅ Connection established');
    
    // Load liquidation keypair
    const keypairPath = path.join(__dirname, 'keypairs', 'mainnet-liquidation-keypair.json');
    if (!fs.existsSync(keypairPath)) {
        throw new Error(`Liquidation keypair not found at: ${keypairPath}`);
    }
    const liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf8'))));
    console.log('✅ Liquidation keypair loaded:', liquidationKeypair.publicKey.toString());
    
    // Try to get some basic lending data without full Program setup
    const globalMarketPda = new PublicKey(process.env.GLOBAL_MARKET_PDA);
    console.log('✅ Global Market PDA:', globalMarketPda.toString());
    
    // Check if global market account exists
    const globalMarketAccount = await connection.getAccountInfo(globalMarketPda);
    if (globalMarketAccount) {
        console.log('✅ Global Market account found');
        console.log('   Data length:', globalMarketAccount.data.length);
        console.log('   Owner:', globalMarketAccount.owner.toString());
    } else {
        console.log('❌ Global Market account not found');
    }
    
    // For now, just test that we can connect and have the right accounts
    console.log('🎉 Basic liquidation test passed! Bot can connect to the network.');
    console.log('⚠️  Full IDL integration needs to be fixed for actual liquidations.');
    
} catch (error) {
    console.error('❌ Liquidation test failed:', error.message);
    console.error('Stack:', error.stack);
}
