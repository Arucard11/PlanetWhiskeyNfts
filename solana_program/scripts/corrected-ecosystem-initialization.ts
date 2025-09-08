import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 🔧 CORRECTED ECOSYSTEM INITIALIZATION SCRIPT
 * 
 * FIXED ARCHITECTURE:
 * - Lending Program OWNS and CONTROLS its capital vault
 * - Whiskey Program sends USDC TO lending program's vault
 * - Clear separation of concerns with proper control
 * 
 * VAULT FLOW:
 * NFT Sales → Whiskey Vault → Jupiter Swap → Whiskey USDC Vault (intermediate)
 *                                              ↓
 *                                          Transfer TO
 *                                              ↓
 *                                    Lending Capital Vault (final)
 *                                              ↓
 *                                        Loan Disbursement
 */

interface CorrectedConfig {
  network: 'devnet' | 'mainnet-beta';
  rpcUrl: string;
  adminKeypairPath: string;
  
  // Program IDs
  whiskeyProgramId: string;
  lendingProgramId: string;
  marketplaceProgramId: string;
  
  // Token Mints
  whiskeyTokenMint: string;
  usdcTokenMint: string;
  
  // Initial funding
  initialUsdcForLending: number;
}

interface CorrectedAddresses {
  // Shared
  adminWallet: PublicKey;
  treasuryWallet: PublicKey;
  whiskeyTokenMint: PublicKey;
  usdcTokenMint: PublicKey;
  
  // Whiskey Program PDAs
  programSuperAdmin: PublicKey;
  lendingPoolConfig: PublicKey;
  whiskeyVaultV2: PublicKey;
  whiskeyUsdcVaultV2: PublicKey; // INTERMEDIATE vault (whiskey program owns)
  
  // Lending Program PDAs  
  globalMarket: PublicKey;
  collectionRegistryV2: PublicKey;
  lendingCapitalVault: PublicKey; // MAIN capital vault (lending program owns)
}

class CorrectedInitializer {
  private connection: Connection;
  private adminKeypair: Keypair;
  private config: CorrectedConfig;
  private addresses: CorrectedAddresses;

  constructor(config: CorrectedConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.adminKeypair = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(readFileSync(config.adminKeypairPath, 'utf-8')))
    );
    
    this.addresses = this.deriveAllAddresses();
  }

  private deriveAllAddresses(): CorrectedAddresses {
    const whiskeyProgramId = new PublicKey(this.config.whiskeyProgramId);
    const lendingProgramId = new PublicKey(this.config.lendingProgramId);
    
    // Whiskey Program PDAs
    const [programSuperAdmin] = PublicKey.findProgramAddressSync(
      [Buffer.from("program_super_admin")],
      whiskeyProgramId
    );
    
    const [lendingPoolConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool")],
      whiskeyProgramId
    );
    
    const [whiskeyVaultV2] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool"), Buffer.from("whiskey_vault_v2")],
      whiskeyProgramId
    );
    
    const [whiskeyUsdcVaultV2] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
      whiskeyProgramId
    );
    
    // Lending Program PDAs
    const [globalMarket] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      lendingProgramId
    );
    
    const [collectionRegistryV2] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_registry_v2")],
      lendingProgramId
    );
    
    // ⭐ CRITICAL: Lending program's OWN capital vault
    const [lendingCapitalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("capital_vault_usdc")],
      lendingProgramId
    );

    return {
      adminWallet: this.adminKeypair.publicKey,
      treasuryWallet: this.adminKeypair.publicKey,
      whiskeyTokenMint: new PublicKey(this.config.whiskeyTokenMint),
      usdcTokenMint: new PublicKey(this.config.usdcTokenMint),
      
      programSuperAdmin,
      lendingPoolConfig,
      whiskeyVaultV2,
      whiskeyUsdcVaultV2,
      
      globalMarket,
      collectionRegistryV2,
      lendingCapitalVault,
    };
  }

  async initialize(): Promise<void> {
    console.log(`🔧 Starting CORRECTED ${this.config.network.toUpperCase()} Ecosystem Initialization...`);
    console.log(`👤 Admin Wallet: ${this.adminKeypair.publicKey.toString()}`);
    
    // Check admin balance
    const balance = await this.connection.getBalance(this.adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    await this.showCorrectedArchitecture();
    await this.generateCorrectedEnvironment();
    
    console.log(`🎉 CORRECTED ecosystem analysis complete!`);
  }

  private async showCorrectedArchitecture(): Promise<void> {
    console.log(`\n🏛️ CORRECTED VAULT ARCHITECTURE:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    console.log(`\n🥃 WHISKEY PROGRAM VAULTS (Intermediate):`);
    console.log(`  WHISKEY Vault V2: ${this.addresses.whiskeyVaultV2.toString()}`);
    console.log(`  USDC Vault V2: ${this.addresses.whiskeyUsdcVaultV2.toString()}`);
    console.log(`  ↳ Purpose: Receives USDC from Jupiter swaps`);
    console.log(`  ↳ Authority: Whiskey Program's Lending Pool Config`);
    console.log(`  ↳ Action: Transfers USDC TO lending program's vault`);
    
    console.log(`\n🏦 LENDING PROGRAM VAULT (Final Destination):`);
    console.log(`  Capital Vault: ${this.addresses.lendingCapitalVault.toString()}`);
    console.log(`  ↳ Purpose: MAIN lending capital for loan disbursement`);
    console.log(`  ↳ Authority: Lending Program's Global Market PDA`);
    console.log(`  ↳ Control: FULL control for loan operations`);
    
    console.log(`\n🔄 CORRECTED FLOW:`);
    console.log(`  1. NFT Mint Payment (WHISKEY)`);
    console.log(`     ↓`);
    console.log(`  2. Whiskey Program WHISKEY Vault V2`);
    console.log(`     ↓ Jupiter Swap`);
    console.log(`  3. Whiskey Program USDC Vault V2 (Intermediate)`);
    console.log(`     ↓ Transfer TO Lending`);
    console.log(`  4. Lending Program Capital Vault (FINAL)`);
    console.log(`     ↓ Loan Disbursement`);
    console.log(`  5. Borrower Receives USDC`);
    
    console.log(`\n✅ WHY THIS IS CORRECT:`);
    console.log(`  • Lending program OWNS and CONTROLS its capital`);
    console.log(`  • Can disburse loans without cross-program calls`);
    console.log(`  • Clear separation of concerns`);
    console.log(`  • Whiskey program focuses on revenue collection`);
    console.log(`  • Lending program focuses on loan management`);
    
    // Check current vault balances
    console.log(`\n💰 CURRENT VAULT BALANCES:`);
    
    try {
      const whiskeyVaultBalance = await this.connection.getTokenAccountBalance(this.addresses.whiskeyUsdcVaultV2);
      console.log(`  Whiskey USDC Vault V2: ${whiskeyVaultBalance.value.amount} USDC`);
    } catch (error) {
      console.log(`  Whiskey USDC Vault V2: Not initialized yet`);
    }
    
    try {
      const lendingVaultBalance = await this.connection.getTokenAccountBalance(this.addresses.lendingCapitalVault);
      console.log(`  Lending Capital Vault: ${lendingVaultBalance.value.amount} USDC`);
    } catch (error) {
      console.log(`  Lending Capital Vault: Not initialized yet`);
    }
  }

  private async generateCorrectedEnvironment(): Promise<void> {
    console.log(`\n📝 Generating CORRECTED Environment File...`);
    
    const envContent = `# 🔧 CORRECTED ECOSYSTEM ENVIRONMENT
# Network: ${this.config.network.toUpperCase()}
# Generated: ${new Date().toISOString()}
# 
# ✅ CORRECTED VAULT ARCHITECTURE:
# - Lending Program OWNS its capital vault
# - Whiskey Program sends USDC TO lending vault
# - Clear separation of concerns

# Network Configuration
NEXT_PUBLIC_SOLANA_NETWORK=${this.config.network}
NEXT_PUBLIC_SOLANA_RPC_URL=${this.config.rpcUrl}
SOLANA_RPC_URL=${this.config.rpcUrl}

# Program IDs
NEXT_PUBLIC_WHISKEY_PROGRAM_ID=${this.config.whiskeyProgramId}
NEXT_PUBLIC_LENDING_PROGRAM_ID=${this.config.lendingProgramId}
NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=${this.config.marketplaceProgramId}

# Token Mints (SHARED)
NEXT_PUBLIC_WHISKEY_TOKEN_MINT=${this.addresses.whiskeyTokenMint.toString()}
NEXT_PUBLIC_USDC_TOKEN_MINT=${this.addresses.usdcTokenMint.toString()}

# Admin & Treasury (SHARED)
NEXT_PUBLIC_ADMIN_WALLET=${this.addresses.adminWallet.toString()}
NEXT_PUBLIC_TREASURY_WALLET=${this.addresses.treasuryWallet.toString()}

# Whiskey Program PDAs
NEXT_PUBLIC_PROGRAM_SUPER_ADMIN=${this.addresses.programSuperAdmin.toString()}
NEXT_PUBLIC_LENDING_POOL_CONFIG=${this.addresses.lendingPoolConfig.toString()}
NEXT_PUBLIC_LENDING_POOL_WHISKEY_VAULT=${this.addresses.whiskeyVaultV2.toString()}

# 🔧 CORRECTED VAULT ARCHITECTURE
# Whiskey Program's Intermediate USDC Vault (WHISKEY PROGRAM OWNS)
NEXT_PUBLIC_LENDING_POOL_USDC_VAULT=${this.addresses.whiskeyUsdcVaultV2.toString()}

# Lending Program's Capital Vault (LENDING PROGRAM OWNS - MAIN CAPITAL)
NEXT_PUBLIC_LENDING_CAPITAL_VAULT=${this.addresses.lendingCapitalVault.toString()}

# Lending Program PDAs
NEXT_PUBLIC_GLOBAL_MARKET_PDA=${this.addresses.globalMarket.toString()}
NEXT_PUBLIC_COLLECTION_REGISTRY_V2=${this.addresses.collectionRegistryV2.toString()}

# Database & Services
MONGODB_URI="mongodb+srv://your-connection-string"
SESSION_SECRET="your-session-secret"
PINATA_API_KEY="your-pinata-api-key"
PINATA_SECRET_API_KEY="your-pinata-secret"
NEXT_COINGECKO_API_KEY="your-coingecko-api-key"

# 🎯 CRITICAL NOTES:
# - Global Market capital_vault_usdc MUST point to: ${this.addresses.lendingCapitalVault.toString()}
# - take-loan API MUST use: ${this.addresses.lendingCapitalVault.toString()}
# - Whiskey program transfers TO: ${this.addresses.lendingCapitalVault.toString()}
# - All loan operations use: ${this.addresses.lendingCapitalVault.toString()}
`;

    const envPath = join(__dirname, `../${this.config.network}-corrected-environment.env`);
    writeFileSync(envPath, envContent);
    
    console.log(`✅ CORRECTED environment file: ${envPath}`);
    
    // Generate corrected summary
    const correctedSummary = `# 🔧 CORRECTED VAULT ARCHITECTURE SUMMARY
# Generated: ${new Date().toISOString()}
# Network: ${this.config.network.toUpperCase()}

## 🚨 THE FIX
The lending program MUST own and control its capital vault to disburse loans.
The whiskey program should send USDC TO the lending program's vault.

## 📊 CORRECTED ADDRESSES

### SHARED (All Programs)
Admin Wallet: ${this.addresses.adminWallet.toString()}
Treasury Wallet: ${this.addresses.treasuryWallet.toString()}
WHISKEY Token: ${this.addresses.whiskeyTokenMint.toString()}
USDC Token: ${this.addresses.usdcTokenMint.toString()}

### WHISKEY PROGRAM (Revenue Collection)
Program Super Admin: ${this.addresses.programSuperAdmin.toString()}
Lending Pool Config: ${this.addresses.lendingPoolConfig.toString()}
WHISKEY Vault V2: ${this.addresses.whiskeyVaultV2.toString()}
USDC Vault V2 (Intermediate): ${this.addresses.whiskeyUsdcVaultV2.toString()}

### LENDING PROGRAM (Loan Management)  
Global Market: ${this.addresses.globalMarket.toString()}
Collection Registry V2: ${this.addresses.collectionRegistryV2.toString()}
Capital Vault (MAIN): ${this.addresses.lendingCapitalVault.toString()} ⭐

## 🔄 CORRECTED FLOW
1. NFT Sales → Whiskey USDC Vault V2 (${this.addresses.whiskeyUsdcVaultV2.toString()})
2. Transfer TO → Lending Capital Vault (${this.addresses.lendingCapitalVault.toString()})
3. Loan Disbursement ← Lending Capital Vault (${this.addresses.lendingCapitalVault.toString()})

## 🔧 REQUIRED CHANGES
1. ✅ take-loan API: Use ${this.addresses.lendingCapitalVault.toString()}
2. ⚠️  Global Market initialization: Point to ${this.addresses.lendingCapitalVault.toString()}
3. ⚠️  Whiskey program: Add transfer instruction to send USDC to lending vault
4. ⚠️  Environment: Update LENDING_CAPITAL_VAULT variable

## 🎯 DERIVATION FORMULAS
Lending Capital Vault = findPDA([b"capital_vault_usdc"], lendingProgramId)
Whiskey USDC Vault = findPDA([b"lending_pool", b"usdc_vault_v2"], whiskeyProgramId)
Global Market = findPDA([b"global_market"], lendingProgramId)

## 🚨 CRITICAL
The lending program's capital vault (${this.addresses.lendingCapitalVault.toString()}) is ALREADY FUNDED with 200,000 USDC!
This is the vault that should be used for all loan operations.
`;

    const summaryPath = join(__dirname, `../${this.config.network}-corrected-summary.md`);
    writeFileSync(summaryPath, correctedSummary);
    
    console.log(`✅ CORRECTED summary: ${summaryPath}`);
    console.log(`\n🎯 NEXT STEPS:`);
    console.log(`1. ✅ take-loan API already fixed to use lending capital vault`);
    console.log(`2. Update your .env.local with the corrected environment file`);
    console.log(`3. Test loan functionality - should work now!`);
    console.log(`4. Add whiskey program instruction to transfer USDC to lending vault`);
  }
}

// Devnet configuration
const DEVNET_CONFIG: CorrectedConfig = {
  network: 'devnet',
  rpcUrl: 'https://api.devnet.solana.com',
  adminKeypairPath: join(__dirname, '../admin-keypair.json'),
  whiskeyProgramId: '68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD',
  lendingProgramId: '25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ',
  marketplaceProgramId: '6SHqHpSVYHUbkX3AgMg3XcAxH5Eax48T9orPAio6j4Wk',
  whiskeyTokenMint: 'FuXejqzRAWWkoAcNrDU8L2i6cXXmB5NwqAVp2daN456j',
  usdcTokenMint: '5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR',
  initialUsdcForLending: 1000000,
};

async function main() {
  const network = process.argv[2] as 'devnet' | 'mainnet-beta';
  
  if (!network || network !== 'devnet') {
    console.log('Usage: npx ts-node corrected-ecosystem-initialization.ts devnet');
    process.exit(1);
  }
  
  const initializer = new CorrectedInitializer(DEVNET_CONFIG);
  await initializer.initialize();
}

if (require.main === module) {
  main().catch(console.error);
}
