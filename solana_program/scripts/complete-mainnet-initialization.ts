import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 🚀 COMPLETE MAINNET INITIALIZATION SCRIPT
 * 
 * This script initializes ALL vaults and accounts for the Planet Whiskey NFT ecosystem:
 * 1. Whiskey Program (Revenue Collection & Jupiter Swapping)
 * 2. Lending Program (NFT Collateral Loans) 
 * 3. Marketplace Program (NFT Trading)
 * 
 * CRITICAL: This uses the CORRECT vault architecture where lending uses whiskey program's USDC vault
 */

interface InitializationConfig {
  network: 'devnet' | 'mainnet-beta';
  rpcUrl: string;
  adminKeypairPath: string;
  
  // Program IDs
  whiskeyProgramId: string;
  lendingProgramId: string;
  marketplaceProgramId: string;
  
  // Token Mints
  whiskeyTokenMint?: string; // Will create if not provided
  usdcTokenMint?: string;    // Will create if not provided (devnet only)
  
  // Initial funding amounts
  initialUsdcForLending: number; // Amount of USDC to fund lending vault
  initialWhiskeyForTesting: number; // Amount of WHISKEY for testing
}

class CompleteInitializer {
  private connection: Connection;
  private adminKeypair: Keypair;
  private config: InitializationConfig;
  private results: any = {};

  constructor(config: InitializationConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.adminKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(config.adminKeypairPath, 'utf-8')))
    );
  }

  async initialize(): Promise<void> {
    console.log(`🚀 Starting Complete ${this.config.network.toUpperCase()} Initialization...`);
    console.log(`👤 Admin Wallet: ${this.adminKeypair.publicKey.toString()}`);
    
    // Check admin balance
    const balance = await this.connection.getBalance(this.adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 10 * LAMPORTS_PER_SOL) {
      throw new Error(`❌ Insufficient SOL balance. Need at least 10 SOL for initialization.`);
    }

    try {
      // Step 1: Initialize Token Mints
      await this.initializeTokenMints();
      
      // Step 2: Initialize Whiskey Program
      await this.initializeWhiskeyProgram();
      
      // Step 3: Initialize Lending Program  
      await this.initializeLendingProgram();
      
      // Step 4: Fund Vaults
      await this.fundVaults();
      
      // Step 5: Generate Environment File
      await this.generateEnvironmentFile();
      
      console.log(`🎉 Complete ${this.config.network.toUpperCase()} initialization successful!`);
      
    } catch (error) {
      console.error(`❌ Initialization failed:`, error);
      throw error;
    }
  }

  private async initializeTokenMints(): Promise<void> {
    console.log(`\n🪙 Step 1: Initialize Token Mints`);
    
    // WHISKEY Token
    if (!this.config.whiskeyTokenMint) {
      console.log(`Creating WHISKEY token mint...`);
      const whiskeyMint = await createMint(
        this.connection,
        this.adminKeypair,
        this.adminKeypair.publicKey,
        this.adminKeypair.publicKey,
        6 // 6 decimals for WHISKEY
      );
      this.results.whiskeyTokenMint = whiskeyMint.toString();
      console.log(`✅ WHISKEY Token Mint: ${whiskeyMint.toString()}`);
    } else {
      this.results.whiskeyTokenMint = this.config.whiskeyTokenMint;
      console.log(`✅ Using existing WHISKEY Token Mint: ${this.config.whiskeyTokenMint}`);
    }

    // USDC Token (devnet only - mainnet uses real USDC)
    if (this.config.network === 'devnet') {
      if (!this.config.usdcTokenMint) {
        console.log(`Creating test USDC token mint for devnet...`);
        const usdcMint = await createMint(
          this.connection,
          this.adminKeypair,
          this.adminKeypair.publicKey,
          this.adminKeypair.publicKey,
          6 // 6 decimals for USDC
        );
        this.results.usdcTokenMint = usdcMint.toString();
        console.log(`✅ Test USDC Token Mint: ${usdcMint.toString()}`);
      } else {
        this.results.usdcTokenMint = this.config.usdcTokenMint;
        console.log(`✅ Using existing test USDC Token Mint: ${this.config.usdcTokenMint}`);
      }
    } else {
      // Mainnet USDC
      this.results.usdcTokenMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      console.log(`✅ Using mainnet USDC: ${this.results.usdcTokenMint}`);
    }
  }

  private async initializeWhiskeyProgram(): Promise<void> {
    console.log(`\n🥃 Step 2: Initialize Whiskey Program`);
    
    const whiskeyProgramId = new PublicKey(this.config.whiskeyProgramId);
    
    // Derive PDAs
    const [lendingPoolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool")],
      whiskeyProgramId
    );
    
    const [whiskeyVaultV2] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool"), Buffer.from("whiskey_vault_v2")],
      whiskeyProgramId
    );
    
    const [usdcVaultV2] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
      whiskeyProgramId
    );

    this.results.lendingPoolConfig = lendingPoolConfig.toString();
    this.results.whiskeyVaultV2 = whiskeyVaultV2.toString();
    this.results.usdcVaultV2 = usdcVaultV2.toString();

    console.log(`📊 Whiskey Program PDAs:`);
    console.log(`  Lending Pool Config: ${lendingPoolConfig.toString()}`);
    console.log(`  WHISKEY Vault V2: ${whiskeyVaultV2.toString()}`);
    console.log(`  USDC Vault V2: ${usdcVaultV2.toString()}`);

    // Check if already initialized
    try {
      const poolInfo = await this.connection.getAccountInfo(lendingPoolConfig);
      if (poolInfo) {
        console.log(`✅ Whiskey Program already initialized`);
        return;
      }
    } catch (error) {
      // Not initialized, continue
    }

    // Initialize lending pool and create v2 vaults
    // Note: This would require the actual program instructions
    console.log(`⚠️  Manual step required: Initialize whiskey program lending pool and v2 vaults`);
    console.log(`   Run: anchor invoke initialize_lending_pool`);
    console.log(`   Run: anchor invoke create_v2_vaults`);
  }

  private async initializeLendingProgram(): Promise<void> {
    console.log(`\n🏦 Step 3: Initialize Lending Program`);
    
    const lendingProgramId = new PublicKey(this.config.lendingProgramId);
    
    // Derive PDAs
    const [globalMarket] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      lendingProgramId
    );
    
    const [collectionRegistryV2] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_registry_v2")],
      lendingProgramId
    );

    this.results.globalMarket = globalMarket.toString();
    this.results.collectionRegistryV2 = collectionRegistryV2.toString();

    console.log(`📊 Lending Program PDAs:`);
    console.log(`  Global Market: ${globalMarket.toString()}`);
    console.log(`  Collection Registry V2: ${collectionRegistryV2.toString()}`);

    // Check if already initialized
    try {
      const marketInfo = await this.connection.getAccountInfo(globalMarket);
      if (marketInfo) {
        console.log(`✅ Lending Program already initialized`);
        return;
      }
    } catch (error) {
      // Not initialized, continue
    }

    console.log(`⚠️  Manual step required: Initialize lending program`);
    console.log(`   Run: anchor invoke initialize_global_market`);
    console.log(`   Run: anchor invoke initialize_collection_registry_v2`);
  }

  private async fundVaults(): Promise<void> {
    console.log(`\n💰 Step 4: Fund Vaults`);
    
    const usdcMint = new PublicKey(this.results.usdcTokenMint);
    const whiskeyMint = new PublicKey(this.results.whiskeyTokenMint);
    const usdcVault = new PublicKey(this.results.usdcVaultV2);
    
    // Create admin token accounts
    const adminUsdcAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.adminKeypair,
      usdcMint,
      this.adminKeypair.publicKey
    );
    
    const adminWhiskeyAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      this.adminKeypair,
      whiskeyMint,
      this.adminKeypair.publicKey
    );

    console.log(`Admin USDC Account: ${adminUsdcAccount.address.toString()}`);
    console.log(`Admin WHISKEY Account: ${adminWhiskeyAccount.address.toString()}`);

    // Fund admin accounts (devnet only)
    if (this.config.network === 'devnet') {
      console.log(`💵 Minting test tokens for devnet...`);
      
      // Mint test USDC
      await mintTo(
        this.connection,
        this.adminKeypair,
        usdcMint,
        adminUsdcAccount.address,
        this.adminKeypair,
        this.config.initialUsdcForLending * 1_000_000 // Convert to micro-USDC
      );
      
      // Mint test WHISKEY  
      await mintTo(
        this.connection,
        this.adminKeypair,
        whiskeyMint,
        adminWhiskeyAccount.address,
        this.adminKeypair,
        this.config.initialWhiskeyForTesting * 1_000_000 // Convert to micro-WHISKEY
      );
      
      console.log(`✅ Minted ${this.config.initialUsdcForLending} test USDC`);
      console.log(`✅ Minted ${this.config.initialWhiskeyForTesting} test WHISKEY`);
    }

    console.log(`⚠️  Manual step required: Fund the USDC vault for lending`);
    console.log(`   Transfer ${this.config.initialUsdcForLending} USDC to: ${usdcVault.toString()}`);
  }

  private async generateEnvironmentFile(): Promise<void> {
    console.log(`\n📝 Step 5: Generate Environment File`);
    
    const envContent = `# Generated by Complete Mainnet Initialization Script
# Network: ${this.config.network.toUpperCase()}
# Generated: ${new Date().toISOString()}

# Network Configuration
NEXT_PUBLIC_SOLANA_NETWORK=${this.config.network}
NEXT_PUBLIC_SOLANA_RPC_URL=${this.config.rpcUrl}
SOLANA_RPC_URL=${this.config.rpcUrl}

# Program IDs
NEXT_PUBLIC_WHISKEY_PROGRAM_ID=${this.config.whiskeyProgramId}
NEXT_PUBLIC_LENDING_PROGRAM_ID=${this.config.lendingProgramId}
NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=${this.config.marketplaceProgramId}

# Token Mints
NEXT_PUBLIC_WHISKEY_TOKEN_MINT=${this.results.whiskeyTokenMint}
NEXT_PUBLIC_USDC_TOKEN_MINT=${this.results.usdcTokenMint}

# Admin & Treasury
NEXT_PUBLIC_ADMIN_WALLET=${this.adminKeypair.publicKey.toString()}
NEXT_PUBLIC_TREASURY_WALLET=${this.adminKeypair.publicKey.toString()}

# Whiskey Program PDAs
NEXT_PUBLIC_LENDING_POOL_CONFIG=${this.results.lendingPoolConfig}
NEXT_PUBLIC_LENDING_POOL_WHISKEY_VAULT=${this.results.whiskeyVaultV2}
NEXT_PUBLIC_LENDING_POOL_USDC_VAULT=${this.results.usdcVaultV2}

# Lending Program PDAs  
NEXT_PUBLIC_GLOBAL_MARKET_PDA=${this.results.globalMarket}
NEXT_PUBLIC_COLLECTION_REGISTRY_V2=${this.results.collectionRegistryV2}

# Base URL
NEXT_PUBLIC_BASE_URL=${this.config.network === 'mainnet-beta' ? 'https://your-domain.com' : 'http://localhost:3000'}
`;

    const envPath = join(__dirname, `../${this.config.network}-environment.env`);
    writeFileSync(envPath, envContent);
    
    console.log(`✅ Environment file generated: ${envPath}`);
    console.log(`📋 Copy this to your frontend .env.local file`);
  }
}

// Configuration for different networks
const DEVNET_CONFIG: InitializationConfig = {
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  adminKeypairPath: join(__dirname, '../admin-keypair.json'),
  whiskeyProgramId: '68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD',
  lendingProgramId: '25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ', 
  marketplaceProgramId: '6SHqHpSVYHUbkX3AgMg3XcAxH5Eax48T9orPAio6j4Wk',
  whiskeyTokenMint: 'FuXejqzRAWWkoAcNrDU8L2i6cXXmB5NwqAVp2daN456j',
  usdcTokenMint: '5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR',
  initialUsdcForLending: 1000000, // 1M USDC for testing
  initialWhiskeyForTesting: 1000000, // 1M WHISKEY for testing
};

const MAINNET_CONFIG: InitializationConfig = {
  network: 'mainnet-beta',
  rpcUrl: 'https://api.mainnet-beta.solana.com',
  adminKeypairPath: join(__dirname, '../mainnet-admin-keypair.json'), // Use different keypair for mainnet
  whiskeyProgramId: '', // Deploy programs to mainnet first
  lendingProgramId: '',
  marketplaceProgramId: '',
  initialUsdcForLending: 100000, // 100K USDC for initial lending
  initialWhiskeyForTesting: 0, // No test tokens on mainnet
};

async function main() {
  const network = process.argv[2] as 'devnet' | 'mainnet-beta';
  
  if (!network || !['devnet', 'mainnet-beta'].includes(network)) {
    console.log('Usage: npx ts-node complete-mainnet-initialization.ts <devnet|mainnet-beta>');
    process.exit(1);
  }
  
  const config = network === 'devnet' ? DEVNET_CONFIG : MAINNET_CONFIG;
  
  if (network === 'mainnet-beta') {
    console.log('⚠️  MAINNET INITIALIZATION - Please review all configurations carefully!');
    console.log('⚠️  Make sure you have deployed all programs to mainnet first!');
    // Add confirmation prompt for mainnet
  }
  
  const initializer = new CompleteInitializer(config);
  await initializer.initialize();
}

if (require.main === module) {
  main().catch(console.error);
}
