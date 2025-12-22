#!/usr/bin/env node

/**
 * INITIALIZE LENDING PROGRAM ACCOUNTS ONLY
 * 
 * Initializes:
 * 1. Collection Registry V2
 * 2. Global Market  
 * 3. Capital Vault
 * 
 * Skips Whiskey Program initialization (needs redeployment first)
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// NEW Program ID
const LENDING_PROGRAM_ID = new PublicKey('CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1');

// Wallets
const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

// Colors
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
    log('🏗️  INITIALIZING LENDING PROGRAM ACCOUNTS', colors.blue);
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
    log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`, colors.cyan);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
        log('❌ ERROR: Insufficient SOL balance. You need at least 0.01 SOL.', colors.red);
        process.exit(1);
    }
    
    // Setup Anchor provider
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Load IDL
    const lendingIdl = JSON.parse(fs.readFileSync('./target/idl/lendingprogram.json', 'utf-8'));
    const lendingProgram = new anchor.Program(lendingIdl, LENDING_PROGRAM_ID, provider);

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

    log('\n🔑 Target PDAs:', colors.blue);
    log(`Global Market: ${globalMarketPda.toString()}`);
    log(`Collection Registry V2: ${collectionRegistryPda.toString()}`);
    log(`Capital Vault: ${capitalVaultPda.toString()}`);

    try {
        // STEP 1: Initialize Collection Registry V2 (independent)
        log('\n📋 STEP 1: Initialize Collection Registry V2', colors.yellow);
        try {
            const collectionRegistryInfo = await connection.getAccountInfo(collectionRegistryPda);
            if (collectionRegistryInfo) {
                log('✅ Collection Registry V2 already exists', colors.green);
            } else {
                const tx1 = await lendingProgram.methods
                    .initializeCollectionRegistryV2()
                    .accounts({
                        collectionRegistry: collectionRegistryPda,
                        authority: adminKeypair.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([adminKeypair])
                    .rpc();
                log(`✅ Collection Registry V2 initialized! TX: ${tx1}`, colors.green);
            }
        } catch (error) {
            if (error.message.includes('already in use') || error.message.includes('already exists')) {
                log('✅ Collection Registry V2 already exists', colors.green);
            } else {
                log(`❌ Failed: ${error.message}`, colors.red);
                throw error;
            }
        }

        // STEP 2: Initialize Global Market (needs Collection Registry)
        log('\n🌍 STEP 2: Initialize Global Market', colors.yellow);
        try {
            const globalMarketInfo = await connection.getAccountInfo(globalMarketPda);
            if (globalMarketInfo) {
                log('✅ Global Market already exists', colors.green);
            } else {
                const tx2 = await lendingProgram.methods
                    .initializeGlobalMarket(
                        new anchor.BN(5000), // maxStakedNfts
                        new anchor.BN(100000000), // perNftValueUsd (100 USD in micro-dollars)
                        LIQUIDATION_AUTHORITY
                    )
                    .accounts({
                        globalMarket: globalMarketPda,
                        collectionRegistry: collectionRegistryPda,
                        owner: adminKeypair.publicKey,
                        capitalVaultUsdc: capitalVaultPda, // Just a reference, doesn't need to exist yet
                        treasuryWallet: TREASURY_WALLET,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([adminKeypair])
                    .rpc();
                log(`✅ Global Market initialized! TX: ${tx2}`, colors.green);
            }
        } catch (error) {
            if (error.message.includes('already in use') || error.message.includes('already exists')) {
                log('✅ Global Market already exists', colors.green);
            } else {
                log(`❌ Failed: ${error.message}`, colors.red);
                throw error;
            }
        }

        // STEP 3: Initialize Capital Vault (needs Global Market)
        log('\n💰 STEP 3: Initialize Capital Vault', colors.yellow);
        try {
            const capitalVaultInfo = await connection.getAccountInfo(capitalVaultPda);
            if (capitalVaultInfo) {
                log('✅ Capital Vault already exists', colors.green);
            } else {
                const tx3 = await lendingProgram.methods
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
                log(`✅ Capital Vault initialized! TX: ${tx3}`, colors.green);
            }
        } catch (error) {
            if (error.message.includes('already in use') || error.message.includes('already exists')) {
                log('✅ Capital Vault already exists', colors.green);
            } else {
                log(`❌ Failed: ${error.message}`, colors.red);
                throw error;
            }
        }

        log('\n✅ All Lending Program accounts initialized successfully!', colors.green);
        log('\n📝 Next Steps:', colors.blue);
        log('1. Update Whiskey Program with new LENDING_PROGRAM_ID and CAPITAL_VAULT_USDC');
        log('2. Redeploy Whiskey Program');
        log('3. Initialize Lending Pool Config in Whiskey Program');

    } catch (error) {
        log(`\n❌ Initialization failed: ${error.message}`, colors.red);
        if (error.logs) {
            log('\nTransaction logs:', colors.yellow);
            error.logs.forEach(log => console.log(`  ${log}`));
        }
        process.exit(1);
    }
}

main().catch(error => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    process.exit(1);
});













