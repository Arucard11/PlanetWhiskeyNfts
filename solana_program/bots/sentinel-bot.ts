#!/usr/bin/env ts-node

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lendingprogram } from "../target/types/lendingprogram";
import { 
  PublicKey, 
  Keypair, 
  Connection,
  clusterApiUrl,
  GetProgramAccountsFilter
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import fs from 'fs';
import path from 'path';

// Configuration
const NETWORK = process.env.ANCHOR_WALLET || "devnet";
const RPC_URL = process.env.RPC_URL || clusterApiUrl("devnet");
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

interface LoanInfo {
  publicKey: PublicKey;
  account: any;
}

class SentinelBot {
  private connection: Connection;
  private program: Program<Lendingprogram>;
  private globalMarketOwnerKeypair: Keypair;
  private globalMarketPda: PublicKey;
  private deploymentInfo: any;

  constructor() {
    this.connection = new Connection(RPC_URL, "confirmed");
    this.loadDeploymentInfo();
    this.loadGlobalMarketOwnerKeypair();
    this.setupProgram();
    this.calculatePDAs();
  }

  private loadDeploymentInfo() {
    const deploymentPath = path.join(__dirname, "../project-stardust-deployment.json");
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error("Deployment info not found. Please run the deployment script first.");
    }

    this.deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log(`📋 Loaded deployment info for program: ${this.deploymentInfo.programId}`);
  }

  private loadGlobalMarketOwnerKeypair() {
    const adminKeypairPath = path.join(__dirname, "../admin-keypair.json");
    
    if (!fs.existsSync(adminKeypairPath)) {
      throw new Error("Admin keypair not found. Please run the deployment script first.");
    }

    const adminKeypairData = JSON.parse(fs.readFileSync(adminKeypairPath, "utf8"));
    this.globalMarketOwnerKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
    
    console.log(`👤 Global Market Owner: ${this.globalMarketOwnerKeypair.publicKey.toString()}`);
  }

  private setupProgram() {
    const wallet = new anchor.Wallet(this.globalMarketOwnerKeypair);
    const provider = new anchor.AnchorProvider(this.connection, wallet, {});
    anchor.setProvider(provider);

    this.program = anchor.workspace.Lendingprogram as Program<Lendingprogram>;
    console.log(`📋 Program ID: ${this.program.programId.toString()}`);
  }

  private calculatePDAs() {
    [this.globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      this.program.programId
    );
    console.log(`🌍 Global Market PDA: ${this.globalMarketPda.toString()}`);
  }

  // Fetch all active loans
  private async fetchActiveLoans(): Promise<LoanInfo[]> {
    try {
      const filters: GetProgramAccountsFilter[] = [
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: anchor.utils.bytes.bs58.encode(Buffer.from([0])), // LoanStatus::Active = 0
          },
        },
      ];

      const loanAccounts = await this.connection.getProgramAccounts(
        this.program.programId,
        {
          filters,
          dataSlice: { offset: 0, length: 0 }, // Get full account data
        }
      );

      const loans: LoanInfo[] = [];
      
      for (const { pubkey, account } of loanAccounts) {
        try {
          const loanData = await this.program.account.loan.fetch(pubkey);
          
          // Only include loans with Active status
          if (loanData.status && 'active' in loanData.status) {
            loans.push({
              publicKey: pubkey,
              account: loanData,
            });
          }
        } catch (error) {
          // Skip accounts that can't be parsed as loans
          continue;
        }
      }

      return loans;
    } catch (error) {
      console.error("Error fetching active loans:", error);
      return [];
    }
  }

  // Check if a loan is expired
  private isLoanExpired(loan: any, currentTimestamp: number): boolean {
    const loanEndTime = loan.startTs.toNumber() + loan.durationSecs;
    return currentTimestamp > loanEndTime;
  }

  // Check if a loan is defaultable (past grace period)
  private isLoanDefaultable(loan: any, currentTimestamp: number): boolean {
    return currentTimestamp > loan.gracePeriodEndsTs.toNumber();
  }

  // Get treasury vault for the loan's asset
  private getTreasuryVault(assetMint: PublicKey): PublicKey {
    const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const usdtMint = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

    if (assetMint.equals(usdcMint)) {
      return new PublicKey(this.deploymentInfo.treasuryVaults.usdc);
    } else if (assetMint.equals(usdtMint)) {
      return new PublicKey(this.deploymentInfo.treasuryVaults.usdt);
    } else {
      throw new Error(`Unknown asset mint: ${assetMint.toString()}`);
    }
  }

  // Get asset vault for the loan's asset
  private getAssetVault(assetMint: PublicKey): PublicKey {
    const usdcMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const usdtMint = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

    if (assetMint.equals(usdcMint)) {
      return new PublicKey(this.deploymentInfo.assetVaults.usdc);
    } else if (assetMint.equals(usdtMint)) {
      return new PublicKey(this.deploymentInfo.assetVaults.usdt);
    } else {
      throw new Error(`Unknown asset mint: ${assetMint.toString()}`);
    }
  }

  // Trigger default on a loan
  private async triggerDefault(loanInfo: LoanInfo): Promise<void> {
    try {
      const loan = loanInfo.account;
      console.log(`⚠️ Triggering default for loan: ${loanInfo.publicKey.toString()}`);
      console.log(`   Borrower: ${loan.owner.toString()}`);
      console.log(`   NFT: ${loan.collateralNftMint.toString()}`);
      console.log(`   Principal: ${loan.principalAmount.toString()}`);

      // Calculate PDAs
      const [lendingReservePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_reserve"), loan.assetMint.toBuffer()],
        this.program.programId
      );

      const [collateralEscrowPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("collateral_escrow"),
          loan.owner.toBuffer(),
          loan.collateralNftMint.toBuffer()
        ],
        this.program.programId
      );

      // Get treasury and asset vaults
      const treasuryVault = this.getTreasuryVault(loan.assetMint);
      const assetVault = this.getAssetVault(loan.assetMint);

      // Create protocol NFT vault (where seized NFTs go)
      const protocolNftVault = getAssociatedTokenAddressSync(
        loan.collateralNftMint,
        this.globalMarketOwnerKeypair.publicKey
      );

      const txSignature = await this.program.methods
        .triggerDefault()
        .accounts({
          loan: loanInfo.publicKey,
          lendingReserve: lendingReservePda,
          assetVault: assetVault,
          treasuryVault: treasuryVault,
          collateralEscrow: collateralEscrowPda,
          protocolNftVault: protocolNftVault,
          globalMarketOwner: this.globalMarketOwnerKeypair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([this.globalMarketOwnerKeypair])
        .rpc();

      console.log(`✅ Default triggered successfully!`);
      console.log(`🔗 Transaction: https://explorer.solana.com/tx/${txSignature}?cluster=${NETWORK}`);
      console.log(`🏦 Protocol now owns NFT: ${loan.collateralNftMint.toString()}`);

    } catch (error) {
      console.error(`❌ Error triggering default for loan ${loanInfo.publicKey.toString()}:`, error);
    }
  }

  // Main monitoring cycle
  private async monitorLoans(): Promise<void> {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      console.log(`\n⏰ ${new Date().toISOString()} - Checking loan health...`);

      const activeLoans = await this.fetchActiveLoans();
      console.log(`📊 Found ${activeLoans.length} active loans`);

      if (activeLoans.length === 0) {
        console.log("✅ No active loans to monitor");
        return;
      }

      let expiredLoans = 0;
      let defaultableLoans = 0;

      for (const loanInfo of activeLoans) {
        const loan = loanInfo.account;
        
        if (this.isLoanExpired(loan, currentTimestamp)) {
          expiredLoans++;
          
          if (this.isLoanDefaultable(loan, currentTimestamp)) {
            defaultableLoans++;
            console.log(`🚨 Loan ${loanInfo.publicKey.toString()} is defaultable!`);
            await this.triggerDefault(loanInfo);
          } else {
            const timeToDefault = loan.gracePeriodEndsTs.toNumber() - currentTimestamp;
            console.log(`⏳ Loan ${loanInfo.publicKey.toString()} expired, ${Math.floor(timeToDefault / 3600)}h ${Math.floor((timeToDefault % 3600) / 60)}m until default`);
          }
        }
      }

      console.log(`📈 Loan Status Summary:`);
      console.log(`   Active: ${activeLoans.length}`);
      console.log(`   Expired: ${expiredLoans}`);
      console.log(`   Defaulted: ${defaultableLoans}`);

    } catch (error) {
      console.error("❌ Error monitoring loans:", error);
    }
  }

  // Check if sentinel has sufficient SOL for transactions
  private async checkBalance(): Promise<void> {
    const balance = await this.connection.getBalance(this.globalMarketOwnerKeypair.publicKey);
    const solBalance = balance / anchor.web3.LAMPORTS_PER_SOL;
    
    console.log(`💰 Sentinel Balance: ${solBalance.toFixed(4)} SOL`);
    
    if (solBalance < 0.1) {
      console.warn("⚠️ Low SOL balance! Sentinel may fail to submit transactions.");
      console.warn("Please fund the sentinel account:", this.globalMarketOwnerKeypair.publicKey.toString());
    }
  }

  // Start the bot
  public async start(): Promise<void> {
    console.log("🚀 Starting Sentinel Bot...");
    console.log(`🔄 Check interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
    
    await this.checkBalance();

    // Initial check
    await this.monitorLoans();

    // Set up recurring checks
    setInterval(async () => {
      await this.monitorLoans();
      
      // Check balance every 10 minutes
      if (Date.now() % (10 * 60 * 1000) < CHECK_INTERVAL_MS) {
        await this.checkBalance();
      }
    }, CHECK_INTERVAL_MS);

    console.log("🤖 Sentinel Bot is running...");
    console.log("Press Ctrl+C to stop");
  }

  // Graceful shutdown
  public stop(): void {
    console.log("\n🛑 Stopping Sentinel Bot...");
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

// Main execution
async function main() {
  try {
    const bot = new SentinelBot();
    await bot.start();
  } catch (error) {
    console.error("❌ Failed to start Sentinel Bot:", error);
    process.exit(1);
  }
}

// Run only if this file is executed directly
if (require.main === module) {
  main();
}

export { SentinelBot };
