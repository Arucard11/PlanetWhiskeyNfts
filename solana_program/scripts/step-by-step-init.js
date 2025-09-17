#!/usr/bin/env node

/**
 * STEP-BY-STEP ACCOUNT INITIALIZATION
 * 
 * Initialize accounts one by one, handling dependencies properly
 */

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction, 
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const fs = require('fs');

// Constants
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey('Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
const WHISKEY_PROGRAM_ID = new PublicKey('HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA');

// Wallets
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

// Helper function to serialize u64 as little endian
function serializeU64(value) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value), 0);
    return buffer;
}

// Helper function to serialize u32 as little endian
function serializeU32(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value, 0);
    return buffer;
}

// Helper function to serialize PublicKey
function serializePubkey(pubkey) {
    return pubkey.toBuffer();
}

async function main() {
    log('🏗️  STEP-BY-STEP ACCOUNT INITIALIZATION', colors.blue);
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
    
    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_market')],
        LENDING_PROGRAM_ID
    );

    const [oldCollectionRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_registry')],
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
    log(`Old Collection Registry: ${oldCollectionRegistryPda.toString()}`);
    log(`Capital Vault: ${capitalVaultPda.toString()}`);
    log(`Lending Pool Config: ${lendingPoolConfigPda.toString()}`);

    try {
        // STEP 1: Initialize Lending Pool Config (independent)
        log('\n🏊 STEP 1: Initialize Lending Pool Config', colors.yellow);
        
        const lendingPoolInfo = await connection.getAccountInfo(lendingPoolConfigPda);
        if (!lendingPoolInfo) {
            // Instruction discriminator for initializeLendingPool
            const discriminator = Buffer.from([236, 76, 136, 68, 196, 14, 9, 177]);
            
            const [whiskeyVaultV2] = PublicKey.findProgramAddressSync(
                [Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')],
                WHISKEY_PROGRAM_ID
            );
            
            const [usdcVaultV2] = PublicKey.findProgramAddressSync(
                [Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')],
                WHISKEY_PROGRAM_ID
            );

            const WHISKEY_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');
            const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
            const RENT_SYSVAR = new PublicKey('SysvarRent111111111111111111111111111111111');

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: lendingPoolConfigPda, isSigner: false, isWritable: true },
                    { pubkey: whiskeyVaultV2, isSigner: false, isWritable: true },
                    { pubkey: usdcVaultV2, isSigner: false, isWritable: true },
                    { pubkey: WHISKEY_MINT, isSigner: false, isWritable: false },
                    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
                ],
                programId: WHISKEY_PROGRAM_ID,
                data: discriminator,
            });

            const transaction = new Transaction().add(instruction);
            const signature = await connection.sendTransaction(transaction, [adminKeypair], {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
            });
            
            await connection.confirmTransaction(signature, 'confirmed');
            log(`✅ Lending Pool Config initialized! TX: ${signature}`, colors.green);
        } else {
            log('✅ Lending Pool Config already exists', colors.green);
        }

        // STEP 2: Try Global Market with different approach
        log('\n🌍 STEP 2: Initialize Global Market (simplified)', colors.yellow);
        
        const globalMarketInfo = await connection.getAccountInfo(globalMarketPda);
        if (!globalMarketInfo) {
            log('🔧 Attempting Global Market initialization...', colors.cyan);
            
            // Try with minimal instruction data first
            const discriminator = Buffer.from([67, 173, 52, 201, 74, 169, 150, 163]);
            
            // Serialize arguments: maxStakedNfts (u32), perNftValueUsd (u64), liquidationAuthority (Pubkey)
            const maxStakedNfts = serializeU32(5000);
            const perNftValueUsd = serializeU64(100000000); // 100 USD in micro-dollars
            const liquidationAuthorityBytes = serializePubkey(LIQUIDATION_AUTHORITY);
            
            const instructionData = Buffer.concat([
                discriminator,
                maxStakedNfts,
                perNftValueUsd,
                liquidationAuthorityBytes
            ]);

            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: globalMarketPda, isSigner: false, isWritable: true },
                    { pubkey: oldCollectionRegistryPda, isSigner: false, isWritable: false }, // Try as read-only
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: capitalVaultPda, isSigner: false, isWritable: false },
                    { pubkey: TREASURY_WALLET, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: LENDING_PROGRAM_ID,
                data: instructionData,
            });

            const transaction = new Transaction().add(instruction);
            
            try {
                const signature = await connection.sendTransaction(transaction, [adminKeypair], {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });
                
                await connection.confirmTransaction(signature, 'confirmed');
                log(`✅ Global Market initialized! TX: ${signature}`, colors.green);
            } catch (error) {
                log(`❌ Global Market initialization failed: ${error.message}`, colors.red);
                log('📝 This might need to be done via frontend admin panel', colors.yellow);
                
                // Log the error details but don't exit
                if (error.logs) {
                    log('Transaction logs:', colors.yellow);
                    error.logs.forEach(logLine => console.log(`  ${logLine}`));
                }
            }
        } else {
            log('✅ Global Market already exists', colors.green);
        }

        // STEP 3: Try Capital Vault (depends on Global Market)
        log('\n💰 STEP 3: Initialize Capital Vault', colors.yellow);
        
        const capitalVaultInfo = await connection.getAccountInfo(capitalVaultPda);
        if (!capitalVaultInfo) {
            // Check if Global Market exists first
            const globalMarketInfoCheck = await connection.getAccountInfo(globalMarketPda);
            if (!globalMarketInfoCheck) {
                log('⚠️  Skipping Capital Vault - Global Market not initialized yet', colors.yellow);
            } else {
                // Instruction discriminator for initializeCapitalVault
                const discriminator = Buffer.from([168, 123, 174, 219, 245, 182, 124, 87]);
                
                const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
                const RENT_SYSVAR = new PublicKey('SysvarRent111111111111111111111111111111111');

                const instruction = new TransactionInstruction({
                    keys: [
                        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                        { pubkey: globalMarketPda, isSigner: false, isWritable: false },
                        { pubkey: capitalVaultPda, isSigner: false, isWritable: true },
                        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: RENT_SYSVAR, isSigner: false, isWritable: false },
                    ],
                    programId: LENDING_PROGRAM_ID,
                    data: discriminator,
                });

                const transaction = new Transaction().add(instruction);
                const signature = await connection.sendTransaction(transaction, [adminKeypair], {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });
                
                await connection.confirmTransaction(signature, 'confirmed');
                log(`✅ Capital Vault initialized! TX: ${signature}`, colors.green);
            }
        } else {
            log('✅ Capital Vault already exists', colors.green);
        }

        log('\n🎉 STEP-BY-STEP INITIALIZATION COMPLETE!', colors.green);
        log('✅ All possible accounts have been processed!', colors.green);

        // Final status check
        log('\n📊 Final Status Check:', colors.blue);
        const finalChecks = [
            { name: 'Global Market', pda: globalMarketPda },
            { name: 'Capital Vault', pda: capitalVaultPda },
            { name: 'Lending Pool Config', pda: lendingPoolConfigPda },
        ];

        for (const account of finalChecks) {
            try {
                const info = await connection.getAccountInfo(account.pda);
                log(`${account.name}: ${info ? '✅ EXISTS' : '❌ NOT FOUND'}`, 
                    info ? colors.green : colors.red);
            } catch (e) {
                log(`${account.name}: ❌ NOT FOUND`, colors.red);
            }
        }

    } catch (error) {
        log(`❌ Initialization failed: ${error.message}`, colors.red);
        console.error('Full error:', error);
        
        // If it's a transaction error, log more details
        if (error.logs) {
            log('Transaction logs:', colors.yellow);
            error.logs.forEach(logLine => console.log(`  ${logLine}`));
        }
        
        // Don't exit - continue with next steps
    }
}

main().catch(error => {
    log(`❌ Script failed: ${error.message}`, colors.red);
    console.error('Full error:', error);
    process.exit(1);
});
