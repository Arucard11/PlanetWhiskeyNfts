#!/usr/bin/env node

/**
 * FINAL INITIALIZATION ATTEMPT
 * 
 * Try to initialize the remaining accounts with error handling
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
const LENDING_PROGRAM_ID = new PublicKey('Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
const WHISKEY_PROGRAM_ID = new PublicKey('HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA');

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

async function tryInitLendingPool(connection, adminKeypair) {
    const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lending_pool')],
        WHISKEY_PROGRAM_ID
    );

    // Check if it exists
    const exists = await connection.getAccountInfo(lendingPoolConfigPda);
    if (exists) {
        log('✅ Lending Pool Config already exists', colors.green);
        return true;
    }

    try {
        log('🏊 Attempting Lending Pool Config initialization...', colors.yellow);
        
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
        return true;
        
    } catch (error) {
        log(`❌ Lending Pool Config failed: ${error.message}`, colors.red);
        return false;
    }
}

async function main() {
    log('🎯 FINAL INITIALIZATION ATTEMPT', colors.blue);
    log('⚠️  WARNING: This operates on MAINNET!', colors.yellow);
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    log(`👤 Admin: ${adminKeypair.publicKey.toString()}`, colors.cyan);
    
    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`, colors.cyan);
    
    let success = 0;
    let total = 1;

    // Try Lending Pool Config
    if (await tryInitLendingPool(connection, adminKeypair)) {
        success++;
    }

    log(`\n📊 FINAL RESULTS: ${success}/${total} accounts initialized`, colors.blue);
    
    // Show final status
    log('\n🔍 Final Status Check:', colors.blue);
    
    const [globalMarketPda] = PublicKey.findProgramAddressSync([Buffer.from('global_market')], LENDING_PROGRAM_ID);
    const [capitalVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('capital_vault_usdc')], LENDING_PROGRAM_ID);
    const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool')], WHISKEY_PROGRAM_ID);
    const [collectionRegistryV2Pda] = PublicKey.findProgramAddressSync([Buffer.from('collection_registry_v2')], LENDING_PROGRAM_ID);

    const accounts = [
        { name: 'Global Market', pda: globalMarketPda },
        { name: 'Collection Registry V2', pda: collectionRegistryV2Pda },
        { name: 'Capital Vault', pda: capitalVaultPda },
        { name: 'Lending Pool Config', pda: lendingPoolConfigPda },
    ];

    for (const account of accounts) {
        try {
            const info = await connection.getAccountInfo(account.pda);
            log(`${account.name}: ${info ? '✅ EXISTS' : '❌ NOT FOUND'}`, 
                info ? colors.green : colors.red);
        } catch (e) {
            log(`${account.name}: ❌ NOT FOUND`, colors.red);
        }
    }

    log('\n📝 Next Steps:', colors.yellow);
    log('1. Use the frontend admin panel at /admin/lending to initialize Global Market');
    log('2. Once Global Market exists, Capital Vault can be initialized');
    log('3. The system should be functional with the accounts we have');
}

main().catch(console.error);
