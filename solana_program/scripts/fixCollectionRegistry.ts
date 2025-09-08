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
  console.log("🔍 Current Collection Registry:", {
    authority: existingRegistry.authority.toString(),
    collectionsCount: existingRegistry.collections.length,
    bump: existingRegistry.bump
  });

  if (existingRegistry.authority.toString() === adminKeypair.publicKey.toString()) {
    console.log("✅ Collection Registry already has correct authority!");
    return;
  }

  console.log("🚨 Collection Registry has wrong authority, this needs to be fixed in the Rust code.");
  console.log("The issue is that initialize_global_market creates the account but doesn't set the authority.");
  console.log("We need to either:");
  console.log("1. Fix the Rust code to properly initialize the Collection Registry in initialize_global_market");
  console.log("2. Or create a separate admin instruction to fix the authority");
}

main().catch(console.error);
