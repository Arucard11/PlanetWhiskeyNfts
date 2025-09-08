import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🔄 Closing and recreating Collection Registry...");

  // Load admin keypair
  const adminKeypairPath = "./admin-keypair.json";
  if (!fs.existsSync(adminKeypairPath)) {
    throw new Error("Admin keypair not found. Please ensure admin-keypair.json exists.");
  }
  
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(adminKeypairPath, "utf8")))
  );

  // Setup connection and provider
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(adminKeypair),
    { preflightCommitment: "confirmed" }
  );

  // Load lending program
  const lendingIdl = JSON.parse(fs.readFileSync("./target/idl/lendingprogram.json", "utf8"));
  const lendingProgramId = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
  const lendingProgram = new anchor.Program(lendingIdl as any, provider);

  // Derive old Collection Registry PDA (original seeds)
  const [oldCollectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry")],
    lendingProgramId
  );

  // Derive new Collection Registry PDA (v2 seeds)
  const [newCollectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry_v2")],
    lendingProgramId
  );

  console.log("📍 Old Collection Registry PDA:", oldCollectionRegistryPda.toString());
  console.log("📍 New Collection Registry PDA:", newCollectionRegistryPda.toString());
  console.log("👤 Admin wallet:", adminKeypair.publicKey.toString());

  try {
    // Step 1: Close the old Collection Registry
    console.log("🗑️  Step 1: Closing old Collection Registry...");
    const closeTx = await lendingProgram.methods
      .closeCollectionRegistry()
      .accounts({
        collectionRegistry: oldCollectionRegistryPda,
        admin: adminKeypair.publicKey,
      })
      .rpc();

    console.log("✅ Old Collection Registry closed! TX:", closeTx);

    // Step 2: Initialize new Collection Registry V2
    console.log("🆕 Step 2: Initializing new Collection Registry V2...");
    const initTx = await lendingProgram.methods
      .initializeCollectionRegistryV2()
      .accounts({
        collectionRegistry: newCollectionRegistryPda,
        authority: adminKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ New Collection Registry V2 initialized! TX:", initTx);
    
    // Step 3: Verify the new registry
    const newRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(newCollectionRegistryPda);
    console.log("🎉 Success! New Collection Registry:", {
      authority: newRegistry.authority.toString(),
      collectionsCount: newRegistry.collections.length,
      bump: newRegistry.bump
    });

    console.log("\n🔧 IMPORTANT: Update your environment variables!");
    console.log("Old Collection Registry PDA:", oldCollectionRegistryPda.toString());
    console.log("New Collection Registry PDA:", newCollectionRegistryPda.toString());
    console.log("\nUpdate NEXT_PUBLIC_COLLECTION_REGISTRY_PDA in your .env.local file!");
    
  } catch (error) {
    console.error("❌ Error:", error);
    
    // Check if old registry still exists
    try {
      const oldRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(oldCollectionRegistryPda);
      console.log("⚠️  Old registry still exists:", oldRegistry.authority.toString());
    } catch (e) {
      console.log("✅ Old registry was successfully closed");
    }
  }
}

main().catch(console.error);
