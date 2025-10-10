#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

class LiquidationBot {
    constructor() {
        this.connection = null;
        this.program = null;
        this.liquidationKeypair = null;
        this.globalMarketPda = null;
        this.isRunning = false;
        this.cronJob = null;
        this.dryRun = process.env.LIQUIDATION_DRY_RUN === 'true';
        
        this.log('🤖 Planet Whiskey Liquidation Bot starting...');
        this.loadEnvironment();
        this.setupProgram();
        this.calculatePDAs();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logMessage);
    }

    loadEnvironment() {
        this.log('📋 Loading environment configuration...');
        
        // Validate required environment variables
        const required = [
            'SOLANA_RPC_URL',
            'LENDING_PROGRAM_ID',
            'GLOBAL_MARKET_PDA',
            'KEYPAIR'
        ];

        for (const envVar of required) {
            if (!process.env[envVar]) {
                throw new Error(`❌ Required environment variable ${envVar} is not set`);
            }
        }

        // Load liquidation keypair from environment variable
        try {
            if (!process.env.KEYPAIR) {
                throw new Error(`❌ KEYPAIR environment variable is not set`);
            }
            
            // Parse the keypair from environment variable (JSON array format)
            const liquidationSecretKey = JSON.parse(process.env.KEYPAIR);
            this.liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));
            this.log(`🔑 Loaded liquidation keypair: ${this.liquidationKeypair.publicKey.toString()}`);
        } catch (error) {
            throw new Error(`❌ Failed to load liquidation keypair: ${error.message}`);
        }
    }

    setupProgram() {
        this.log('🔗 Setting up Solana connection and program...');
        
        this.connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
        this.log('✅ Connection established');
        
        // Load IDL from JSON file
        const idlPath = path.join(__dirname, 'lib/idl/lendingprogram.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Set up Anchor provider and program
        const wallet = new Wallet(this.liquidationKeypair);
        const provider = new AnchorProvider(this.connection, wallet, {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed'
        });
        
        this.programId = new PublicKey(process.env.LENDING_PROGRAM_ID);
        this.program = new Program(idl,provider);
        
        this.log(`📋 Program initialized: ${this.programId.toString()}`);
        this.log('✅ Anchor program setup complete');
    }

    calculatePDAs() {
        this.log('🧮 Calculating PDA addresses...');
        this.globalMarketPda = new PublicKey(process.env.GLOBAL_MARKET_PDA);
        this.log(`🏦 Global Market PDA: ${this.globalMarketPda.toString()}`);
    }

    async fetchExpiredLoans() {
        try {
            this.log('🔍 Fetching all loans from the program...');
            
            // Get all loan accounts
            const loanAccounts = await this.program.account.loan.all();
            this.log(`📊 Found ${loanAccounts.length} total loans`);
            
            const currentTime = Math.floor(Date.now() / 1000);
            const expiredLoans = [];
            
            for (const loanAccount of loanAccounts) {
                const { publicKey, account } = loanAccount;
                
                // Check if loan is active and expired
                if (account.status.active && account.gracePeriodEndsTs.toNumber() < currentTime) {
                    this.log(`⏰ Found expired loan: ${publicKey.toString()}`);
                    this.log(`   Grace period ended: ${new Date(account.gracePeriodEndsTs.toNumber() * 1000).toISOString()}`);
                    this.log(`   Principal: $${(account.principalAmountUsd.toNumber() / 1000000).toFixed(2)}`);
                    
                    expiredLoans.push({
                        publicKey,
                        account,
                        borrowerAccount: account.borrowerAccount,
                        nftMint: null // We'll need to fetch this from borrower account
                    });
                }
            }
            
            this.log(`⚖️ Found ${expiredLoans.length} expired loans ready for liquidation`);
            return expiredLoans;
            
        } catch (error) {
            this.log(`❌ Error fetching loans: ${error.message}`, 'error');
            return [];
        }
    }

    async liquidateExpiredLoan(loanInfo) {
        const { publicKey: loanPda, account: loan, borrowerAccount: borrowerAccountPda } = loanInfo;
        
        try {
            this.log(`⚖️ Processing loan liquidation: ${loanPda.toString()}`);
            
            // Get borrower account to find NFT details
            const borrowerAccount = await this.program.account.borrowerAccount.fetch(borrowerAccountPda);
            this.log(`👤 Borrower: ${borrowerAccount.owner.toString()}`);
            this.log(`📊 Deposited NFTs: ${borrowerAccount.depositedNfts.length}`);
            
            if (borrowerAccount.depositedNfts.length === 0) {
                this.log(`⚠️ No NFTs found in borrower account - skipping liquidation`);
                return;
            }
            
            // For now, liquidate the first NFT (in a real implementation, you'd need to track which NFT corresponds to which loan)
            const nftMint = borrowerAccount.depositedNfts[0];
            this.log(`🎨 Liquidating NFT: ${nftMint.toString()}`);
            
            if (this.dryRun) {
                this.log(`🔍 DRY RUN: Would liquidate loan ${loanPda.toString()}`);
                this.log(`   Borrower: ${borrowerAccount.owner.toString()}`);
                this.log(`   NFT Mint: ${nftMint.toString()}`);
                this.log(`   Principal: $${(loan.principalAmountUsd.toNumber() / 1000000).toFixed(2)}`);
                this.log(`   Grace period ended: ${new Date(loan.gracePeriodEndsTs.toNumber() * 1000).toISOString()}`);
                return;
            }

            // Build liquidation instruction
            const liquidationInstruction = await this.buildLiquidationInstruction(loanPda, borrowerAccountPda, nftMint);
            
            // Create and send transaction
            const transaction = new Transaction();
            transaction.add(liquidationInstruction);
            
            const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.liquidationKeypair.publicKey;
            
            // Sign and send transaction
            transaction.sign(this.liquidationKeypair);
            
            this.log(`📤 Sending liquidation transaction...`);
            const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
                maxRetries: 3,
                preflightCommitment: 'confirmed'
            });
            
            this.log(`✅ Liquidation transaction sent: ${signature}`);
            
            // Wait for confirmation
            const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }
            
            this.log(`🔥 NFT successfully liquidated: ${nftMint.toString()}`);
            
        } catch (error) {
            this.log(`❌ Failed to liquidate loan ${loanPda.toString()}: ${error.message}`, 'error');
            throw error;
        }
    }

    async buildLiquidationInstruction(loanPda, borrowerAccountPda, nftMint) {
        try {
            this.log(`🔨 Building liquidation instruction for NFT: ${nftMint.toString()}`);
            
            // Derive NFT escrow PDA
            const [nftEscrowPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("collateral_escrow"),
                    borrowerAccountPda.toBuffer(),
                    new PublicKey(nftMint).toBuffer()
                ],
                this.programId
            );
            
            this.log(`🏦 NFT Escrow PDA: ${nftEscrowPda.toString()}`);
            
            // Build the liquidation instruction using Anchor
            const liquidationInstruction = await this.program.methods
                .liquidateExpiredLoan(loanPda)
                .accounts({
                    borrowerAccount: borrowerAccountPda,
                    globalMarket: this.globalMarketPda,
                    loan: loanPda,
                    nftMint: new PublicKey(nftMint),
                    nftEscrow: nftEscrowPda,
                    liquidator: this.liquidationKeypair.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId
                })
                .instruction();
            
            this.log(`✅ Liquidation instruction built successfully`);
            return liquidationInstruction;
            
        } catch (error) {
            this.log(`❌ Failed to build liquidation instruction: ${error.message}`, 'error');
            throw error;
        }
    }

    async processExpiredLoans() {
        try {
            // Check balance first
            await this.checkBalance();
            
            const expiredLoans = await this.fetchExpiredLoans();
            
            if (expiredLoans.length === 0) {
                this.log('✅ No expired loans found');
                return;
            }

            this.log(`⚖️ Processing ${expiredLoans.length} expired loans...`);
            
            for (const loan of expiredLoans) {
                try {
                    await this.liquidateExpiredLoan(loan);
                    // Small delay between liquidations
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    this.log(`❌ Failed to liquidate individual loan: ${error.message}`, 'error');
                    // Continue with other loans
                }
            }
            
            this.log(`✅ Completed liquidation round`);
            
        } catch (error) {
            this.log(`❌ Error in liquidation round: ${error.message}`, 'error');
        }
    }

    async checkBalance() {
        const balance = await this.connection.getBalance(this.liquidationKeypair.publicKey);
        const solBalance = balance / 1e9;
        const threshold = parseFloat(process.env.MIN_SOL_BALANCE_THRESHOLD) || 0.1;
        
        this.log(`💰 Liquidator balance: ${solBalance.toFixed(6)} SOL`);
        
        if (solBalance < threshold) {
            this.log(`⚠️ Low balance warning: ${solBalance.toFixed(6)} SOL < ${threshold} SOL threshold`, 'warn');
        }
    }

    async start() {
        if (this.isRunning) {
            this.log('⚠️ Bot is already running', 'warn');
            return;
        }

        try {
            this.log('🚀 Starting liquidation bot...');
            
            // Initial health check
            await this.checkBalance();
            
            // Test connection
            const slot = await this.connection.getSlot();
            this.log(`🔗 Connected to Solana, current slot: ${slot}`);
            
            const intervalMinutes = parseInt(process.env.LIQUIDATION_CHECK_INTERVAL_MINUTES) || 5;
            this.log(`⏰ Setting up cron job to run every ${intervalMinutes} minutes`);
            
            // Set up cron job
            this.cronJob = cron.schedule(`*/${intervalMinutes} * * * *`, () => {
                this.processExpiredLoans();
            }, {
                scheduled: false
            });
            
            this.cronJob.start();
            this.isRunning = true;
            
            this.log(`✅ Liquidation bot started successfully`);
            this.log(`🔍 Dry run mode: ${this.dryRun ? 'ENABLED' : 'DISABLED'}`);
            
            // Run initial check
            setTimeout(() => {
                this.processExpiredLoans();
            }, 5000);
            
            // Graceful shutdown handlers
            process.on('SIGINT', () => {
                this.log('📝 Received SIGINT, shutting down gracefully...');
                this.stop();
                process.exit(0);
            });

            process.on('SIGTERM', () => {
                this.log('📝 Received SIGTERM, shutting down gracefully...');
                this.stop();
                process.exit(0);
            });
            
        } catch (error) {
            this.log(`❌ Failed to start bot: ${error.message}`, 'error');
            throw error;
        }
    }

    stop() {
        if (!this.isRunning) {
            this.log('⚠️ Bot is not running', 'warn');
            return;
        }

        this.log('🛑 Stopping liquidation bot...');
        
        if (this.cronJob) {
            this.cronJob.stop();
            // Note: destroy() method doesn't exist in node-cron, stop() is sufficient
        }
        
        this.isRunning = false;
        this.log('✅ Liquidation bot stopped');
    }
}

// Main execution
async function main() {
    try {
        const bot = new LiquidationBot();
        await bot.start();
        
        // Keep the process alive
        setInterval(() => {
            // Health check ping
        }, 30000);
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default LiquidationBot;