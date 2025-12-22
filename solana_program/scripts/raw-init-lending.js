#!/usr/bin/env node

/**
 * RAW INITIALIZATION - Uses web3.js directly
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const LENDING_PROGRAM_ID = new PublicKey('CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

async function main() {
    console.log('🏗️  RAW INITIALIZATION');
    
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
        console.error('❌ Insufficient balance');
        process.exit(1);
    }
    
    // Setup Anchor provider
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);
    
    // Load IDL and create program
    const idl = JSON.parse(fs.readFileSync('./target/idl/lendingprogram.json', 'utf-8'));
    const program = new anchor.Program(idl, LENDING_PROGRAM_ID, provider);
    
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
    
    console.log(`Global Market: ${globalMarketPda.toString()}`);
    console.log(`Collection Registry: ${collectionRegistryPda.toString()}`);
    console.log(`Capital Vault: ${capitalVaultPda.toString()}`);
    
    try {
        // Step 1: Collection Registry V2
        console.log('\n📋 Step 1: Collection Registry V2');
        const regInfo = await connection.getAccountInfo(collectionRegistryPda);
        if (!regInfo) {
            const tx1 = await program.methods
                .initializeCollectionRegistryV2()
                .accounts({
                    collectionRegistry: collectionRegistryPda,
                    authority: adminKeypair.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`✅ TX: ${tx1}`);
        } else {
            console.log('✅ Already exists');
        }
        
        // Step 2: Global Market
        console.log('\n🌍 Step 2: Global Market');
        const marketInfo = await connection.getAccountInfo(globalMarketPda);
        if (!marketInfo) {
            const tx2 = await program.methods
                .initializeGlobalMarket(
                    new anchor.BN(5000),
                    new anchor.BN(100000000),
                    LIQUIDATION_AUTHORITY
                )
                .accounts({
                    globalMarket: globalMarketPda,
                    collectionRegistry: collectionRegistryPda,
                    owner: adminKeypair.publicKey,
                    capitalVaultUsdc: capitalVaultPda,
                    treasuryWallet: TREASURY_WALLET,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log(`✅ TX: ${tx2}`);
        } else {
            console.log('✅ Already exists');
        }
        
        // Step 3: Capital Vault
        console.log('\n💰 Step 3: Capital Vault');
        const vaultInfo = await connection.getAccountInfo(capitalVaultPda);
        if (!vaultInfo) {
            const tx3 = await program.methods
                .initializeCapitalVault()
                .accounts({
                    admin: adminKeypair.publicKey,
                    globalMarket: globalMarketPda,
                    capitalVault: capitalVaultPda,
                    usdcMint: USDC_MINT,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .rpc();
            console.log(`✅ TX: ${tx3}`);
        } else {
            console.log('✅ Already exists');
        }
        
        console.log('\n✅ All accounts initialized!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        process.exit(1);
    }
}

main().catch(console.error);













