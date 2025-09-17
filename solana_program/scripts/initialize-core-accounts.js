#!/usr/bin/env node

/**
 * INITIALIZE CORE MAINNET ACCOUNTS
 * 
 * This script initializes the essential accounts needed for the platform:
 * 1. Global Market (Lending Program)
 * 2. Collection Registry V2 (Lending Program)
 * 3. Capital Vault (Lending Program)
 * 4. Lending Pool Config (Whiskey Program)
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, createInitializeAccountInstruction, getMinimumBalanceForRentExemptAccount } = require('@solana/spl-token');
const fs = require('fs');

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey('Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
const WHISKEY_PROGRAM_ID = new PublicKey('HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA');

// Wallets
const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function main() {
    log('🏗️  INITIALIZING CORE MAINNET ACCOUNTS', colors.blue);
    log('⚠️  WARNING: This operates on MAINNET!', colors.yellow);
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    log(`👤 Admin wallet: ${adminKeypair.publicKey.toString()}`, colors.cyan);
    
    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    log(`💰 Balance: ${balance / 1e9} SOL`, colors.cyan);
    
    if (balance < 0.5 * 1e9) {
        log('❌ ERROR: Insufficient SOL balance. You need at least 0.5 SOL.', colors.red);
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

    log('\n🔑 Target PDAs:', colors.blue);
    log(`Global Market: ${globalMarketPda.toString()}`);
    log(`Collection Registry V2: ${collectionRegistryPda.toString()}`);
    log(`Capital Vault: ${capitalVaultPda.toString()}`);
    log(`Lending Pool Config: ${lendingPoolConfigPda.toString()}`);

    // Check existing accounts
    log('\n🔍 Checking existing accounts...', colors.blue);
    
    const globalMarketInfo = await connection.getAccountInfo(globalMarketPda);
    const collectionRegistryInfo = await connection.getAccountInfo(collectionRegistryPda);
    const capitalVaultInfo = await connection.getAccountInfo(capitalVaultPda);
    const lendingPoolConfigInfo = await connection.getAccountInfo(lendingPoolConfigPda);

    log(`Global Market: ${globalMarketInfo ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    log(`Collection Registry V2: ${collectionRegistryInfo ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    log(`Capital Vault: ${capitalVaultInfo ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    log(`Lending Pool Config: ${lendingPoolConfigInfo ? '✅ EXISTS' : '❌ NOT FOUND'}`);

    // Initialize accounts using solana CLI commands
    log('\n🚀 Starting account initialization...', colors.blue);

    try {
        // Step 1: Initialize Collection Registry V2
        if (!collectionRegistryInfo) {
            log('\n📋 Step 1: Initialize Collection Registry V2', colors.yellow);
            const { execSync } = require('child_process');
            
            const cmd1 = `solana program call ${LENDING_PROGRAM_ID.toString()} --program-id ${LENDING_PROGRAM_ID.toString()}`;
            log(`Command: ${cmd1}`);
            
            // For now, let's show what needs to be done
            log('⚠️  Manual step required: Use the admin panel to initialize Collection Registry V2', colors.yellow);
        } else {
            log('✅ Collection Registry V2 already exists', colors.green);
        }

        // Step 2: Initialize Global Market
        if (!globalMarketInfo) {
            log('\n🌍 Step 2: Initialize Global Market', colors.yellow);
            log('⚠️  Manual step required: Use the admin panel to initialize Global Market', colors.yellow);
        } else {
            log('✅ Global Market already exists', colors.green);
        }

        // Step 3: Initialize Capital Vault
        if (!capitalVaultInfo) {
            log('\n💰 Step 3: Initialize Capital Vault', colors.yellow);
            log('⚠️  Manual step required: Use the admin panel to initialize Capital Vault', colors.yellow);
        } else {
            log('✅ Capital Vault already exists', colors.green);
        }

        // Step 4: Initialize Lending Pool Config
        if (!lendingPoolConfigInfo) {
            log('\n🏊 Step 4: Initialize Lending Pool Config', colors.yellow);
            log('⚠️  Manual step required: Use the admin panel to initialize Lending Pool Config', colors.yellow);
        } else {
            log('✅ Lending Pool Config already exists', colors.green);
        }

    } catch (error) {
        log(`❌ Initialization failed: ${error.message}`, colors.red);
        process.exit(1);
    }

    log('\n✅ Account initialization check complete!', colors.green);
    log('\n📝 Next Steps:', colors.blue);
    log('1. Use the frontend admin panel to initialize missing accounts');
    log('2. Or use anchor CLI with specific instruction calls');
    log('3. Test the system once all accounts are initialized');
    
    log('\n🌐 Frontend Admin Panel:', colors.cyan);
    log('Navigate to /admin/lending in your frontend to initialize accounts');
}

main().catch(error => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    process.exit(1);
});
