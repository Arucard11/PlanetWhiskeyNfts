#!/usr/bin/env node

/**
 * ANCHOR-BASED ACCOUNT INITIALIZATION
 * 
 * Uses anchor CLI to directly call initialization functions
 */

const { execSync } = require('child_process');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const LENDING_PROGRAM_ID = 'Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3';
const WHISKEY_PROGRAM_ID = 'HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const ADMIN_WALLET = 'F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X';
const TREASURY_WALLET = 'F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X';
const LIQUIDATION_AUTHORITY = '8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL';

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

function runCommand(command, description) {
    log(`\n🔧 ${description}`, colors.blue);
    log(`Command: ${command}`, colors.cyan);
    
    try {
        const output = execSync(command, { 
            encoding: 'utf-8', 
            stdio: 'pipe',
            env: { ...process.env, ANCHOR_PROVIDER_URL: RPC_URL }
        });
        log(`✅ Success: ${description}`, colors.green);
        if (output.trim()) {
            log(`Output: ${output.trim()}`);
        }
        return true;
    } catch (error) {
        log(`❌ Failed: ${description}`, colors.red);
        log(`Error: ${error.message}`);
        if (error.stdout) {
            log(`Stdout: ${error.stdout}`);
        }
        if (error.stderr) {
            log(`Stderr: ${error.stderr}`);
        }
        return false;
    }
}

async function main() {
    log('🏗️  ANCHOR-BASED ACCOUNT INITIALIZATION', colors.blue);
    log('⚠️  WARNING: This operates on MAINNET!', colors.yellow);
    
    // Load admin keypair to verify
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    log(`👤 Admin wallet: ${adminKeypair.publicKey.toString()}`, colors.cyan);
    
    // Setup connection to check balances
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(adminKeypair.publicKey);
    log(`💰 Balance: ${balance / 1e9} SOL`, colors.cyan);
    
    if (balance < 0.5 * 1e9) {
        log('❌ ERROR: Insufficient SOL balance. You need at least 0.5 SOL.', colors.red);
        process.exit(1);
    }

    log('\n🚀 Starting account initialization with Anchor CLI...', colors.blue);

    // Step 1: Initialize Collection Registry V2
    log('\n📋 STEP 1: Initialize Collection Registry V2', colors.yellow);
    const cmd1 = `anchor run initialize-collection-registry-v2 --provider.cluster mainnet --provider.wallet ./mainnet-admin-keypair.json`;
    const success1 = runCommand(cmd1, 'Collection Registry V2 Initialization');

    // Step 2: Initialize Global Market
    log('\n🌍 STEP 2: Initialize Global Market', colors.yellow);
    const cmd2 = `anchor run initialize-global-market --provider.cluster mainnet --provider.wallet ./mainnet-admin-keypair.json -- --max-staked-nfts 5000 --per-nft-value-usd 100000000 --liquidation-authority ${LIQUIDATION_AUTHORITY} --capital-vault-usdc ${USDC_MINT} --treasury-wallet ${TREASURY_WALLET}`;
    const success2 = runCommand(cmd2, 'Global Market Initialization');

    // Step 3: Initialize Capital Vault
    log('\n💰 STEP 3: Initialize Capital Vault', colors.yellow);
    const cmd3 = `anchor run initialize-capital-vault --provider.cluster mainnet --provider.wallet ./mainnet-admin-keypair.json -- --usdc-mint ${USDC_MINT}`;
    const success3 = runCommand(cmd3, 'Capital Vault Initialization');

    // Step 4: Initialize Lending Pool Config
    log('\n🏊 STEP 4: Initialize Lending Pool Config', colors.yellow);
    const cmd4 = `anchor run initialize-lending-pool --provider.cluster mainnet --provider.wallet ./mainnet-admin-keypair.json`;
    const success4 = runCommand(cmd4, 'Lending Pool Config Initialization');

    // Summary
    log('\n📊 INITIALIZATION SUMMARY', colors.blue);
    log(`Collection Registry V2: ${success1 ? '✅ SUCCESS' : '❌ FAILED'}`);
    log(`Global Market: ${success2 ? '✅ SUCCESS' : '❌ FAILED'}`);
    log(`Capital Vault: ${success3 ? '✅ SUCCESS' : '❌ FAILED'}`);
    log(`Lending Pool Config: ${success4 ? '✅ SUCCESS' : '❌ FAILED'}`);

    const allSuccess = success1 && success2 && success3 && success4;
    
    if (allSuccess) {
        log('\n🎉 ALL ACCOUNTS INITIALIZED SUCCESSFULLY!', colors.green);
        log('✅ Your mainnet deployment is ready to use!', colors.green);
    } else {
        log('\n⚠️  Some accounts failed to initialize.', colors.yellow);
        log('💡 Try using the frontend admin panel as an alternative.', colors.cyan);
    }
}

main().catch(error => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    process.exit(1);
});
