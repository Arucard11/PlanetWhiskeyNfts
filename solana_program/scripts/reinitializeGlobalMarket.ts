import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🔄 Reinitializing Global Market with proper Collection Registry...");

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

  // Derive PDAs
  const [globalMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_market")],
    lendingProgramId
  );
  
  const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_registry")],
    lendingProgramId
  );

  console.log("📍 Global Market PDA:", globalMarketPda.toString());
  console.log("📍 Collection Registry PDA:", collectionRegistryPda.toString());
  console.log("👤 Admin wallet:", adminKeypair.publicKey.toString());

  console.log("⚠️  WARNING: This will close and recreate the Global Market and Collection Registry!");
  console.log("⚠️  This should only be done on devnet for testing!");

  try {
    // Check if accounts exist and close them
    const globalMarketInfo = await connection.getAccountInfo(globalMarketPda);
    const collectionRegistryInfo = await connection.getAccountInfo(collectionRegistryPda);
    
    if (globalMarketInfo) {
      console.log("🗑️  Global Market exists, it needs to be manually closed first");
      console.log("🗑️  Collection Registry exists, it needs to be manually closed first");
      console.log("❌ Cannot proceed - accounts already exist and cannot be automatically closed");
      console.log("💡 Solution: Use 'solana program close' command or create new program instances");
      return;
    }

    // If accounts don't exist, initialize them
    console.log("✅ Accounts don't exist, proceeding with initialization...");
    
    // Initialize Global Market (which will also initialize Collection Registry)
    const tx = await lendingProgram.methods
      .initializeGlobalMarket(
        10000, // max_staked_nfts
        100000000 // per_nft_value_usd (100 USD in microdollars)
      )
      .accounts({
        globalMarket: globalMarketPda,
        collectionRegistry: collectionRegistryPda,
        owner: adminKeypair.publicKey,
        capitalVaultUsdc: new PublicKey("He84QophgrA8GCQTGjkLkUi5qjKCF5Qmrb4Q6Nrt3jL9"), // From your current config
        treasuryWallet: adminKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("🎉 Global Market and Collection Registry reinitialized!");
    console.log("📝 Transaction signature:", tx);
    
    // Verify initialization
    const globalMarket = await (lendingProgram.account as any).globalMarket.fetch(globalMarketPda);
    const collectionRegistry = await (lendingProgram.account as any).collectionRegistry.fetch(collectionRegistryPda);
    
    console.log("✅ Verified Global Market owner:", globalMarket.owner.toString());
    console.log("✅ Verified Collection Registry authority:", collectionRegistry.authority.toString());
    console.log("✅ Collection Registry collections count:", collectionRegistry.collections.length);
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main().catch(console.error);
