import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🏷️ ADD MISSING COLLECTION TO REGISTRY
 * 
 * This script adds the missing collection to the lending registry
 * so the deposited NFT is properly recognized.
 */

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(__dirname, '../admin-keypair.json'), 'utf-8')))
  );
  
  const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
  
  // The missing collection that needs to be added
  const missingCollection = new PublicKey("2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk");
  const collectionValueUsd = 1_000_000; // 1 USD in micro-dollars
  
  console.log('🏷️ Adding missing collection to registry...');
  console.log(`👤 Admin: ${adminKeypair.publicKey.toString()}`);
  console.log(`📚 Collection: ${missingCollection.toString()}`);
  console.log(`💰 Value: ${collectionValueUsd / 1_000_000} USD`);
  
  // Setup program
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {
    commitment: 'confirmed'
  });
  
  const lendingIdl = JSON.parse(readFileSync(join(__dirname, '../target/idl/lendingprogram.json'), 'utf-8'));
  const program = new anchor.Program(lendingIdl, provider);
  
  // Derive collection registry PDA
  const [collectionRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry_v2")],
    LENDING_PROGRAM_ID
  );
  
  try {
    console.log('🔄 Adding collection to registry...');
    
    const tx = await program.methods
      .addCollection(missingCollection, new anchor.BN(collectionValueUsd))
      .accounts({
        collectionRegistry: collectionRegistry,
        admin: adminKeypair.publicKey,
      })
      .signers([adminKeypair])
      .rpc();
    
    console.log(`✅ Collection added! Transaction: ${tx}`);
    
    // Verify the addition
    const registryData = await (program.account as any).collectionRegistry.fetch(collectionRegistry);
    console.log(`\n📊 Registry now has ${registryData.collections.length} collections:`);
    
    for (const collection of registryData.collections) {
      const isNew = collection.mint.toString() === missingCollection.toString();
      console.log(`  ${isNew ? '🆕' : '📚'} Collection: ${collection.mint.toString()}`);
      console.log(`    Value: ${parseInt(collection.valueUsd) / 1_000_000} USD`);
      console.log(`    Approved: ${collection.isApproved}`);
    }
    
    console.log('\n🎉 Collection successfully added to registry!');
    console.log('💡 The frontend should now properly recognize the deposited NFT');
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.message?.includes('CollectionAlreadyExists')) {
      console.log('✅ Collection already exists in registry');
    } else {
      throw error;
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
