import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🔧 Manually fixing Collection Registry authority...");

  // Load admin keypair
  const adminKeypairPath = "./admin-keypair.json";
  if (!fs.existsSync(adminKeypairPath)) {
    throw new Error("Admin keypair not found. Please ensure admin-keypair.json exists.");
  }
  
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(adminKeypairPath, "utf8")))
  );

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const lendingProgramId = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");

  // Derive Collection Registry PDA
  const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry")],
    lendingProgramId
  );

  console.log("📍 Collection Registry PDA:", collectionRegistryPda.toString());
  console.log("👤 Admin wallet:", adminKeypair.publicKey.toString());

  // Check current state first
  try {
    const registryInfo = await connection.getAccountInfo(collectionRegistryPda);
    if (!registryInfo) {
      console.log("❌ Collection Registry account not found!");
      return;
    }
    
    // Parse the authority (first 32 bytes after discriminator)
    const currentAuthority = new PublicKey(registryInfo.data.slice(8, 40));
    console.log("🔍 Current authority:", currentAuthority.toString());
    
    if (currentAuthority.equals(adminKeypair.publicKey)) {
      console.log("✅ Authority is already correct!");
      return;
    }
    
    console.log("🚨 Authority is wrong, but we cannot fix it with a manual instruction");
    console.log("🚨 The issue is that only the CURRENT authority can call the fix instruction");
    console.log("🚨 Current authority is System Program which cannot sign transactions");
    console.log("💡 We need to use Option 2: Close and recreate the account");
    
  } catch (error) {
    console.error("❌ Error checking account:", error);
  }
}

main().catch(console.error);
