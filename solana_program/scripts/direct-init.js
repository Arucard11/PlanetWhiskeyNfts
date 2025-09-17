#!/usr/bin/env node

/**
 * DIRECT ACCOUNT INITIALIZATION
 * 
 * Uses anchor program interface to directly call initialization functions
 */

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
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
    log('🏗️  DIRECT ACCOUNT INITIALIZATION', colors.blue);
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
    
    if (balance < 0.5 * LAMPORTS_PER_SOL) {
        log('❌ ERROR: Insufficient SOL balance. You need at least 0.5 SOL.', colors.red);
        process.exit(1);
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

    log('\n🔑 Target PDAs:', colors.blue);
    log(`Global Market: ${globalMarketPda.toString()}`);
    log(`Collection Registry V2: ${collectionRegistryPda.toString()}`);
    log(`Capital Vault: ${capitalVaultPda.toString()}`);
    log(`Lending Pool Config: ${lendingPoolConfigPda.toString()}`);

    try {
        // Step 1: Initialize Collection Registry V2
        log('\n📋 STEP 1: Initialize Collection Registry V2', colors.yellow);
        try {
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
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('✅ Collection Registry V2 already exists', colors.green);
            } else {
                log(`❌ Failed to initialize Collection Registry V2: ${error.message}`, colors.red);
            }
        }

        // Step 2: Initialize Global Market
        log('\n🌍 STEP 2: Initialize Global Market', colors.yellow);
        try {
            const tx2 = await lendingProgram.methods
                .initializeGlobalMarket(
                    5000, // maxStakedNfts
                    new anchor.BN(100000000), // perNftValueUsd (100 USD in micro-dollars)
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
            log(`✅ Global Market initialized! TX: ${tx2}`, colors.green);
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('✅ Global Market already exists', colors.green);
            } else {
                log(`❌ Failed to initialize Global Market: ${error.message}`, colors.red);
            }
        }

        // Step 3: Initialize Capital Vault
        log('\n💰 STEP 3: Initialize Capital Vault', colors.yellow);
        try {
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
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('✅ Capital Vault already exists', colors.green);
            } else {
                log(`❌ Failed to initialize Capital Vault: ${error.message}`, colors.red);
            }
        }

        // Step 4: Initialize Lending Pool Config
        log('\n🏊 STEP 4: Initialize Lending Pool Config', colors.yellow);
        try {
            const [whiskeyVaultV2] = PublicKey.findProgramAddressSync(
                [Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')],
                WHISKEY_PROGRAM_ID
            );
            
            const [usdcVaultV2] = PublicKey.findProgramAddressSync(
                [Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')],
                WHISKEY_PROGRAM_ID
            );

            const tx4 = await whiskeyProgram.methods
                .initializeLendingPool()
                .accounts({
                    admin: adminKeypair.publicKey,
                    lendingPoolConfig: lendingPoolConfigPda,
                    whiskeyVault: whiskeyVaultV2,
                    usdcVault: usdcVaultV2,
                    whiskeyTokenMint: new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph'),
                    usdcMint: USDC_MINT,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([adminKeypair])
                .rpc();
            log(`✅ Lending Pool Config initialized! TX: ${tx4}`, colors.green);
        } catch (error) {
            if (error.message.includes('already in use')) {
                log('✅ Lending Pool Config already exists', colors.green);
            } else {
                log(`❌ Failed to initialize Lending Pool Config: ${error.message}`, colors.red);
            }
        }

        log('\n🎉 INITIALIZATION COMPLETE!', colors.green);
        log('✅ All core accounts have been processed!', colors.green);

    } catch (error) {
        log(`❌ Initialization failed: ${error.message}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

main().catch(error => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
});
