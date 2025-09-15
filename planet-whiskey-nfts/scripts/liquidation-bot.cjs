#!/usr/bin/env node

// JavaScript version of liquidation bot for testing
const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

class LiquidationBot {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.processId = process.pid;
    console.log(`🤖 Initializing Liquidation Bot (PID: ${this.processId})`);
    this.loadEnvironment();
    this.setupProgram();
    this.calculatePDAs();
  }

  loadEnvironment() {
    // Load environment variables
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Load dedicated liquidation keypair
    const liquidationKeypairPath = path.join(__dirname, 'liquidation-keypair.json');
    const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
    this.liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));

    console.log('🤖 Liquidation Bot initialized');
    console.log('  RPC URL:', rpcUrl);
    console.log('  Liquidation Authority:', this.liquidationKeypair.publicKey.toString());
  }

  setupProgram() {
    const lendingProgramId = process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6';
    
    if (!lendingProgramId) {
      throw new Error('NEXT_PUBLIC_LENDING_PROGRAM_ID environment variable is required');
    }
    
    console.log('  Lending Program ID:', lendingProgramId);
    
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.liquidationKeypair),
      {}
    );

    // Load IDL
    const idlPath = path.join(__dirname, '../src/lib/idl/lendingprogram.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    this.program = new anchor.Program(idl, provider);
  }

  calculatePDAs() {
    const lendingProgramId = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6');
    
    [this.globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      lendingProgramId
    );

    console.log('📍 Global Market PDA:', this.globalMarketPda.toString());
  }

  async fetchExpiredLoans() {
    try {
      console.log('🔍 Scanning for expired loans...');
      
      // Fetch all loan accounts
      const loanAccounts = await this.program.account.loan.all();
      console.log(`Found ${loanAccounts.length} total loans`);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const expiredLoans = [];

      for (const loanAccount of loanAccounts) {
        const loan = loanAccount.account;
        
        // Check if loan is expired (past grace period)
        if (this.isLoanExpired(loan, currentTimestamp)) {
          console.log(`🚨 EXPIRED LOAN FOUND: ${loanAccount.publicKey.toString()}`);
          console.log(`  Borrower: ${loan.borrowerAccount.toString()}`);
          console.log(`  Grace period ended: ${new Date(loan.gracePeriodEndsTs.toNumber() * 1000).toISOString()}`);
          console.log(`  Status: ${Object.keys(loan.status)[0]}`);
          
          expiredLoans.push({
            publicKey: loanAccount.publicKey,
            account: loan
          });
        } else {
          const timeRemaining = loan.gracePeriodEndsTs.toNumber() - currentTimestamp;
          console.log(`✅ Active loan: ${loanAccount.publicKey.toString()}`);
          console.log(`  Time remaining: ${Math.floor(timeRemaining / 3600)} hours`);
        }
      }

      console.log(`⚠️  Found ${expiredLoans.length} expired loans ready for liquidation`);
      return expiredLoans;

    } catch (error) {
      console.error('❌ Error fetching expired loans:', error);
      return [];
    }
  }

  isLoanExpired(loan, currentTimestamp) {
    // Loan is expired if current time is past grace period end time
    const isActive = Object.keys(loan.status)[0] === 'active';
    const isPastGracePeriod = currentTimestamp > loan.gracePeriodEndsTs.toNumber();
    return isActive && isPastGracePeriod;
  }

  async liquidateExpiredLoan(loanInfo) {
    try {
      const loan = loanInfo.account;
      console.log(`🔥 Starting liquidation for loan: ${loanInfo.publicKey.toString()}`);

      // Get borrower account to find deposited NFTs
      const borrowerAccount = await this.program.account.borrowerAccount.fetch(loan.borrowerAccount);
      
      if (borrowerAccount.depositedNfts.length === 0) {
        console.log('⚠️  No NFTs to liquidate for this loan');
        return;
      }

      // Liquidate the first deposited NFT
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
          systemProgram: anchor.web3.SystemProgram.programId,
        })
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

  async processExpiredLoans() {
    try {
      const expiredLoans = await this.fetchExpiredLoans();
      
      if (expiredLoans.length === 0) {
        console.log('✅ No expired loans found - all loans are healthy');
        return;
      }

      console.log(`🔥 Processing ${expiredLoans.length} expired loans for liquidation...`);
      
      for (const loanInfo of expiredLoans) {
        await this.liquidateExpiredLoan(loanInfo);
        
        // Add a small delay between liquidations
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error('❌ Error processing expired loans:', error);
    }
  }

  async checkBalance() {
    try {
      const balance = await this.connection.getBalance(this.liquidationKeypair.publicKey);
      const balanceSOL = balance / anchor.web3.LAMPORTS_PER_SOL;
      
      console.log(`💰 Liquidation wallet balance: ${balanceSOL.toFixed(4)} SOL`);
      
      if (balanceSOL < 0.1) {
        console.warn('⚠️  LOW BALANCE WARNING: Liquidation wallet has insufficient SOL for transactions');
      }
    } catch (error) {
      console.error('❌ Error checking balance:', error);
    }
  }

  async runOnce() {
    console.log(`\n⏰ [${new Date().toISOString()}] [PID:${this.processId}] Running liquidation check...`);
    await this.checkBalance();
    await this.processExpiredLoans();
  }

  async start(intervalMinutes = 5) {
    if (this.isRunning) {
      console.log('🤖 Liquidation bot is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`🚀 Starting liquidation bot with ${intervalMinutes}-minute intervals (${intervalMs}ms)`);
    console.log(`📍 Current time: ${new Date().toISOString()}`);
    console.log(`⏰ Next check will be at: ${new Date(Date.now() + intervalMs).toISOString()}`);
    
    try {
      // Initial run
      console.log('🔥 Performing initial liquidation check...');
      await this.runOnce();
      console.log('✅ Initial check completed');

      // Set up periodic scanning
      this.checkInterval = setInterval(async () => {
        try {
          const nextCheckTime = new Date(Date.now() + intervalMs).toISOString();
          console.log(`\n📅 Next liquidation check scheduled for: ${nextCheckTime}`);
          await this.runOnce();
        } catch (error) {
          console.error('❌ Error during scheduled liquidation check:', error);
        }
      }, intervalMs);

      console.log('🤖 Liquidation bot is now running continuously...');
      console.log(`   Checking every ${intervalMinutes} minutes`);
      console.log('   Press Ctrl+C to stop');
      
      // Keep the process alive
      process.stdin.resume();
      
    } catch (error) {
      console.error('❌ Error starting liquidation bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  stop() {
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
  console.log(`🚀 Starting Liquidation Bot (PID: ${process.pid}) at ${new Date().toISOString()}`);
  
  const bot = new LiquidationBot();

  // Handle graceful shutdown
  const cleanup = () => {
    console.log('\n🛑 Shutting down liquidation bot gracefully...');
    bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // For testing, just run once instead of continuous monitoring
  if (process.argv.includes('--once')) {
    console.log('🧪 Running liquidation bot once for testing...');
    await bot.runOnce();
    console.log('✅ Test run completed');
    process.exit(0);
  } else {
    // Start the bot with 5-minute intervals
    console.log('⏰ Starting continuous monitoring with 5-minute intervals...');
    await bot.start(5);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { LiquidationBot };
