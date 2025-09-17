#!/usr/bin/env node

/**
 * QUICK INITIALIZATION - Just the essentials
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

async function main() {
    log('🚀 QUICK INITIALIZATION - Lending Pool Config Only', colors.blue);
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    log(`👤 Admin: ${adminKeypair.publicKey.toString()}`, colors.cyan);
    
    // Setup connection
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Calculate PDA
    const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('lending_pool')],
        WHISKEY_PROGRAM_ID
    );

    log(`🔑 Lending Pool Config: ${lendingPoolConfigPda.toString()}`, colors.blue);

    // Check if it exists
    const lendingPoolInfo = await connection.getAccountInfo(lendingPoolConfigPda);
    if (lendingPoolInfo) {
        log('✅ Lending Pool Config already exists!', colors.green);
        return;
    }

    try {
        log('🏊 Initializing Lending Pool Config...', colors.yellow);
        
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
        
    } catch (error) {
        log(`❌ Failed: ${error.message}`, colors.red);
        if (error.logs) {
            error.logs.forEach(logLine => console.log(`  ${logLine}`));
        }
    }
}

main().catch(console.error);
