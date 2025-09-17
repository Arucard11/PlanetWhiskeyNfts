#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m'
};

function log(message, color = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
}

// Configuration
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const PROGRAMS = [
    { name: 'whiskeyprogram', keypair: 'whiskeyprogram-keypair.json', id: null },
    { name: 'lendingprogram', keypair: 'lendingprogram-keypair.json', id: null },
    { name: 'marketplaceprogram', keypair: 'marketplaceprogram-keypair.json', id: null }
];

async function checkPrerequisites() {
    log('\n🔍 Checking Prerequisites...', colors.cyan);
    
    // Check if we're in the right directory
    const currentDir = process.cwd();
    if (!currentDir.includes('solana_program')) {
        log('❌ Please run this script from the solana_program directory', colors.red);
        process.exit(1);
    }
    
    // Check if admin keypair exists
    const adminKeypairPath = path.join(__dirname, '../mainnet-admin-keypair.json');
    if (!fs.existsSync(adminKeypairPath)) {
        log('❌ Admin keypair not found at: mainnet-admin-keypair.json', colors.red);
        process.exit(1);
    }
    
    // Check if all program keypairs exist
    for (const program of PROGRAMS) {
        const keypairPath = path.join(__dirname, `../${program.keypair}`);
        if (!fs.existsSync(keypairPath)) {
            log(`❌ Program keypair not found: ${program.keypair}`, colors.red);
            process.exit(1);
        }
        
        // Get the program ID from the keypair
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        program.id = keypair.publicKey.toString();
        log(`✅ ${program.name}: ${program.id}`, colors.green);
    }
    
    // Check Solana CLI
    try {
        execSync('solana --version', { stdio: 'ignore' });
        log('✅ Solana CLI is available', colors.green);
    } catch (error) {
        log('❌ Solana CLI not found. Please install it first.', colors.red);
        process.exit(1);
    }
    
    // Check Anchor CLI
    try {
        execSync('anchor --version', { stdio: 'ignore' });
        log('✅ Anchor CLI is available', colors.green);
    } catch (error) {
        log('❌ Anchor CLI not found. Please install it first.', colors.red);
        process.exit(1);
    }
    
    log('✅ All prerequisites met!', colors.green);
}

async function checkWalletBalance() {
    log('\n💰 Checking Admin Wallet Balance...', colors.cyan);
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const adminKeypairPath = path.join(__dirname, '../mainnet-admin-keypair.json');
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(adminKeypairPath, 'utf-8')))
    );
    
    const balance = await connection.getBalance(adminKeypair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    
    log(`Admin Wallet: ${adminKeypair.publicKey.toString()}`, colors.white);
    log(`Balance: ${balanceSOL.toFixed(4)} SOL`, colors.white);
    
    if (balanceSOL < 5) {
        log('⚠️  WARNING: Low balance! You need at least 5 SOL for deployment.', colors.yellow);
        log('Please fund your admin wallet before continuing.', colors.yellow);
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question('Continue anyway? (y/N): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            log('Deployment cancelled.', colors.yellow);
            process.exit(0);
        }
    } else {
        log('✅ Sufficient balance for deployment', colors.green);
    }
}

async function configureSolana() {
    log('\n⚙️  Configuring Solana CLI...', colors.cyan);
    
    try {
        // Set cluster to mainnet
        execSync(`solana config set --url ${RPC_URL}`, { stdio: 'inherit' });
        log('✅ Set RPC URL to mainnet', colors.green);
        
        // Set keypair
        const adminKeypairPath = path.join(__dirname, '../mainnet-admin-keypair.json');
        execSync(`solana config set --keypair ${adminKeypairPath}`, { stdio: 'inherit' });
        log('✅ Set admin keypair', colors.green);
        
        // Show current config
        log('\n📋 Current Solana Configuration:', colors.blue);
        execSync('solana config get', { stdio: 'inherit' });
        
    } catch (error) {
        log('❌ Failed to configure Solana CLI', colors.red);
        throw error;
    }
}

async function buildPrograms() {
    log('\n🔨 Building Programs...', colors.cyan);
    
    try {
        // Build all programs
        log('Building with mainnet feature flag...', colors.white);
        execSync('anchor build --program-name whiskeyprogram -- --features mainnet', { stdio: 'inherit' });
        execSync('anchor build --program-name lendingprogram -- --features mainnet', { stdio: 'inherit' });
        execSync('anchor build --program-name marketplaceprogram -- --features mainnet', { stdio: 'inherit' });
        
        log('✅ All programs built successfully', colors.green);
    } catch (error) {
        log('❌ Failed to build programs', colors.red);
        throw error;
    }
}

async function deployPrograms() {
    log('\n🚀 Deploying Programs to Mainnet...', colors.cyan);
    log('⚠️  WARNING: This will deploy to MAINNET!', colors.yellow);
    
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
        readline.question('Are you sure you want to continue? (yes/no): ', resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() !== 'yes') {
        log('Deployment cancelled.', colors.yellow);
        process.exit(0);
    }
    
    const deployedIds = {};
    
    for (const program of PROGRAMS) {
        log(`\n📦 Deploying ${program.name}...`, colors.blue);
        
        try {
            const programSoPath = path.join(__dirname, '..', 'target', 'deploy', `${program.name}.so`);
            const keypairPath = path.join(__dirname, `../${program.keypair}`);
            
            // Deploy the program
            const deployOutput = execSync(
                `solana program deploy ${programSoPath} --program-id ${keypairPath}`,
                { encoding: 'utf-8', stdio: 'pipe' }
            );
            
            log(`✅ ${program.name} deployed successfully`, colors.green);
            log(`Program ID: ${program.id}`, colors.white);
            deployedIds[program.name] = program.id;
            
        } catch (error) {
            log(`❌ Failed to deploy ${program.name}`, colors.red);
            console.error(error.message);
            throw error;
        }
    }
    
    log('\n🎉 All Programs Deployed Successfully!', colors.green);
    log('\n📋 Deployed Program IDs:', colors.blue);
    for (const [name, id] of Object.entries(deployedIds)) {
        log(`  ${name}: ${id}`, colors.white);
    }
    
    return deployedIds;
}

async function updateEnvironmentFiles(deployedIds) {
    log('\n📝 Updating Environment Files...', colors.cyan);
    
    try {
        // Update mainnet-environment.env
        const envPath = path.join(__dirname, '../mainnet-environment.env');
        let envContent = fs.readFileSync(envPath, 'utf-8');
        
        // Update program IDs
        envContent = envContent.replace(
            /NEXT_PUBLIC_WHISKEY_PROGRAM_ID=.*/,
            `NEXT_PUBLIC_WHISKEY_PROGRAM_ID=${deployedIds.whiskeyprogram}`
        );
        envContent = envContent.replace(
            /NEXT_PUBLIC_LENDING_PROGRAM_ID=.*/,
            `NEXT_PUBLIC_LENDING_PROGRAM_ID=${deployedIds.lendingprogram}`
        );
        envContent = envContent.replace(
            /NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=.*/,
            `NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=${deployedIds.marketplaceprogram}`
        );
        
        fs.writeFileSync(envPath, envContent);
        log('✅ Updated mainnet-environment.env', colors.green);
        
        // Update planet-whiskey-nfts/env.mainnet
        const frontendEnvPath = path.join(__dirname, '../../planet-whiskey-nfts/env.mainnet');
        if (fs.existsSync(frontendEnvPath)) {
            let frontendEnvContent = fs.readFileSync(frontendEnvPath, 'utf-8');
            
            frontendEnvContent = frontendEnvContent.replace(
                /NEXT_PUBLIC_WHISKEY_PROGRAM_ID=.*/,
                `NEXT_PUBLIC_WHISKEY_PROGRAM_ID=${deployedIds.whiskeyprogram}`
            );
            frontendEnvContent = frontendEnvContent.replace(
                /NEXT_PUBLIC_LENDING_PROGRAM_ID=.*/,
                `NEXT_PUBLIC_LENDING_PROGRAM_ID=${deployedIds.lendingprogram}`
            );
            frontendEnvContent = frontendEnvContent.replace(
                /NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=.*/,
                `NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=${deployedIds.marketplaceprogram}`
            );
            
            fs.writeFileSync(frontendEnvPath, frontendEnvContent);
            log('✅ Updated planet-whiskey-nfts/env.mainnet', colors.green);
        }
        
    } catch (error) {
        log('❌ Failed to update environment files', colors.red);
        console.error(error.message);
    }
}

async function initializeAccounts() {
    log('\n🏗️  Initializing Accounts...', colors.cyan);
    
    try {
        const initScript = path.join(__dirname, 'mainnet-initialize-accounts.js');
        execSync(`node ${initScript}`, { stdio: 'inherit' });
        log('✅ Accounts initialized successfully', colors.green);
    } catch (error) {
        log('❌ Failed to initialize accounts', colors.red);
        throw error;
    }
}

async function main() {
    try {
        log('🚀 MAINNET DEPLOYMENT SCRIPT', colors.bold + colors.cyan);
        log('================================', colors.cyan);
        
        await checkPrerequisites();
        await checkWalletBalance();
        await configureSolana();
        await buildPrograms();
        
        const deployedIds = await deployPrograms();
        await updateEnvironmentFiles(deployedIds);
        await initializeAccounts();
        
        log('\n🎉 MAINNET DEPLOYMENT COMPLETE!', colors.bold + colors.green);
        log('================================', colors.green);
        log('\n📋 Next Steps:', colors.blue);
        log('1. Copy the updated env.mainnet to your frontend .env.production', colors.white);
        log('2. Test all functionality on mainnet', colors.white);
        log('3. Fund the liquidation bot wallet with SOL', colors.white);
        log('4. Start the liquidation bot for automated loan management', colors.white);
        log('\n⚠️  IMPORTANT: Keep all keypair files secure and never commit them to git!', colors.yellow);
        
    } catch (error) {
        log('\n❌ DEPLOYMENT FAILED!', colors.bold + colors.red);
        console.error(error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = { main };
