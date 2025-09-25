#!/usr/bin/env node

const { Connection, PublicKey } = require('@solana/web3.js');
const { Program, AnchorProvider, Wallet, BN } = require('@coral-xyz/anchor');

// Load the IDL
const fs = require('fs');
const idl = JSON.parse(fs.readFileSync('/home/arucard/WhiskeyPlanetNfts/solana_program/target/idl/whiskeyprogram.json', 'utf8'));

const PROGRAM_ID = new PublicKey("7qHWLx5D8uhWhEQr3fAsykhdpXeqH3ChcSaVfErYbGNk");

async function main() {
    console.log('🔍 Testing Whiskey Program Connection...');
    
    // Connect to Solana
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    
    console.log('📡 Connection established');
    
    // Test if program exists
    try {
        const programInfo = await connection.getAccountInfo(PROGRAM_ID);
        if (!programInfo) {
            console.error('❌ Program not found at address:', PROGRAM_ID.toBase58());
            return;
        }
        
        console.log('✅ Program found at:', PROGRAM_ID.toBase58());
        console.log('📊 Program data size:', programInfo.data.length);
        console.log('👤 Program owner:', programInfo.owner.toBase58());
        
        // Test PDA derivation
        const collectionName = "TestCollection";
        const collectionSeedConstantBuffer = Buffer.from("collection");
        const collectionNameBuffer = Buffer.from(collectionName);
        
        const [collectionConfigPDA, bump] = await PublicKey.findProgramAddress(
            [collectionSeedConstantBuffer, collectionNameBuffer],
            PROGRAM_ID
        );
        
        console.log('🔑 Test PDA derived:', collectionConfigPDA.toBase58(), 'bump:', bump);
        
        // Check if this PDA exists (should not for test)
        const pdaInfo = await connection.getAccountInfo(collectionConfigPDA);
        console.log('📋 Test PDA exists:', !!pdaInfo);
        
        console.log('✅ Program connection test successful!');
        
    } catch (error) {
        console.error('❌ Error testing program:', error.message);
        console.error('Stack:', error.stack);
    }
}

main().catch(console.error);
