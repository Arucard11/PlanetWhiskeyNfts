import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🔧 Fixing Collection Registry authority...");

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

  // Derive Collection Registry PDA
  const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry")],
    lendingProgramId
  );

  console.log("📍 Collection Registry PDA:", collectionRegistryPda.toString());
  console.log("👤 Admin wallet:", adminKeypair.publicKey.toString());

  // Check current state
  const existingRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(collectionRegistryPda);
  console.log("🔍 Current Collection Registry authority:", existingRegistry.authority.toString());

  if (existingRegistry.authority.toString() === adminKeypair.publicKey.toString()) {
    console.log("✅ Collection Registry already has correct authority!");
    return;
  }

  console.log("🔧 Calling fixCollectionRegistryAuthority instruction...");

  // Call the fix instruction
  const tx = await lendingProgram.methods
    .fixCollectionRegistryAuthority()
    .accounts({
      collectionRegistry: collectionRegistryPda,
      admin: adminKeypair.publicKey,
    })
    .rpc();

  console.log("🎉 Collection Registry authority fixed!");
  console.log("📝 Transaction signature:", tx);
  
  // Verify the fix
  const updatedRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(collectionRegistryPda);
  console.log("✅ Updated Collection Registry authority:", updatedRegistry.authority.toString());
  console.log("✅ Collections count:", updatedRegistry.collections.length);
  console.log("✅ Bump:", updatedRegistry.bump);
}

main().catch(console.error);
