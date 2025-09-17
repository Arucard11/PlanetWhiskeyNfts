#!/usr/bin/env node

const { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction,
    TransactionInstruction,
} = require('@solana/web3.js');
const fs = require('fs');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';

// DEPLOYED PROGRAM IDS
const LENDING_PROGRAM_ID = new PublicKey('HegC6oTgMNyHW1g1kDSP8bWe22uCdoQhBxKXfu3joXpK');

// Instruction discriminator for addCollection
const ADD_COLLECTION = Buffer.from([79, 172, 225, 142, 219, 192, 171, 80]);

// Example collections to add (you can modify these)
const COLLECTIONS_TO_ADD = [
    {
        name: "Example Collection 1",
        mint: "11111111111111111111111111111112", // Replace with real collection mint
        valueUsd: 100 // $100 per NFT
    },
    {
        name: "Example Collection 2", 
        mint: "11111111111111111111111111111113", // Replace with real collection mint
        valueUsd: 250 // $250 per NFT
    }
];

function serializeU64(value) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value), 0);
    return buffer;
}

async function main() {
    console.log('📋 ADDING APPROVED COLLECTIONS TO REGISTRY');
    
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('mainnet-admin-keypair.json', 'utf8'))));
    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log('\n👤 Admin:', adminKeypair.publicKey.toString());
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log('💰 Balance:', balance / 1e9, 'SOL');
    
    // Calculate collection registry PDA
    const [collectionRegistry] = PublicKey.findProgramAddressSync([Buffer.from('collection_registry')], LENDING_PROGRAM_ID);
    console.log('📍 Collection Registry:', collectionRegistry.toString());
    
    // Check current registry
    try {
        const registryAccount = await connection.getAccountInfo(collectionRegistry);
        if (registryAccount) {
            console.log('✅ Collection Registry exists');
        } else {
            console.log('❌ Collection Registry not found');
            return;
        }
    } catch (error) {
        console.error('Error checking registry:', error.message);
        return;
    }
    
    console.log('\n🏗️  Adding Collections...');
    
    for (const collection of COLLECTIONS_TO_ADD) {
        console.log(`\n📦 Adding: ${collection.name}`);
        console.log(`   Mint: ${collection.mint}`);
        console.log(`   Value: $${collection.valueUsd}`);
        
        try {
            const collectionMint = new PublicKey(collection.mint);
            
            // Create add collection instruction
            const addCollectionData = Buffer.concat([
                ADD_COLLECTION,
                collectionMint.toBuffer(),
                serializeU64(collection.valueUsd)
            ]);
            
            const addCollectionIx = new TransactionInstruction({
                keys: [
                    { pubkey: collectionRegistry, isSigner: false, isWritable: true },
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: false },
                ],
                programId: LENDING_PROGRAM_ID,
                data: addCollectionData
            });
            
            const tx = new Transaction().add(addCollectionIx);
            const sig = await connection.sendTransaction(tx, [adminKeypair]);
            await connection.confirmTransaction(sig);
            console.log('✅ Added:', sig);
            
        } catch (error) {
            console.error(`❌ Failed to add ${collection.name}:`, error.message);
        }
    }
    
    console.log('\n🎉 Collection addition process complete!');
    console.log('\n📝 NOTE: Replace the example collection mints with real collection addresses');
    console.log('📝 You can find collection mints from your database or deployed collections');
    
    const finalBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log('\n💰 Final balance:', finalBalance / 1e9, 'SOL');
}

if (require.main === module) {
    main().catch(console.error);
}
