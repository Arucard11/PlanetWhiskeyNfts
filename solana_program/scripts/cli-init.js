#!/usr/bin/env node

/**
 * CLI-BASED ACCOUNT INITIALIZATION
 * 
 * Uses solana CLI to call program instructions directly
 */

const { execSync } = require('child_process');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const LENDING_PROGRAM_ID = 'Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3';
const WHISKEY_PROGRAM_ID = 'HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA';

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
            stdio: 'pipe'
        });
        log(`✅ Success: ${description}`, colors.green);
        if (output.trim()) {
            log(`Output: ${output.trim()}`);
        }
        return true;
    } catch (error) {
        log(`❌ Failed: ${description}`, colors.red);
        if (error.stdout && error.stdout.trim()) {
            log(`Stdout: ${error.stdout.trim()}`);
        }
        if (error.stderr && error.stderr.trim()) {
            log(`Stderr: ${error.stderr.trim()}`);
        }
        return false;
    }
}

async function main() {
    log('🏗️  CLI-BASED ACCOUNT INITIALIZATION', colors.blue);
    log('⚠️  WARNING: This operates on MAINNET!', colors.yellow);
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    log(`👤 Admin wallet: ${adminKeypair.publicKey.toString()}`, colors.cyan);
    
    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(adminKeypair.publicKey);
    log(`💰 Balance: ${balance / 1e9} SOL`, colors.cyan);
    
    if (balance < 0.5 * 1e9) {
        log('❌ ERROR: Insufficient SOL balance. You need at least 0.5 SOL.', colors.red);
        process.exit(1);
    }

    // Calculate PDAs
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_registry_v2')],
        new PublicKey(LENDING_PROGRAM_ID)
    );

    log('\n🔑 Target PDA:', colors.blue);
    log(`Collection Registry V2: ${collectionRegistryPda.toString()}`);

    log('\n🚀 Attempting initialization with solana CLI...', colors.blue);

    // Try different approaches
    
    // Approach 1: Try to create the account directly
    log('\n📋 Approach 1: Direct account creation', colors.yellow);
    const createCmd = `solana create-account ${collectionRegistryPda.toString()} 1000 ${LENDING_PROGRAM_ID} --url ${RPC_URL} --keypair ./mainnet-admin-keypair.json`;
    runCommand(createCmd, 'Create Collection Registry Account');

    // Approach 2: Try to use solana program call
    log('\n📋 Approach 2: Program instruction call', colors.yellow);
    
    // Create instruction data for initializeCollectionRegistryV2
    // This is the discriminator for the instruction (first 8 bytes)
    const instructionData = Buffer.from([36, 5, 148, 143, 175, 68, 134, 223]); // initializeCollectionRegistryV2 discriminator
    const instructionDataHex = instructionData.toString('hex');
    
    const programCallCmd = `solana program call ${LENDING_PROGRAM_ID} --instruction-data ${instructionDataHex} --url ${RPC_URL} --keypair ./mainnet-admin-keypair.json`;
    runCommand(programCallCmd, 'Call initializeCollectionRegistryV2');

    // Approach 3: Try with account metas
    log('\n📋 Approach 3: Program call with account metas', colors.yellow);
    
    const programCallWithAccountsCmd = `solana program call ${LENDING_PROGRAM_ID} ` +
        `--instruction-data ${instructionDataHex} ` +
        `--account-meta ${collectionRegistryPda.toString()}:writable:false ` +
        `--account-meta ${adminKeypair.publicKey.toString()}:signer:true ` +
        `--account-meta 11111111111111111111111111111111:readable:false ` +
        `--url ${RPC_URL} --keypair ./mainnet-admin-keypair.json`;
    
    runCommand(programCallWithAccountsCmd, 'Call with account metas');

    log('\n✅ CLI initialization attempts complete!', colors.green);
    log('\n📝 If CLI methods don\'t work, we can:', colors.blue);
    log('1. Use the frontend admin panel');
    log('2. Build a custom transaction manually');
    log('3. Use anchor test framework');
}

main().catch(error => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
});
