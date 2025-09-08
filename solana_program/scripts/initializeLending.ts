import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { PublicKey, Keypair, SystemProgram, Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import BN from 'bn.js';

// Import the IDL type
import { Lendingprogram } from '../../planet-whiskey-nfts/src/lib/idl/lendingprogram';

async function main() {
  console.log("🚀 Initializing Planet Whiskey Lending Protocol...");
  
  // Load deployment info
  const deploymentInfoPath = path.join(__dirname, '../project-constellation-deployment.json');
  if (!fs.existsSync(deploymentInfoPath)) {
    console.error("❌ Deployment info file not found. Please run deployment first.");
    process.exit(1);
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf8'));
  
  // Load treasury keypair
  const treasuryKeypairPath = path.join(__dirname, '../treasury-keypair.json');
  if (!fs.existsSync(treasuryKeypairPath)) {
    console.error("❌ Treasury keypair not found. Please generate it first.");
    process.exit(1);
  }
  
  const treasuryKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(treasuryKeypairPath, 'utf8')))
  );
  
  console.log(`💰 Treasury wallet: ${treasuryKeypair.publicKey.toString()}`);
  
  // Setup Solana connection
  const connection = new Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );
  
  // Check treasury balance
  const balance = await connection.getBalance(treasuryKeypair.publicKey);
  console.log(`💎 Treasury balance: ${balance / 1e9} SOL`);
  
  if (balance < 0.1e9) {
    console.log("⚠️ Low balance, requesting airdrop...");
    try {
      const signature = await connection.requestAirdrop(treasuryKeypair.publicKey, 2e9); // 2 SOL
      await connection.confirmTransaction(signature);
      console.log("✅ Airdrop successful!");
    } catch (error) {
      console.log("⚠️ Airdrop failed, continuing with current balance...");
    }
  }

  // Setup anchor
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(treasuryKeypair),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const programId = new PublicKey("EKGgPnSkQEJpEBaLpxWXpLQNFcC5TR3SkSUDqsuWLcKK");
  
  // Load the updated IDL
  const idlPath = path.join(__dirname, '../../planet-whiskey-nfts/src/lib/idl/lendingprogram.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new Program(idl as any, programId, provider);

  // Derive Global Market PDA
  const [globalMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_market")],
    programId
  );

  console.log(`🌍 Global Market PDA: ${globalMarketPda.toString()}`);

  // Check if already initialized
  try {
    const globalMarketAccount = await program.account.GlobalMarket.fetch(globalMarketPda);
    console.log("✅ Global Market already initialized!");
    console.log(`📊 Current staked NFTs: ${(globalMarketAccount as any).current_staked_nfts}`);
    console.log(`🎯 Max staked NFTs: ${(globalMarketAccount as any).max_staked_nfts}`);
    console.log(`💵 Per-NFT value: $${(globalMarketAccount as any).per_nft_value_usd}`);
    
    // Update deployment file
    deploymentInfo.globalMarketPda = globalMarketPda.toString();
    deploymentInfo.initialized = true;
    deploymentInfo.initializationSkipped = true;
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n🎉 Lending Protocol is ready to use!");
    return;
  } catch (error) {
    console.log("📝 Global Market not initialized yet, proceeding with initialization...");
  }

  // Create dummy vault accounts (these will be replaced with actual token accounts)
  const dummyVault = Keypair.generate().publicKey;

  try {
    console.log("🌍 Initializing Global Market...");
    await program.methods
      .initializeGlobalMarket(
        [], // Empty approved collections initially
        [], // Empty collection values initially  
        500, // Max staked NFTs
        new BN(50_000_000) // Per-NFT value in USD (50.00 in microdollars)
      )
      .accounts({
        globalMarket: globalMarketPda,
        owner: treasuryKeypair.publicKey,
        capitalVaultUsdc: dummyVault,
        treasuryVaultUsdc: dummyVault,
        treasuryVaultWhiskey: dummyVault,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([treasuryKeypair])
      .rpc();

    console.log("✅ Global Market initialized successfully!");

    // Update deployment file
    deploymentInfo.globalMarketPda = globalMarketPda.toString();
    deploymentInfo.initialized = true;
    deploymentInfo.vaults = {
      capitalVaultUsdc: dummyVault.toString(),
      treasuryVaultUsdc: dummyVault.toString(),
      treasuryVaultWhiskey: dummyVault.toString()
    };
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n🎉 Planet Whiskey Lending Protocol initialized successfully!");
    console.log("📄 Configuration saved to project-constellation-deployment.json");
    console.log("\n📋 Next Steps:");
    console.log("1. 🔄 Sync NFT collections from your database");
    console.log("2. 💰 Fund the capital vaults with USDC");
    console.log("3. 🧪 Test the user flow on the frontend");

  } catch (error) {
    console.error("❌ Initialization failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
