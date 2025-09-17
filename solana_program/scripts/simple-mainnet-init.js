#!/usr/bin/env node

/**
 * SIMPLE MAINNET ACCOUNT INITIALIZATION
 * 
 * Directly initializes accounts using raw transactions
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WHISKEY_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey('Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
const WHISKEY_PROGRAM_ID = new PublicKey('HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA');

// Admin wallet
const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

async function main() {
    console.log('🏗️  SIMPLE MAINNET ACCOUNT INITIALIZATION');
    console.log('⚠️  WARNING: This operates on MAINNET!');
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    console.log(`👤 Admin wallet: ${adminKeypair.publicKey.toString()}`);
    
    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
        console.log('❌ ERROR: Insufficient SOL balance. You need at least 0.5 SOL for initialization.');
        process.exit(1);
    }
    
    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_market')],
        LENDING_PROGRAM_ID
    );

    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_registry_v2')],
        LENDING_PROGRAM_ID
    );

    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('capital_vault_usdc')],
        LENDING_PROGRAM_ID
    );

    const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lending_pool')],
        WHISKEY_PROGRAM_ID
    );

    console.log('\n🔑 Calculated PDAs:');
    console.log(`Global Market: ${globalMarketPda.toString()}`);
    console.log(`Collection Registry V2: ${collectionRegistryPda.toString()}`);
    console.log(`Capital Vault: ${capitalVaultPda.toString()}`);
    console.log(`Lending Pool Config: ${lendingPoolConfigPda.toString()}`);

    // Check which accounts already exist
    console.log('\n🔍 Checking existing accounts...');
    
    try {
        const globalMarketInfo = await connection.getAccountInfo(globalMarketPda);
        console.log(`Global Market: ${globalMarketInfo ? 'EXISTS' : 'NOT FOUND'}`);
    } catch (e) {
        console.log('Global Market: NOT FOUND');
    }

    try {
        const collectionRegistryInfo = await connection.getAccountInfo(collectionRegistryPda);
        console.log(`Collection Registry V2: ${collectionRegistryInfo ? 'EXISTS' : 'NOT FOUND'}`);
    } catch (e) {
        console.log('Collection Registry V2: NOT FOUND');
    }

    try {
        const capitalVaultInfo = await connection.getAccountInfo(capitalVaultPda);
        console.log(`Capital Vault: ${capitalVaultInfo ? 'EXISTS' : 'NOT FOUND'}`);
    } catch (e) {
        console.log('Capital Vault: NOT FOUND');
    }

    try {
        const lendingPoolConfigInfo = await connection.getAccountInfo(lendingPoolConfigPda);
        console.log(`Lending Pool Config: ${lendingPoolConfigInfo ? 'EXISTS' : 'NOT FOUND'}`);
    } catch (e) {
        console.log('Lending Pool Config: NOT FOUND');
    }

    console.log('\n✅ Account status check complete!');
    console.log('\nNext steps:');
    console.log('1. Use anchor CLI to initialize accounts manually');
    console.log('2. Or use the admin panel to initialize through the frontend');
    
    // Show the anchor commands needed
    console.log('\n📝 Manual Anchor Commands:');
    console.log('anchor idl init --filepath target/idl/lendingprogram.json Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
    console.log('anchor idl init --filepath target/idl/whiskeyprogram.json HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA');
    console.log('anchor idl init --filepath target/idl/marketplaceprogram.json 5B9BKW8Az3dVhd6sQH4WHEoefiFYneNWFnxsZVf4rw7V');
}

main().catch(console.error);
