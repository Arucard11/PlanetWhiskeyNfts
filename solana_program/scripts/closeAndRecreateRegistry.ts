import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🗑️  Closing and recreating Collection Registry...");

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
    // Step 1: Check if the account exists and get its info
    const accountInfo = await connection.getAccountInfo(collectionRegistryPda);
    
    if (!accountInfo) {
      console.log("❌ Collection Registry doesn't exist. Creating new one...");
    } else {
      console.log("🔍 Found existing Collection Registry");
      console.log("   Owner:", accountInfo.owner.toString());
      console.log("   Data length:", accountInfo.data.length);
      console.log("   Lamports:", accountInfo.lamports);
      
      // Step 2: Try to close the account by transferring its lamports to admin
      console.log("🗑️  Attempting to close Collection Registry...");
      
      try {
        // Use solana CLI to close the account (this is the safest way)
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const closeCommand = `solana program close ${collectionRegistryPda.toString()} --keypair ${adminKeypairPath} --url devnet`;
        console.log("🔧 Running:", closeCommand);
        
        const { stdout, stderr } = await execAsync(closeCommand);
        console.log("✅ Close output:", stdout);
        if (stderr) console.log("⚠️  Close stderr:", stderr);
        
      } catch (closeError) {
        console.log("❌ Failed to close account:", closeError.message);
        console.log("💡 The account cannot be closed because it's a PDA owned by the program");
        console.log("�� We need to create a 'close_collection_registry' instruction in the Rust code");
        return;
      }
    }

    // Step 3: Initialize new Collection Registry
    console.log("🆕 Creating new Collection Registry...");
    
    const tx = await lendingProgram.methods
      .initializeCollectionRegistry()
      .accounts({
        collectionRegistry: collectionRegistryPda,
        authority: adminKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("🎉 Collection Registry recreated!");
    console.log("📝 Transaction signature:", tx);
    
    // Verify the new registry
    const newRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(collectionRegistryPda);
    console.log("✅ New Collection Registry authority:", newRegistry.authority.toString());
    console.log("✅ Collections count:", newRegistry.collections.length);
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
