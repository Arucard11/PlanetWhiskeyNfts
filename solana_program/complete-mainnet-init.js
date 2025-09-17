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
const MARKETPLACE_PROGRAM_ID = new PublicKey('BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT');
const WHISKEY_PROGRAM_ID = new PublicKey('3sNM6w7GBRs41o4a9X6RuECLR5ZZUsADvxpsZXM1kBU8');

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const WHISKEY_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');

// Instruction discriminators
const CREATE_V2_VAULTS = Buffer.from([144, 219, 251, 43, 217, 172, 18, 249]);

async function main() {
    console.log('🔧 COMPLETE MAINNET INITIALIZATION CHECK');
    
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('mainnet-admin-keypair.json', 'utf8'))));
    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log('\n👤 Admin:', adminKeypair.publicKey.toString());
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log('💰 Balance:', balance / 1e9, 'SOL');
    
    // Calculate all PDAs
    const [globalMarket] = PublicKey.findProgramAddressSync([Buffer.from('global_market')], LENDING_PROGRAM_ID);
    const [collectionRegistry] = PublicKey.findProgramAddressSync([Buffer.from('collection_registry')], LENDING_PROGRAM_ID);
    const [capitalVault] = PublicKey.findProgramAddressSync([Buffer.from('capital_vault_usdc')], LENDING_PROGRAM_ID);
    const [lendingPoolConfig] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool')], WHISKEY_PROGRAM_ID);
    const [whiskeyVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')], WHISKEY_PROGRAM_ID);
    const [usdcVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')], WHISKEY_PROGRAM_ID);
    
    // Check all accounts
    const accounts = {
        globalMarket: await connection.getAccountInfo(globalMarket),
        collectionRegistry: await connection.getAccountInfo(collectionRegistry),
        capitalVault: await connection.getAccountInfo(capitalVault),
        lendingPool: await connection.getAccountInfo(lendingPoolConfig),
        whiskeyVault: await connection.getAccountInfo(whiskeyVault),
        usdcVault: await connection.getAccountInfo(usdcVault)
    };
    
    console.log('\n🔍 Account Status:');
    Object.entries(accounts).forEach(([name, info]) => {
        console.log(`${name}: ${info ? '✅ EXISTS' : '❌ MISSING'}`);
    });
    
    console.log('\n📍 Account Addresses:');
    console.log('Global Market:', globalMarket.toString());
    console.log('Collection Registry:', collectionRegistry.toString());
    console.log('Capital Vault:', capitalVault.toString());
    console.log('Lending Pool Config:', lendingPoolConfig.toString());
    console.log('Whiskey Vault V2:', whiskeyVault.toString());
    console.log('USDC Vault V2:', usdcVault.toString());
    
    // Initialize missing V2 vaults if needed
    if (!accounts.whiskeyVault || !accounts.usdcVault) {
        console.log('\n🏗️  Creating V2 Vaults (for swaps)...');
        
        const createV2VaultsIx = new TransactionInstruction({
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
            data: CREATE_V2_VAULTS
        });
        
        let tx = new Transaction().add(createV2VaultsIx);
        let sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        console.log('✅ V2 Vaults created:', sig);
    }
    
    // Final status check
    const finalAccounts = {
        globalMarket: await connection.getAccountInfo(globalMarket),
        collectionRegistry: await connection.getAccountInfo(collectionRegistry),
        capitalVault: await connection.getAccountInfo(capitalVault),
        lendingPool: await connection.getAccountInfo(lendingPoolConfig),
        whiskeyVault: await connection.getAccountInfo(whiskeyVault),
        usdcVault: await connection.getAccountInfo(usdcVault)
    };
    
    console.log('\n✅ Final Status:');
    Object.entries(finalAccounts).forEach(([name, info]) => {
        console.log(`${name}: ${info ? '✅ EXISTS' : '❌ MISSING'}`);
    });
    
    const allExist = Object.values(finalAccounts).every(account => account !== null);
    
    if (allExist) {
        console.log('\n🎉 ALL ACCOUNTS INITIALIZED!');
        console.log('\n📋 READY FOR:');
        console.log('✅ NFT Minting with WHISKEY swaps');
        console.log('✅ NFT Marketplace trading');
        console.log('✅ NFT Lending & Borrowing');
        console.log('✅ Collection approvals for lending');
        
        console.log('\n📝 NEXT STEPS:');
        console.log('1. Add approved collections to the registry');
        console.log('2. Fund the capital vault with USDC for lending');
        console.log('3. Test the complete flow');
        
        console.log('\n🚀 MAINNET IS READY TO LAUNCH!');
    } else {
        console.log('\n❌ Some accounts are still missing. Check the errors above.');
    }
    
    const finalBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log('\n💰 Final balance:', finalBalance / 1e9, 'SOL');
}

main().catch(console.error);
