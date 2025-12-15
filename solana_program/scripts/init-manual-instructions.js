#!/usr/bin/env node

/**
 * MANUAL INSTRUCTION BUILDING
 * Builds instructions manually using discriminators to bypass Anchor IDL issues
 */

const { Connection, PublicKey, Keypair, Transaction, SystemProgram, TransactionInstruction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const anchor = require('@coral-xyz/anchor');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const LENDING_PROGRAM_ID = new PublicKey('CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

// Instruction discriminators from IDL
const INIT_COLLECTION_REGISTRY_V2_DISCRIMINATOR = Buffer.from([36, 5, 148, 143, 175, 68, 134, 223]);
const INIT_GLOBAL_MARKET_DISCRIMINATOR = Buffer.from([67, 173, 52, 201, 74, 169, 150, 163]);
const INIT_CAPITAL_VAULT_DISCRIMINATOR = Buffer.from([168, 123, 174, 219, 245, 182, 124, 87]);

function createInstruction(discriminator, accounts, data = Buffer.alloc(0)) {
    const instructionData = Buffer.concat([discriminator, data]);
    return new TransactionInstruction({
        programId: LENDING_PROGRAM_ID,
        keys: accounts,
        data: instructionData,
    });
}

async function main() {
    console.log('🏗️  INITIALIZING LENDING PROGRAM ACCOUNTS (Manual Instructions)\n');
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    console.log(`👤 Admin: ${adminKeypair.publicKey.toString()}`);
    
    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL\n`);
    
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
        console.error('❌ Insufficient balance');
        process.exit(1);
    }
    
    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_market')],
        LENDING_PROGRAM_ID
    );
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_registry')],
        LENDING_PROGRAM_ID
    );
    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('capital_vault_usdc')],
        LENDING_PROGRAM_ID
    );
    
    console.log('🔑 PDAs:');
    console.log(`  Global Market: ${globalMarketPda.toString()}`);
    console.log(`  Collection Registry: ${collectionRegistryPda.toString()}`);
    console.log(`  Capital Vault: ${capitalVaultPda.toString()}\n`);
    
    try {
        // Step 1: Collection Registry V2
        console.log('📋 Step 1: Collection Registry V2');
        const regInfo = await connection.getAccountInfo(collectionRegistryPda);
        if (!regInfo) {
            const accounts = [
                { pubkey: collectionRegistryPda, isSigner: false, isWritable: true },
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ];
            
            const instruction = createInstruction(INIT_COLLECTION_REGISTRY_V2_DISCRIMINATOR, accounts);
            const transaction = new Transaction().add(instruction);
            
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = adminKeypair.publicKey;
            
            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature);
            console.log(`  ✅ Initialized! TX: ${signature}\n`);
        } else {
            console.log('  ✅ Already exists\n');
        }
        
        // Step 2: Global Market
        console.log('🌍 Step 2: Global Market');
        const marketInfo = await connection.getAccountInfo(globalMarketPda);
        if (!marketInfo) {
            // Encode args: max_staked_nfts (u32), per_nft_value_usd (u64), liquidation_authority (Pubkey)
            const args = Buffer.alloc(4 + 8 + 32);
            args.writeUInt32LE(5000, 0); // max_staked_nfts
            args.writeBigUInt64LE(BigInt(100000000), 4); // per_nft_value_usd
            LIQUIDATION_AUTHORITY.toBuffer().copy(args, 12); // liquidation_authority
            
            const accounts = [
                { pubkey: globalMarketPda, isSigner: false, isWritable: true },
                { pubkey: collectionRegistryPda, isSigner: false, isWritable: false },
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: capitalVaultPda, isSigner: false, isWritable: false },
                { pubkey: TREASURY_WALLET, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ];
            
            const instruction = createInstruction(INIT_GLOBAL_MARKET_DISCRIMINATOR, accounts, args);
            const transaction = new Transaction().add(instruction);
            
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = adminKeypair.publicKey;
            
            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature);
            console.log(`  ✅ Initialized! TX: ${signature}\n`);
        } else {
            console.log('  ✅ Already exists\n');
        }
        
        // Step 3: Capital Vault
        console.log('💰 Step 3: Capital Vault');
        const vaultInfo = await connection.getAccountInfo(capitalVaultPda);
        if (!vaultInfo) {
            const accounts = [
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: globalMarketPda, isSigner: false, isWritable: false },
                { pubkey: capitalVaultPda, isSigner: false, isWritable: true },
                { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: anchor.web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ];
            
            const instruction = createInstruction(INIT_CAPITAL_VAULT_DISCRIMINATOR, accounts);
            const transaction = new Transaction().add(instruction);
            
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = adminKeypair.publicKey;
            
            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature);
            console.log(`  ✅ Initialized! TX: ${signature}\n`);
        } else {
            console.log('  ✅ Already exists\n');
        }
        
        console.log('✅ All accounts initialized successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.logs) {
            console.error('Logs:', error.logs);
        }
        process.exit(1);
    }
}

main().catch(console.error);

