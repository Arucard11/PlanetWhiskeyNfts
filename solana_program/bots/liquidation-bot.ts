#!/usr/bin/env ts-node

import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Lendingprogram } from '../../planet-whiskey-nfts/src/lib/idl/lendingprogram';
import fs from 'fs';
import path from 'path';

interface LoanInfo {
  publicKey: PublicKey;
  account: any;
}

class LiquidationBot {
  private connection: Connection;
  private program: anchor.Program<Lendingprogram>;
  private liquidationKeypair: Keypair;
  private globalMarketPda: PublicKey;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadEnvironment();
    this.setupProgram();
    this.calculatePDAs();
  }

  private loadEnvironment() {
    // Load environment variables
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Load dedicated liquidation keypair
    const liquidationKeypairPath = path.join(__dirname, '../liquidation-keypair.json');
    const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
    this.liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));

    console.log('🤖 Liquidation Bot initialized');
    console.log('  RPC URL:', rpcUrl);
    console.log('  Liquidation Authority:', this.liquidationKeypair.publicKey.toString());
  }

  private setupProgram() {
    const lendingProgramId = process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!;
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.liquidationKeypair),
      {}
    );

    // Load IDL
    const idlPath = path.join(__dirname, '../../planet-whiskey-nfts/src/lib/idl/lendingprogram.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    this.program = new anchor.Program<Lendingprogram>(idl, provider);
  }

  private calculatePDAs() {
    const lendingProgramId = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
    
    [this.globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      lendingProgramId
    );

    console.log('📍 Global Market PDA:', this.globalMarketPda.toString());
  }

  private async fetchExpiredLoans(): Promise<LoanInfo[]> {
    try {
      console.log('🔍 Scanning for expired loans...');
      
      // Fetch all loan accounts
      const loanAccounts = await this.program.account.loan.all();
      console.log(`Found ${loanAccounts.length} total loans`);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const expiredLoans: LoanInfo[] = [];

      for (const loanAccount of loanAccounts) {
        const loan = loanAccount.account;
        
        // Check if loan is expired (past grace period)
        if (this.isLoanExpired(loan, currentTimestamp)) {
          console.log(`🚨 EXPIRED LOAN FOUND: ${loanAccount.publicKey.toString()}`);
          console.log(`  Borrower: ${loan.borrowerAccount.toString()}`);
          console.log(`  Grace period ended: ${new Date(loan.gracePeriodEndsTs.toNumber() * 1000).toISOString()}`);
          console.log(`  Status: ${loan.status}`);
          
          expiredLoans.push({
            publicKey: loanAccount.publicKey,
            account: loan
          });
        }
      }

      console.log(`⚠️  Found ${expiredLoans.length} expired loans ready for liquidation`);
      return expiredLoans;

    } catch (error) {
      console.error('❌ Error fetching expired loans:', error);
      return [];
    }
  }

  private isLoanExpired(loan: any, currentTimestamp: number): boolean {
    // Loan is expired if current time is past grace period end time
    return currentTimestamp > loan.gracePeriodEndsTs && loan.status.active;
  }

  private async liquidateExpiredLoan(loanInfo: LoanInfo): Promise<void> {
    try {
      const loan = loanInfo.account;
      console.log(`🔥 Starting liquidation for loan: ${loanInfo.publicKey.toString()}`);

      // Get borrower account to find deposited NFTs
      const borrowerAccount = await this.program.account.borrowerAccount.fetch(loan.borrowerAccount);
      
      if (borrowerAccount.depositedNfts.length === 0) {
        console.log('⚠️  No NFTs to liquidate for this loan');
        return;
      }

      // Liquidate the first deposited NFT (in a real implementation, you might want to liquidate all)
      const nftMint = borrowerAccount.depositedNfts[0];
      console.log(`🔥 Liquidating NFT: ${nftMint.toString()}`);

      // Derive necessary PDAs
      const borrowerWallet = borrowerAccount.owner;
      const [nftEscrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collateral_escrow'), borrowerWallet.toBuffer(), nftMint.toBuffer()],
        this.program.programId
      );

      // Build liquidation transaction
      const instruction = await this.program.methods
        .liquidateExpiredLoan(loanInfo.publicKey)
        .accounts({
          borrowerAccount: loan.borrowerAccount,
          globalMarket: this.globalMarketPda,
          loan: loanInfo.publicKey,
          nftMint: nftMint,
          nftEscrow: nftEscrowPda,
          liquidator: this.liquidationKeypair.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        } as any)
        .instruction();

      const transaction = new Transaction().add(instruction);
      transaction.feePayer = this.liquidationKeypair.publicKey;

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign and send transaction
      transaction.sign(this.liquidationKeypair);
      const signature = await this.connection.sendRawTransaction(transaction.serialize());
      
      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err.toString()}`);
      }

      console.log('🔥 NFT BURNED - Liquidation completed!');
      console.log(`  Transaction: ${signature}`);
      console.log(`  NFT Mint: ${nftMint.toString()}`);
      console.log(`  Loan: ${loanInfo.publicKey.toString()}`);

    } catch (error) {
      console.error('❌ Error liquidating loan:', error);
      console.error(`  Loan ID: ${loanInfo.publicKey.toString()}`);
    }
  }

  private async processExpiredLoans(): Promise<void> {
    try {
      const expiredLoans = await this.fetchExpiredLoans();
      
      if (expiredLoans.length === 0) {
        console.log('✅ No expired loans found - all loans are healthy');
        return;
      }

      console.log(`🔥 Processing ${expiredLoans.length} expired loans for liquidation...`);
      
      for (const loanInfo of expiredLoans) {
        await this.liquidateExpiredLoan(loanInfo);
        
        // Add a small delay between liquidations to avoid overwhelming the network
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('❌ Error processing expired loans:', error);
    }
  }

  private async checkBalance(): Promise<void> {
    try {
      const balance = await this.connection.getBalance(this.liquidationKeypair.publicKey);
      const balanceSOL = balance / anchor.web3.LAMPORTS_PER_SOL;
      
      if (balanceSOL < 0.1) {
        console.warn('⚠️  LOW BALANCE WARNING: Liquidation wallet has insufficient SOL for transactions');
        console.warn(`  Current balance: ${balanceSOL.toFixed(4)} SOL`);
      }
    } catch (error) {
      console.error('❌ Error checking balance:', error);
    }
  }

  public async start(intervalMinutes: number = 5): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Liquidation bot is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting liquidation bot with ${intervalMinutes}-minute intervals`);
    
    // Initial balance check
    await this.checkBalance();
    
    // Initial scan
    await this.processExpiredLoans();

    // Set up periodic scanning
    this.checkInterval = setInterval(async () => {
      console.log(`\n⏰ [${new Date().toISOString()}] Running periodic liquidation check...`);
      await this.checkBalance();
      await this.processExpiredLoans();
    }, intervalMinutes * 60 * 1000);

    console.log('🤖 Liquidation bot is now running...');
    console.log('   Press Ctrl+C to stop');
  }

  public stop(): void {
    if (!this.isRunning) {
      console.log('🤖 Liquidation bot is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log('🛑 Liquidation bot stopped');
  }
}

// Main execution
async function main() {
  const bot = new LiquidationBot();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  // Start the bot with 5-minute intervals
  await bot.start(5);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { LiquidationBot };
