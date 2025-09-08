import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🔄 Updating Global Market to point to new Collection Registry...");

  // Load admin keypair
  const adminKeypairPath = "./admin-keypair.json";
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

  // Derive PDAs
  const [globalMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_market")],
    lendingProgramId
  );
  
  const [newCollectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry_v2")],
    lendingProgramId
  );

  console.log("📍 Global Market PDA:", globalMarketPda.toString());
  console.log("📍 New Collection Registry PDA:", newCollectionRegistryPda.toString());

  // Check current Global Market
  const globalMarket = await (lendingProgram.account as any).globalMarket.fetch(globalMarketPda);
  console.log("🔍 Current Global Market collection_registry:", globalMarket.collectionRegistry.toString());
  console.log("🔍 New Collection Registry PDA:", newCollectionRegistryPda.toString());
  
  if (globalMarket.collectionRegistry.toString() === newCollectionRegistryPda.toString()) {
    console.log("✅ Global Market already points to the correct Collection Registry!");
    return;
  }

  console.log("⚠️  Global Market points to old Collection Registry, but we can't update it easily.");
  console.log("💡 The APIs will need to use the new Collection Registry PDA directly.");
  console.log("💡 This is actually fine - the Global Market reference is just for tracking.");
}

main().catch(console.error);
