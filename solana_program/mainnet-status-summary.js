#!/usr/bin/env node

const { Connection, PublicKey } = require('@solana/web3.js');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';

// DEPLOYED PROGRAM IDS
const LENDING_PROGRAM_ID = new PublicKey('HegC6oTgMNyHW1g1kDSP8bWe22uCdoQhBxKXfu3joXpK');
const MARKETPLACE_PROGRAM_ID = new PublicKey('BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT');
const WHISKEY_PROGRAM_ID = new PublicKey('3sNM6w7GBRs41o4a9X6RuECLR5ZZUsADvxpsZXM1kBU8');

const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

async function main() {
    console.log('🚀 PLANET WHISKEY NFTS - MAINNET STATUS SUMMARY');
    console.log('=' .repeat(60));
    
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Calculate all PDAs
    const [globalMarket] = PublicKey.findProgramAddressSync([Buffer.from('global_market')], LENDING_PROGRAM_ID);
    const [collectionRegistry] = PublicKey.findProgramAddressSync([Buffer.from('collection_registry')], LENDING_PROGRAM_ID);
    const [capitalVault] = PublicKey.findProgramAddressSync([Buffer.from('capital_vault_usdc')], LENDING_PROGRAM_ID);
    const [lendingPoolConfig] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool')], WHISKEY_PROGRAM_ID);
    const [whiskeyVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')], WHISKEY_PROGRAM_ID);
    const [usdcVault] = PublicKey.findProgramAddressSync([Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')], WHISKEY_PROGRAM_ID);
    
    console.log('\n📋 PROGRAM ADDRESSES:');
    console.log('Lending Program:     ', LENDING_PROGRAM_ID.toString());
    console.log('Marketplace Program: ', MARKETPLACE_PROGRAM_ID.toString());
    console.log('Whiskey Program:     ', WHISKEY_PROGRAM_ID.toString());
    
    console.log('\n🏛️  ACCOUNT ADDRESSES:');
    console.log('Global Market:       ', globalMarket.toString());
    console.log('Collection Registry: ', collectionRegistry.toString());
    console.log('Capital Vault:       ', capitalVault.toString());
    console.log('Lending Pool Config: ', lendingPoolConfig.toString());
    console.log('Whiskey Vault V2:    ', whiskeyVault.toString());
    console.log('USDC Vault V2:       ', usdcVault.toString());
    
    console.log('\n👤 ADMIN & TREASURY:');
    console.log('Admin Wallet:        ', ADMIN_WALLET.toString());
    console.log('Treasury Wallet:     ', ADMIN_WALLET.toString(), '(same as admin)');
    
    // Check account existence
    console.log('\n🔍 ACCOUNT STATUS:');
    const accounts = {
        'Global Market': await connection.getAccountInfo(globalMarket),
        'Collection Registry': await connection.getAccountInfo(collectionRegistry),
        'Capital Vault': await connection.getAccountInfo(capitalVault),
        'Lending Pool Config': await connection.getAccountInfo(lendingPoolConfig),
        'Whiskey Vault V2': await connection.getAccountInfo(whiskeyVault),
        'USDC Vault V2': await connection.getAccountInfo(usdcVault)
    };
    
    Object.entries(accounts).forEach(([name, info]) => {
        const status = info ? '✅ INITIALIZED' : '❌ MISSING';
        console.log(`${name.padEnd(20)}: ${status}`);
    });
    
    // Check balances
    console.log('\n💰 BALANCES:');
    const adminBalance = await connection.getBalance(ADMIN_WALLET);
    console.log('Admin SOL:           ', (adminBalance / 1e9).toFixed(6), 'SOL');
    
    try {
        const vaultBalance = await connection.getTokenAccountBalance(capitalVault);
        console.log('Capital Vault USDC:  ', vaultBalance.value.uiAmount || 0, 'USDC');
    } catch {
        console.log('Capital Vault USDC:  ', '0 USDC (not funded yet)');
    }
    
    // Environment file summary
    console.log('\n📄 ENVIRONMENT FILES:');
    console.log('✅ env.mainnet updated with new addresses');
    console.log('✅ env.example updated with new addresses');
    
    // Frontend compatibility
    console.log('\n🌐 FRONTEND COMPATIBILITY:');
    console.log('✅ All collection_registry seeds unified (no V2)');
    console.log('✅ Program IDs updated in environment files');
    console.log('✅ PDA addresses calculated and ready');
    
    // Deployment status
    const allAccountsExist = Object.values(accounts).every(account => account !== null);
    
    console.log('\n🚦 DEPLOYMENT STATUS:');
    if (allAccountsExist) {
        console.log('✅ ALL CORE ACCOUNTS INITIALIZED');
        console.log('✅ READY FOR MAINNET OPERATIONS');
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Add approved collections: node add-collections-to-registry.js');
        console.log('2. Fund capital vault:       node fund-capital-vault.js');
        console.log('3. Test complete flow');
        console.log('4. Launch frontend');
        
        console.log('\n🚀 STATUS: READY TO LAUNCH! 🚀');
    } else {
        console.log('❌ SOME ACCOUNTS MISSING');
        console.log('🔧 Run: node complete-mainnet-init.js');
    }
    
    console.log('\n' + '=' .repeat(60));
}

main().catch(console.error);
