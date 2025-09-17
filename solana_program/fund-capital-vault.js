#!/usr/bin/env node

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction,
} = require('@solana/web3.js');
const { 
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createTransferInstruction,
} = require('@solana/spl-token');
const fs = require('fs');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';

// DEPLOYED PROGRAM IDS
const LENDING_PROGRAM_ID = new PublicKey('HegC6oTgMNyHW1g1kDSP8bWe22uCdoQhBxKXfu3joXpK');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Amount to fund (in USDC, with 6 decimals)
const FUNDING_AMOUNT_USDC = 1000; // $1000 USDC
const FUNDING_AMOUNT_LAMPORTS = FUNDING_AMOUNT_USDC * 1_000_000; // Convert to lamports (6 decimals)

async function main() {
    console.log('💰 FUNDING CAPITAL VAULT WITH USDC');
    
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('mainnet-admin-keypair.json', 'utf8'))));
    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log('\n👤 Admin:', adminKeypair.publicKey.toString());
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log('💰 SOL Balance:', balance / 1e9, 'SOL');
    
    // Calculate capital vault PDA
    const [capitalVault] = PublicKey.findProgramAddressSync([Buffer.from('capital_vault_usdc')], LENDING_PROGRAM_ID);
    console.log('📍 Capital Vault:', capitalVault.toString());
    
    // Get admin's USDC token account
    const adminUsdcAccount = await getAssociatedTokenAddress(USDC_MINT, adminKeypair.publicKey);
    console.log('📍 Admin USDC Account:', adminUsdcAccount.toString());
    
    try {
        // Check admin's USDC balance
        const adminUsdcBalance = await connection.getTokenAccountBalance(adminUsdcAccount);
        console.log('💰 Admin USDC Balance:', adminUsdcBalance.value.uiAmount, 'USDC');
        
        if (!adminUsdcBalance.value.uiAmount || adminUsdcBalance.value.uiAmount < FUNDING_AMOUNT_USDC) {
            console.log('❌ Insufficient USDC balance');
            console.log(`   Required: ${FUNDING_AMOUNT_USDC} USDC`);
            console.log(`   Available: ${adminUsdcBalance.value.uiAmount || 0} USDC`);
            console.log('\n📝 Please fund your admin wallet with USDC first');
            return;
        }
        
        // Check current capital vault balance
        try {
            const vaultBalance = await connection.getTokenAccountBalance(capitalVault);
            console.log('📊 Current Vault Balance:', vaultBalance.value.uiAmount, 'USDC');
        } catch (error) {
            console.log('📊 Current Vault Balance: 0 USDC (new vault)');
        }
        
        console.log(`\n💸 Transferring ${FUNDING_AMOUNT_USDC} USDC to Capital Vault...`);
        
        // Create transfer instruction
        const transferIx = createTransferInstruction(
            adminUsdcAccount,     // source
            capitalVault,         // destination
            adminKeypair.publicKey, // owner
            FUNDING_AMOUNT_LAMPORTS // amount in lamports
        );
        
        const tx = new Transaction().add(transferIx);
        const sig = await connection.sendTransaction(tx, [adminKeypair]);
        await connection.confirmTransaction(sig);
        
        console.log('✅ Transfer completed:', sig);
        
        // Check new vault balance
        const newVaultBalance = await connection.getTokenAccountBalance(capitalVault);
        console.log('📊 New Vault Balance:', newVaultBalance.value.uiAmount, 'USDC');
        
        console.log('\n🎉 Capital Vault Funded Successfully!');
        console.log('✅ Lending protocol is now ready to provide loans');
        
    } catch (error) {
        console.error('❌ Error funding vault:', error.message);
        
        if (error.message.includes('could not find account')) {
            console.log('\n📝 TIP: Make sure you have USDC in your admin wallet');
            console.log('📝 You can get USDC from exchanges like Coinbase, Binance, etc.');
        }
    }
    
    const finalBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log('\n💰 Final SOL balance:', finalBalance / 1e9, 'SOL');
}

if (require.main === module) {
    main().catch(console.error);
}
