#!/usr/bin/env node

/**
 * MAINNET ACCOUNT INITIALIZATION SCRIPT
 * 
 * This script initializes all necessary accounts for the mainnet deployment:
 * - Global Market (Lending Program)
 * - Collection Registry V2 (Lending Program)  
 * - Capital Vault (Lending Program)
 * - Lending Pool Config (Whiskey Program)
 * - All required vaults and PDAs
 * 
 * WARNING: This operates on MAINNET with real SOL and tokens!
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '../mainnet-environment.env' });

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WHISKEY_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');

// Program IDs (NEW SECURE KEYPAIRS)
const LENDING_PROGRAM_ID = new PublicKey('Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
const WHISKEY_PROGRAM_ID = new PublicKey('HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA');
const MARKETPLACE_PROGRAM_ID = new PublicKey('5B9BKW8Az3dVhd6sQH4WHEoefiFYneNWFnxsZVf4rw7V');

// Admin wallet (NEW SECURE KEYPAIRS)
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
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
}

async function main() {
    log('🏗️  MAINNET ACCOUNT INITIALIZATION', colors.magenta);
    log('⚠️  WARNING: This operates on MAINNET!', colors.yellow);
    
    // Setup connection and wallet
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load admin keypair (make sure this exists)
    const keypairPath = path.join(__dirname, '../mainnet-admin-keypair.json');
    if (!fs.existsSync(keypairPath)) {
        log(`❌ Admin keypair not found at: ${keypairPath}`, colors.red);
        log('Please make sure mainnet-admin-keypair.json exists in the solana_program directory', colors.yellow);
        process.exit(1);
    }
    
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
    );
    
    log(`👤 Admin wallet: ${adminKeypair.publicKey.toString()}`, colors.white);
    
    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`, colors.white);
    
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
        log('❌ ERROR: Insufficient SOL balance. You need at least 0.5 SOL for initialization.', colors.red);
        process.exit(1);
    }
    
    if (balance < 2 * LAMPORTS_PER_SOL) {
        log('⚠️  WARNING: Low SOL balance. Consider adding more SOL if initialization fails.', colors.yellow);
    }

    // Setup Anchor provider
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Load IDLs
    const lendingIdl = JSON.parse(fs.readFileSync('./target/idl/lendingprogram.json', 'utf-8'));
    const whiskeyIdl = JSON.parse(fs.readFileSync('./target/idl/whiskeyprogram.json', 'utf-8'));

    const lendingProgram = new anchor.Program(lendingIdl, LENDING_PROGRAM_ID, provider);
    const whiskeyProgram = new anchor.Program(whiskeyIdl, WHISKEY_PROGRAM_ID, provider);

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

    const [whiskeyVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')],
        WHISKEY_PROGRAM_ID
    );

    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')],
        WHISKEY_PROGRAM_ID
    );

    log('\n📍 Calculated PDAs:', colors.cyan);
    log(`Global Market: ${globalMarketPda.toString()}`, colors.white);
    log(`Collection Registry: ${collectionRegistryPda.toString()}`, colors.white);
    log(`Capital Vault: ${capitalVaultPda.toString()}`, colors.white);
    log(`Lending Pool Config: ${lendingPoolConfigPda.toString()}`, colors.white);
    log(`WHISKEY Vault: ${whiskeyVaultPda.toString()}`, colors.white);
    log(`USDC Vault: ${usdcVaultPda.toString()}`, colors.white);

    try {
        log('\n🏗️  STEP 1: Initialize Collection Registry V2', colors.blue);
        try {
            await lendingProgram.methods
                .initializeCollectionRegistryV2()
                .accounts({
                    collectionRegistry: collectionRegistryPda,
                    authority: adminKeypair.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([adminKeypair])
                .rpc();
            log('✅ Collection Registry V2 initialized successfully', colors.green);
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('⚠️  Collection Registry V2 already exists', colors.yellow);
            } else {
                throw error;
            }
        }

        log('\n🏗️  STEP 2: Initialize Capital Vault', colors.blue);
        try {
            await lendingProgram.methods
                .initializeCapitalVault()
                .accounts({
                    admin: adminKeypair.publicKey,
                    globalMarket: globalMarketPda,
                    capitalVault: capitalVaultPda,
                    usdcMint: USDC_MINT,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([adminKeypair])
                .rpc();
            log('✅ Capital Vault initialized successfully', colors.green);
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('⚠️  Capital Vault already exists', colors.yellow);
            } else {
                throw error;
            }
        }

        log('\n🏗️  STEP 3: Initialize Global Market', colors.blue);
        try {
            await lendingProgram.methods
                .initializeGlobalMarket(
                    5000, // maxStakedNfts
                    1000000, // perNftValueUsd (1 USD in micro-USD)
                    LIQUIDATION_AUTHORITY
                )
                .accounts({
                    globalMarket: globalMarketPda,
                    collectionRegistry: collectionRegistryPda,
                    owner: adminKeypair.publicKey,
                    capitalVaultUsdc: capitalVaultPda,
                    treasuryWallet: TREASURY_WALLET,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([adminKeypair])
                .rpc();
            log('✅ Global Market initialized successfully', colors.green);
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('⚠️  Global Market already exists', colors.yellow);
            } else {
                throw error;
            }
        }

        log('\n🏗️  STEP 4: Initialize Lending Pool Config (Whiskey Program)', colors.blue);
        try {
            await whiskeyProgram.methods
                .initializeLendingPool()
                .accounts({
                    admin: adminKeypair.publicKey,
                    lendingPoolConfig: lendingPoolConfigPda,
                    whiskeyVault: whiskeyVaultPda,
                    usdcVault: usdcVaultPda,
                    whiskeyTokenMint: WHISKEY_MINT,
                    usdcMint: USDC_MINT,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([adminKeypair])
                .rpc();
            log('✅ Lending Pool Config initialized successfully', colors.green);
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('⚠️  Lending Pool Config already exists', colors.yellow);
            } else {
                throw error;
            }
        }

        log('\n📝 STEP 5: Update Environment File with PDAs', colors.blue);
        
        // Update mainnet environment file with calculated PDAs
        let envContent = fs.readFileSync('../mainnet-environment.env', 'utf-8');
        
        envContent = envContent.replace(
            /NEXT_PUBLIC_GLOBAL_MARKET_PDA=.*/,
            `NEXT_PUBLIC_GLOBAL_MARKET_PDA=${globalMarketPda.toString()}`
        );
        
        envContent = envContent.replace(
            /NEXT_PUBLIC_COLLECTION_REGISTRY_PDA=.*/,
            `NEXT_PUBLIC_COLLECTION_REGISTRY_PDA=${collectionRegistryPda.toString()}`
        );
        
        envContent = envContent.replace(
            /NEXT_PUBLIC_CAPITAL_VAULT_PDA=.*/,
            `NEXT_PUBLIC_CAPITAL_VAULT_PDA=${capitalVaultPda.toString()}`
        );
        
        envContent = envContent.replace(
            /NEXT_PUBLIC_LENDING_POOL_CONFIG_PDA=.*/,
            `NEXT_PUBLIC_LENDING_POOL_CONFIG_PDA=${lendingPoolConfigPda.toString()}`
        );
        
        fs.writeFileSync('../mainnet-environment.env', envContent);
        log('✅ Environment file updated with PDAs', colors.green);

        log('\n🎉 ACCOUNT INITIALIZATION COMPLETED!', colors.green);
        log('='.repeat(60), colors.white);
        log('📍 Initialized Accounts:', colors.cyan);
        log(`   Global Market: ${globalMarketPda.toString()}`, colors.white);
        log(`   Collection Registry: ${collectionRegistryPda.toString()}`, colors.white);
        log(`   Capital Vault: ${capitalVaultPda.toString()}`, colors.white);
        log(`   Lending Pool Config: ${lendingPoolConfigPda.toString()}`, colors.white);
        log(`   WHISKEY Vault: ${whiskeyVaultPda.toString()}`, colors.white);
        log(`   USDC Vault: ${usdcVaultPda.toString()}`, colors.white);
        log('', colors.white);
        log('🔄 Next Steps:', colors.yellow);
        log('1. Fund the capital vault with initial USDC liquidity', colors.white);
        log('2. Add approved NFT collections to the registry', colors.white);
        log('3. Deploy and configure the frontend', colors.white);
        log('4. Start the liquidation bot', colors.white);
        log('='.repeat(60), colors.white);

    } catch (error) {
        log(`❌ Initialization failed: ${error.message}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    log(`❌ Unhandled error: ${error.message}`, colors.red);
    process.exit(1);
});

process.on('SIGINT', () => {
    log('\n❌ Initialization interrupted by user', colors.red);
    process.exit(0);
});

// Run the initialization
main().catch(error => {
    log(`❌ Initialization failed: ${error.message}`, colors.red);
    process.exit(1);
});
