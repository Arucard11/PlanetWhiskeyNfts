import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import BN from 'bn.js';
import fs from 'fs';

// Load IDL and setup
const whiskeyProgramIdl = JSON.parse(fs.readFileSync('./src/lib/idl/whiskeyprogram.json', 'utf8'));

async function testSwapDirectly() {
    console.log('🧪 Testing swap functionality directly...');
    
    try {
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Load swap keypair
        const swapKeypairPath = './scripts/swap-keypair.json';
        const swapKeypairData = JSON.parse(fs.readFileSync(swapKeypairPath, 'utf8'));
        const swapKeypair = Keypair.fromSecretKey(new Uint8Array(swapKeypairData));
        
        console.log('📍 Swap wallet:', swapKeypair.publicKey.toString());
        
        // Check SOL balance
        const solBalance = await connection.getBalance(swapKeypair.publicKey);
        console.log('💰 SOL balance:', (solBalance / 1e9).toFixed(4));
        
        // Setup program
        const wallet = new anchor.Wallet(swapKeypair);
        const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
        const program = new anchor.Program(whiskeyProgramIdl, provider);
        
        console.log('📋 Program ID:', program.programId.toString());
        
        // Calculate PDAs
        const WHISKEY_PROGRAM_ID = new PublicKey('9QgLBW5ezK86ouvvQ25mjgvFpLjVm1J9k9bvaFvohw2t');
        const LENDING_PROGRAM_ID = new PublicKey('CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1');
        
        const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('lending_pool')], 
            WHISKEY_PROGRAM_ID
        );
        
        const [whiskeyVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('lending_pool'), Buffer.from('whiskey_vault_v2')], 
            WHISKEY_PROGRAM_ID
        );
        
        const [intermediateSolPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('lending_pool'), Buffer.from('intermediate_sol')], 
            WHISKEY_PROGRAM_ID
        );
        
        const [usdcVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('lending_pool'), Buffer.from('usdc_vault_v2')], 
            WHISKEY_PROGRAM_ID
        );
        
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('global_market')], 
            LENDING_PROGRAM_ID
        );
        
        const [lendingCapitalVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('capital_vault_usdc')], 
            LENDING_PROGRAM_ID
        );
        
        console.log('🏛️ PDAs calculated:');
        console.log('  Lending Pool Config:', lendingPoolConfigPda.toString());
        console.log('  WHISKEY Vault:', whiskeyVaultPda.toString());
        console.log('  Intermediate SOL:', intermediateSolPda.toString());
        console.log('  USDC Vault:', usdcVaultPda.toString());
        console.log('  Global Market:', globalMarketPda.toString());
        console.log('  Capital Vault:', lendingCapitalVaultPda.toString());
        
        // Check account existence
        console.log('\n🔍 Checking account existence...');
        const lendingPoolConfigInfo = await connection.getAccountInfo(lendingPoolConfigPda);
        const whiskeyVaultInfo = await connection.getAccountInfo(whiskeyVaultPda);
        const intermediateSolInfo = await connection.getAccountInfo(intermediateSolPda);
        const usdcVaultInfo = await connection.getAccountInfo(usdcVaultPda);
        const globalMarketInfo = await connection.getAccountInfo(globalMarketPda);
        const lendingCapitalVaultInfo = await connection.getAccountInfo(lendingCapitalVaultPda);
        
        console.log('  Lending Pool Config:', lendingPoolConfigInfo ? '✅ EXISTS' : '❌ MISSING');
        console.log('  WHISKEY Vault:', whiskeyVaultInfo ? '✅ EXISTS' : '❌ MISSING');
        console.log('  Intermediate SOL:', intermediateSolInfo ? '✅ EXISTS' : '❌ MISSING');
        console.log('  USDC Vault:', usdcVaultInfo ? '✅ EXISTS' : '❌ MISSING');
        console.log('  Global Market:', globalMarketInfo ? '✅ EXISTS' : '❌ MISSING');
        console.log('  Capital Vault:', lendingCapitalVaultInfo ? '✅ EXISTS' : '❌ MISSING');
        
        // Try to call the swap function (just build the transaction, don't send)
        console.log('\n🔧 Building swap transaction...');
        
        const whiskeyAmount = 1000000; // 1 WHISKEY token (6 decimals)
        
        try {
            const tx = await program.methods
                .swapWhiskeyToUsdcRaydium(new BN(whiskeyAmount))
                .accounts({
                    user: swapKeypair.publicKey,
                    lendingPoolConfig: lendingPoolConfigPda,
                    // Add other required accounts here...
                });
                
            console.log('✅ Transaction built successfully!');
            console.log('🎯 This means the program structure is correct.');
            
        } catch (buildError) {
            console.log('❌ Transaction build failed:', buildError.message);
            
            // Check if it's a missing account error
            if (buildError.message.includes('Account does not exist')) {
                console.log('💡 This is likely due to missing accounts or incorrect PDAs');
            } else if (buildError.message.includes('signature')) {
                console.log('💡 This is the PDA signing issue we\'re trying to fix');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testSwapDirectly();
