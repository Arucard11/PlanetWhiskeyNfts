import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  try {
    console.log('🏷️ Adding collection to lending registry...');
    
    // Setup
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const adminKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(join(__dirname, '../admin-keypair.json'), 'utf-8')))
    );
    
    // Direct program interaction
    const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
    const missingCollection = new PublicKey("2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk");
    const valueUsd = new anchor.BN(1_000_000); // 1 USD in micro-dollars
    
    console.log(`👤 Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`📚 Collection to add: ${missingCollection.toString()}`);
    console.log(`💰 Value: $1 USD`);
    
    // Create provider and workspace
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {
      commitment: 'confirmed'
    });
    anchor.setProvider(provider);
    
    // Get workspace
    const workspace = anchor.workspace as any;
    const program = workspace.Lendingprogram;
    
    if (!program) {
      throw new Error('Lending program not found in workspace');
    }
    
    console.log(`🏦 Using program: ${program.programId.toString()}`);
    
    // Derive collection registry PDA
    const [collectionRegistry] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_registry_v2")],
      LENDING_PROGRAM_ID
    );
    
    console.log(`📋 Collection Registry: ${collectionRegistry.toString()}`);
    
    // Add collection
    const tx = await program.methods
      .addCollection(missingCollection, valueUsd)
      .accounts({
        collectionRegistry: collectionRegistry,
        admin: adminKeypair.publicKey,
      })
      .signers([adminKeypair])
      .rpc();
    
    console.log(`✅ Collection added! Transaction: ${tx}`);
    
    // Verify
    const registryData = await program.account.collectionRegistry.fetch(collectionRegistry);
    console.log(`\n📊 Registry now has ${registryData.collections.length} collections:`);
    
    for (const collection of registryData.collections) {
      const isNew = collection.mint.toString() === missingCollection.toString();
      console.log(`  ${isNew ? '🆕' : '📚'} ${collection.mint.toString()}: $${parseInt(collection.valueUsd) / 1_000_000} (approved: ${collection.isApproved})`);
    }
    
    console.log('\n🎉 Success! The lending frontend should now recognize your deposited NFT properly.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.message?.includes('CollectionAlreadyExists')) {
      console.log('✅ Collection already exists in registry - this is good!');
    } else {
      process.exit(1);
    }
  }
}

main().catch(console.error);
