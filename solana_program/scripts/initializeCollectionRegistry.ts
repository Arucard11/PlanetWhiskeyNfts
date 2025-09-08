import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🚀 Initializing Collection Registry...");

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

  try {
    // Check if already initialized
    const existingRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(collectionRegistryPda);
    console.log("⚠️  Collection Registry already exists:", existingRegistry);
    return;
  } catch (error) {
    console.log("✅ Collection Registry doesn't exist yet, proceeding with initialization...");
  }

  // Initialize Collection Registry
  const tx = await lendingProgram.methods
    .initializeCollectionRegistry()
    .accounts({
      collectionRegistry: collectionRegistryPda,
      authority: adminKeypair.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("🎉 Collection Registry initialized!");
  console.log("📝 Transaction signature:", tx);
  
  // Verify initialization
  const registryAccount = await (lendingProgram.account as any).collectionRegistry.fetch(collectionRegistryPda);
  console.log("✅ Verified Collection Registry:", {
    authority: registryAccount.authority.toString(),
    collectionsCount: registryAccount.collections.length,
    bump: registryAccount.bump
  });
}

main().catch(console.error);
