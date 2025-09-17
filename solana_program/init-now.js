#!/usr/bin/env node

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    SystemProgram, 
    Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL 
} = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const LENDING_PROGRAM_ID = new PublicKey('Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3');
const WHISKEY_PROGRAM_ID = new PublicKey('2q2mxyT6pQPwicbPQnUH2LNdJMmkY2T2oG2xQHBsvFTj');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WHISKEY_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

// Instruction discriminators from IDL
const INIT_GLOBAL_MARKET = Buffer.from([67, 173, 52, 201, 74, 169, 150, 163]);
const INIT_CAPITAL_VAULT = Buffer.from([168, 123, 174, 219, 245, 182, 124, 87]);
const INIT_LENDING_POOL = Buffer.from([236, 76, 136, 68, 196, 14, 9, 177]);

async function main() {
    console.log('🚀 QUICK MAINNET INITIALIZATION');
    
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('mainnet-admin-keypair.json', 'utf8'))));
    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log('👤 Admin:', adminKeypair.publicKey.toString());
    console.log('💰 Balance:', (await connection.getBalance(adminKeypair.publicKey)) / 1e9, 'SOL');
    
    // Calculate PDAs
    const [globalMarket] = PublicKey.findProgramAddressSync([Buffer.from('global_market')], LENDING_PROGRAM_ID);
    const [oldCollectionRegistry] = PublicKey.findProgramAddressSync([Buffer.from('collection_registry')], LENDING_PROGRAM_ID);
    const [capitalVault] = PublicKey.findProgramAddressSync([Buffer.from('capital_vault_usdc')], LENDING_PROGRAM_ID);
    const [lendingPoolConfig] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool')], WHISKEY_PROGRAM_ID);
    const [whiskeyVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')], WHISKEY_PROGRAM_ID);
    const [usdcVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')], WHISKEY_PROGRAM_ID);
    
    console.log('\n📍 PDAs:');
    console.log('Global Market:', globalMarket.toString());
    console.log('Old Collection Registry:', oldCollectionRegistry.toString());
    console.log('Capital Vault:', capitalVault.toString());
    console.log('Lending Pool Config:', lendingPoolConfig.toString());
    
    // 1. Initialize Global Market (this creates both global market AND old collection registry)
    if (!(await connection.getAccountInfo(globalMarket))) {
        console.log('\n🏗️  Initializing Global Market + Old Collection Registry...');
        
        const data = Buffer.alloc(8 + 4 + 8 + 32);
        let offset = 0;
        INIT_GLOBAL_MARKET.copy(data, offset); offset += 8;
        data.writeUInt32LE(10000, offset); offset += 4; // maxStakedNfts
        data.writeBigUInt64LE(BigInt(100000000), offset); offset += 8; // perNftValueUsd
        LIQUIDATION_AUTHORITY.toBuffer().copy(data, offset); // liquidationAuthority
        
        const ix = new TransactionInstruction({
            keys: [
                { pubkey: globalMarket, isSigner: false, isWritable: true },
                { pubkey: oldCollectionRegistry, isSigner: false, isWritable: true },
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: capitalVault, isSigner: false, isWritable: false },
                { pubkey: TREASURY_WALLET, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: LENDING_PROGRAM_ID,
            data: data
        });
        
        const tx = new Transaction().add(ix);
        const sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        console.log('✅ Global Market initialized:', sig);
    }
    
    // 2. Initialize Capital Vault
    if (!(await connection.getAccountInfo(capitalVault))) {
        console.log('\n🏗️  Initializing Capital Vault...');
        
        const ix = new TransactionInstruction({
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
        
        const tx = new Transaction().add(ix);
        const sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        console.log('✅ Capital Vault initialized:', sig);
    }
    
    // 3. Initialize Lending Pool
    if (!(await connection.getAccountInfo(lendingPoolConfig))) {
        console.log('\n🏗️  Initializing Lending Pool...');
        
        const ix = new TransactionInstruction({
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
        
        const tx = new Transaction().add(ix);
        const sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        console.log('✅ Lending Pool initialized:', sig);
    }
    
    console.log('\n🎉 DONE! All accounts initialized.');
    console.log('💰 Final balance:', (await connection.getBalance(adminKeypair.publicKey)) / 1e9, 'SOL');
}

main().catch(console.error);
