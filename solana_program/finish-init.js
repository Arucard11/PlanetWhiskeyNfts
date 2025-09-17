#!/usr/bin/env node

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    SystemProgram, 
    Transaction,
    TransactionInstruction,
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';

// DEPLOYED PROGRAM IDS
const LENDING_PROGRAM_ID = new PublicKey('HegC6oTgMNyHW1g1kDSP8bWe22uCdoQhBxKXfu3joXpK');
const WHISKEY_PROGRAM_ID = new PublicKey('3sNM6w7GBRs41o4a9X6RuECLR5ZZUsADvxpsZXM1kBU8');

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WHISKEY_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');

// Instruction discriminators
const INIT_CAPITAL_VAULT = Buffer.from([168, 123, 174, 219, 245, 182, 124, 87]);
const INIT_LENDING_POOL = Buffer.from([236, 76, 136, 68, 196, 14, 9, 177]);

async function main() {
    console.log('🔧 FINISHING ACCOUNT INITIALIZATION');
    
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('mainnet-admin-keypair.json', 'utf8'))));
    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log('\n👤 Admin:', adminKeypair.publicKey.toString());
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log('💰 Balance:', balance / 1e9, 'SOL');
    
    // Calculate PDAs
    const [globalMarket] = PublicKey.findProgramAddressSync([Buffer.from('global_market')], LENDING_PROGRAM_ID);
    const [capitalVault] = PublicKey.findProgramAddressSync([Buffer.from('capital_vault_usdc')], LENDING_PROGRAM_ID);
    const [lendingPoolConfig] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool')], WHISKEY_PROGRAM_ID);
    const [whiskeyVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')], WHISKEY_PROGRAM_ID);
    const [usdcVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')], WHISKEY_PROGRAM_ID);
    
    // Check what exists
    const accounts = {
        globalMarket: await connection.getAccountInfo(globalMarket),
        capitalVault: await connection.getAccountInfo(capitalVault),
        lendingPool: await connection.getAccountInfo(lendingPoolConfig)
    };
    
    console.log('\n🔍 Current Status:');
    Object.entries(accounts).forEach(([name, info]) => {
        console.log(`${name}: ${info ? '✅ EXISTS' : '❌ MISSING'}`);
    });
    
    // Initialize Capital Vault
    if (!accounts.capitalVault) {
        console.log('\n🏗️  Initializing Capital Vault...');
        const initCapitalVaultIx = new TransactionInstruction({
            keys: [
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: globalMarket, isSigner: false, isWritable: false },
                { pubkey: capitalVault, isSigner: false, isWritable: true },
                { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
            ],
            programId: LENDING_PROGRAM_ID,
            data: INIT_CAPITAL_VAULT
        });
        
        let tx = new Transaction().add(initCapitalVaultIx);
        let sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        console.log('✅ Capital Vault initialized:', sig);
    }
    
    // Initialize Lending Pool
    if (!accounts.lendingPool) {
        console.log('\n🏗️  Initializing Lending Pool...');
        const initLendingPoolIx = new TransactionInstruction({
            keys: [
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: lendingPoolConfig, isSigner: false, isWritable: true },
                { pubkey: whiskeyVault, isSigner: false, isWritable: true },
                { pubkey: usdcVault, isSigner: false, isWritable: true },
                { pubkey: WHISKEY_MINT, isSigner: false, isWritable: false },
                { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false },
            ],
            programId: WHISKEY_PROGRAM_ID,
            data: INIT_LENDING_POOL
        });
        
        let tx = new Transaction().add(initLendingPoolIx);
        let sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        console.log('✅ Lending Pool initialized:', sig);
    }
    
    // Final status
    console.log('\n🎉 ALL ACCOUNTS INITIALIZED!');
    const finalBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log('💰 Final balance:', finalBalance / 1e9, 'SOL');
    
    console.log('\n📋 DEPLOYED PROGRAM IDs:');
    console.log('Lending Program:', LENDING_PROGRAM_ID.toString());
    console.log('Whiskey Program:', WHISKEY_PROGRAM_ID.toString());
    console.log('Marketplace Program: BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT');
    
    console.log('\n🚀 MAINNET READY!');
}

main().catch(console.error);
