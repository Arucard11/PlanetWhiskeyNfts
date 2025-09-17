#!/usr/bin/env node

/**
 * MAINNET DEPLOYMENT SCRIPT
 * 
 * This script handles the complete deployment of all programs to Solana mainnet
 * and initializes all necessary accounts and configurations.
 * 
 * WARNING: This deploys to MAINNET with real SOL and tokens!
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
}

function execCommand(command, description) {
    log(`\n🔄 ${description}...`, colors.blue);
    try {
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        log(`✅ ${description} completed`, colors.green);
        return output;
    } catch (error) {
        log(`❌ ${description} failed: ${error.message}`, colors.red);
        throw error;
    }
}

async function main() {
    log('🚀 STARTING MAINNET DEPLOYMENT', colors.magenta);
    log('⚠️  WARNING: This will deploy to MAINNET with real SOL!', colors.yellow);
    
    // Confirmation prompt
    console.log('\nPress Ctrl+C to cancel, or press Enter to continue...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    await new Promise(resolve => {
        process.stdin.on('data', (key) => {
            if (key[0] === 3) { // Ctrl+C
                log('\n❌ Deployment cancelled by user', colors.red);
                process.exit(0);
            } else if (key[0] === 13) { // Enter
                process.stdin.setRawMode(false);
                process.stdin.pause();
                resolve();
            }
        });
    });

    log('\n📋 STEP 1: Environment Setup', colors.cyan);
    
    // Set Solana CLI to mainnet
    execCommand(
        'solana config set --url https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90',
        'Setting Solana CLI to mainnet'
    );
    
    // Verify configuration
    const config = execCommand('solana config get', 'Verifying Solana configuration');
    log(config, colors.white);

    log('\n💰 STEP 2: Wallet Setup', colors.cyan);
    
    // Check if mainnet keypair exists
    const keypairPath = path.join(process.env.HOME || '~', '.config/solana/mainnet-deploy-keypair.json');
    if (!fs.existsSync(keypairPath)) {
        log('Creating new mainnet deployment keypair...', colors.yellow);
        execCommand(
            `solana-keygen new --outfile ${keypairPath}`,
            'Creating mainnet deployment keypair'
        );
    }
    
    // Check wallet balance
    const balance = execCommand('solana balance', 'Checking wallet balance');
    log(`Wallet balance: ${balance}`, colors.white);
    
    if (parseFloat(balance) < 10) {
        log('⚠️  WARNING: Low SOL balance. You need at least 10 SOL for deployment.', colors.yellow);
        log('Please fund your wallet and run this script again.', colors.yellow);
        process.exit(1);
    }

    log('\n🔨 STEP 3: Building Programs', colors.cyan);
    
    // Build all programs
    execCommand('anchor build', 'Building all programs with Anchor');

    log('\n🚀 STEP 4: Deploying Programs', colors.cyan);
    
    // Deploy programs one by one
    const programs = [
        { name: 'whiskeyprogram', path: 'target/deploy/whiskeyprogram.so' },
        { name: 'marketplaceprogram', path: 'target/deploy/marketplaceprogram.so' },
        { name: 'lendingprogram', path: 'target/deploy/lendingprogram.so' }
    ];
    
    const deployedPrograms = {};
    
    for (const program of programs) {
        log(`\n📦 Deploying ${program.name}...`, colors.blue);
        
        const output = execCommand(
            `solana program deploy ${program.path}`,
            `Deploying ${program.name}`
        );
        
        // Extract program ID from output
        const match = output.match(/Program Id: ([A-Za-z0-9]{44})/);
        if (match) {
            deployedPrograms[program.name] = match[1];
            log(`✅ ${program.name} deployed with ID: ${match[1]}`, colors.green);
        } else {
            log(`⚠️  Could not extract program ID for ${program.name}`, colors.yellow);
        }
    }

    log('\n📝 STEP 5: Updating Configuration Files', colors.cyan);
    
    // Update Anchor.toml with new program IDs if they changed
    let anchorToml = fs.readFileSync('Anchor.toml', 'utf-8');
    for (const [programName, programId] of Object.entries(deployedPrograms)) {
        const regex = new RegExp(`(${programName} = )"[^"]*"`, 'g');
        anchorToml = anchorToml.replace(regex, `$1"${programId}"`);
    }
    fs.writeFileSync('Anchor.toml', anchorToml);
    log('✅ Updated Anchor.toml with new program IDs', colors.green);
    
    // Update mainnet environment file
    let envContent = fs.readFileSync('mainnet-environment.env', 'utf-8');
    if (deployedPrograms.whiskeyprogram) {
        envContent = envContent.replace(
            /NEXT_PUBLIC_WHISKEY_PROGRAM_ID=.*/,
            `NEXT_PUBLIC_WHISKEY_PROGRAM_ID=${deployedPrograms.whiskeyprogram}`
        );
    }
    if (deployedPrograms.marketplaceprogram) {
        envContent = envContent.replace(
            /NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=.*/,
            `NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=${deployedPrograms.marketplaceprogram}`
        );
    }
    if (deployedPrograms.lendingprogram) {
        envContent = envContent.replace(
            /NEXT_PUBLIC_LENDING_PROGRAM_ID=.*/,
            `NEXT_PUBLIC_LENDING_PROGRAM_ID=${deployedPrograms.lendingprogram}`
        );
    }
    fs.writeFileSync('mainnet-environment.env', envContent);
    log('✅ Updated mainnet-environment.env with new program IDs', colors.green);

    log('\n🏗️  STEP 6: Account Initialization', colors.cyan);
    
    log('⚠️  Manual steps required:', colors.yellow);
    log('1. Initialize Global Market for lending program', colors.white);
    log('2. Initialize Collection Registry', colors.white);
    log('3. Initialize Capital Vault', colors.white);
    log('4. Initialize Lending Pool Config', colors.white);
    log('5. Fund capital vault with initial liquidity', colors.white);
    log('6. Add approved NFT collections to registry', colors.white);
    
    log('\n📋 DEPLOYMENT SUMMARY', colors.cyan);
    log('='.repeat(50), colors.white);
    log('🌐 Network: Solana Mainnet', colors.white);
    log(`🔗 RPC: https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90`, colors.white);
    log('', colors.white);
    log('📦 Deployed Programs:', colors.white);
    for (const [name, id] of Object.entries(deployedPrograms)) {
        log(`   ${name}: ${id}`, colors.white);
    }
    log('', colors.white);
    log('🪙 Token Addresses:', colors.white);
    log('   USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', colors.white);
    log('   WHISKEY: 9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph', colors.white);
    log('', colors.white);
    log('👤 Admin Wallet: 2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk', colors.white);
    log('', colors.white);
    log('📁 Configuration files updated:', colors.white);
    log('   - Anchor.toml', colors.white);
    log('   - mainnet-environment.env', colors.white);
    log('', colors.white);
    log('🔄 Next Steps:', colors.yellow);
    log('1. Run account initialization scripts', colors.white);
    log('2. Fund accounts with initial liquidity', colors.white);
    log('3. Add NFT collections to registry', colors.white);
    log('4. Deploy frontend with mainnet configuration', colors.white);
    log('5. Start liquidation bot on separate server', colors.white);
    log('='.repeat(50), colors.white);
    
    log('\n🎉 MAINNET DEPLOYMENT COMPLETED!', colors.green);
    log('⚠️  Remember to securely store your keypairs!', colors.yellow);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    log(`❌ Unhandled error: ${error.message}`, colors.red);
    process.exit(1);
});

process.on('SIGINT', () => {
    log('\n❌ Deployment interrupted by user', colors.red);
    process.exit(0);
});

// Run the deployment
main().catch(error => {
    log(`❌ Deployment failed: ${error.message}`, colors.red);
    process.exit(1);
});
