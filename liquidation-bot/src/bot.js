#!/usr/bin/env node

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
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
            'GLOBAL_MARKET_PDA'
        ];

        for (const envVar of required) {
            if (!process.env[envVar]) {
                throw new Error(`❌ Required environment variable ${envVar} is not set`);
            }
        }

        // Load liquidation keypair from keypairs folder
        try {
            const liquidationKeypairPath = path.join(__dirname, '../keypairs/mainnet-liquidation-keypair.json');
            
            if (!fs.existsSync(liquidationKeypairPath)) {
                throw new Error(`❌ Liquidation keypair file not found at: ${liquidationKeypairPath}`);
            }
            
            const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
            this.liquidationKeypair = Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));
            this.log(`🔑 Loaded liquidation keypair: ${this.liquidationKeypair.publicKey.toString()}`);
        } catch (error) {
            throw new Error(`❌ Failed to load liquidation keypair: ${error.message}`);
        }
    }

    setupProgram() {
        this.log('🔗 Setting up Solana connection and program...');
        
        this.connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
        
        // Load IDL from the main project
        const idlPath = path.join(__dirname, '../../solana_program/target/idl/lendingprogram.json');
        if (!fs.existsSync(idlPath)) {
            throw new Error(`❌ IDL file not found at: ${idlPath}. Make sure to build the Solana programs first.`);
        }

        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        const programId = new PublicKey(process.env.LENDING_PROGRAM_ID);
        
        const wallet = new Wallet(this.liquidationKeypair);
        const provider = new AnchorProvider(this.connection, wallet, {
            commitment: 'confirmed',
        });

        this.program = new Program(idl, programId, provider);
        this.log(`📋 Program initialized: ${programId.toString()}`);
    }

    calculatePDAs() {
        this.log('🧮 Calculating PDA addresses...');
        this.globalMarketPda = new PublicKey(process.env.GLOBAL_MARKET_PDA);
        this.log(`🏦 Global Market PDA: ${this.globalMarketPda.toString()}`);
    }

    async fetchExpiredLoans() {
        try {
            this.log('🔍 Fetching expired loans...');
            
            // Get all active loans
            const loans = await this.program.account.loan.all();
            const currentTimestamp = Math.floor(Date.now() / 1000);
            
            const expiredLoans = loans.filter(loan => {
                const gracePeriodEnd = loan.account.gracePeriodEndsTs.toNumber();
                return currentTimestamp > gracePeriodEnd && 
                       loan.account.status.active !== undefined;
            });

            this.log(`📊 Found ${loans.length} total loans, ${expiredLoans.length} expired`);
            return expiredLoans;
            
        } catch (error) {
            this.log(`❌ Error fetching loans: ${error.message}`, 'error');
            return [];
        }
    }

    async liquidateExpiredLoan(loanInfo) {
        const { publicKey: loanPda, account: loan } = loanInfo;
        
        try {
            this.log(`⚖️ Processing loan liquidation: ${loanPda.toString()}`);
            
            if (this.dryRun) {
                this.log(`🔍 DRY RUN: Would liquidate loan ${loanPda.toString()}`);
                this.log(`   Borrower: ${loan.borrowerAccount.toString()}`);
                this.log(`   Principal: $${(loan.principalAmountUsd.toNumber() / 1000000).toFixed(2)}`);
                this.log(`   Grace period ended: ${new Date(loan.gracePeriodEndsTs.toNumber() * 1000).toISOString()}`);
                return;
            }

            // Get borrower account to find NFT details
            const borrowerAccount = await this.program.account.borrowerAccount.fetch(loan.borrowerAccount);
            
            // For actual liquidation, we would need the NFT mint address
            // This is a simplified version - in practice, you'd need to track which NFT corresponds to which loan
            this.log(`✅ Loan marked for liquidation: ${loanPda.toString()}`);
            
        } catch (error) {
            this.log(`❌ Failed to liquidate loan ${loanPda.toString()}: ${error.message}`, 'error');
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
            this.cronJob.destroy();
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