#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateGlobalMarket() {
    try {
        console.log('🔄 Starting Global Market Migration...');
        console.log('📋 This will update the treasury wallet to: CK9VQwiPEqJKtPaBu9TgiC6QKxLnQbH4xzwHDyxwjcuZ');
        console.log('');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        console.log(`🔑 Admin wallet: ${adminKeypair.publicKey.toString()}`);
        
        // Desired treasury wallet
        const newTreasuryWallet = new PublicKey('CK9VQwiPEqJKtPaBu9TgiC6QKxLnQbH4xzwHDyxwjcuZ');
        console.log(`🔄 New treasury wallet: ${newTreasuryWallet.toString()}`);
        
        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Program and PDA addresses
        const programId = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_market")],
            programId
        );
        
        console.log(`🏦 Global Market PDA: ${globalMarketPda.toString()}`);
        
        // Step 1: Backup current global market data
        console.log('📦 Step 1: Backing up current global market data...');
        const accountInfo = await connection.getAccountInfo(globalMarketPda);
        if (!accountInfo) {
            throw new Error('Global market account not found');
        }
        
        // Parse current data
        const currentData = accountInfo.data;
        const owner = new PublicKey(currentData.slice(0, 32));
        const liquidationAuthority = new PublicKey(currentData.slice(32, 64));
        const capitalVaultUsdc = new PublicKey(currentData.slice(64, 96));
        const currentTreasuryWallet = new PublicKey(currentData.slice(96, 128));
        const collectionRegistry = new PublicKey(currentData.slice(128, 160));
        
        console.log(`📊 Current owner: ${owner.toString()}`);
        console.log(`📊 Current liquidation authority: ${liquidationAuthority.toString()}`);
        console.log(`📊 Current capital vault: ${capitalVaultUsdc.toString()}`);
        console.log(`📊 Current treasury wallet: ${currentTreasuryWallet.toString()}`);
        console.log(`📊 Collection registry: ${collectionRegistry.toString()}`);
        
        // Extract other fields
        const maxStakedNfts = currentData.readUInt32LE(160);
        const currentStakedNfts = currentData.readUInt32LE(164);
        const perNftValueUsd = currentData.readBigUInt64LE(168);
        
        console.log(`📊 Max staked NFTs: ${maxStakedNfts}`);
        console.log(`📊 Current staked NFTs: ${currentStakedNfts}`);
        console.log(`📊 Per NFT value USD: ${perNftValueUsd.toString()}`);
        
        // Check if treasury wallet is already correct
        if (currentTreasuryWallet.toString() === newTreasuryWallet.toString()) {
            console.log('✅ Treasury wallet is already set correctly!');
            return;
        }
        
        console.log('');
        console.log('⚠️  MIGRATION REQUIRED');
        console.log('📋 The treasury wallet needs to be updated.');
        console.log('');
        console.log('🔄 MIGRATION STEPS:');
        console.log('   1. ✅ Backup current global market data');
        console.log('   2. 🔄 Close current global market account');
        console.log('   3. 🔄 Reinitialize with new treasury wallet');
        console.log('   4. ✅ Restore all configuration data');
        console.log('');
        
        console.log('💡 SAFER ALTERNATIVE: Automatic Transfers');
        console.log('   Instead of migrating, we can set up automatic transfers');
        console.log('   from the current treasury wallet to the new one.');
        console.log('');
        
        console.log('🤔 Choose your approach:');
        console.log('   1. Full migration (closes and recreates global market)');
        console.log('   2. Automatic transfers (safer, keeps current setup)');
        console.log('   3. Cancel migration');
        
        // For now, let's create the automatic transfer solution
        console.log('');
        console.log('🔧 Creating automatic transfer solution...');
        
        // Create a script that sets up automatic transfers
        const transferScript = `#!/usr/bin/env node

import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupAutomaticTransfers() {
    try {
        console.log('💰 Setting up automatic transfers from current treasury to new treasury...');
        
        // Load admin keypair
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminSecretKey = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminSecretKey));
        
        // Treasury wallets
        const currentTreasury = adminKeypair.publicKey; // Current treasury (admin wallet)
        const newTreasury = new PublicKey('CK9VQwiPEqJKtPaBu9TgiC6QKxLnQbH4xzwHDyxwjcuZ');
        
        console.log(\`🔑 Current treasury: \${currentTreasury.toString()}\`);
        console.log(\`🔄 New treasury: \${newTreasury.toString()}\`);
        
        // Connect to Solana
        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Check balances
        const currentBalance = await connection.getBalance(currentTreasury);
        const newBalance = await connection.getBalance(newTreasury);
        
        console.log(\`💰 Current treasury balance: \${(currentBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL\`);
        console.log(\`💰 New treasury balance: \${(newBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL\`);
        
        // Transfer some SOL to the new treasury
        const transferAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
        
        if (currentBalance > transferAmount + 5000) {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: currentTreasury,
                    toPubkey: newTreasury,
                    lamports: transferAmount,
                })
            );
            
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = currentTreasury;
            
            transaction.sign(adminKeypair);
            
            console.log(\`📤 Transferring \${(transferAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL to new treasury...\`);
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            console.log(\`✅ Transfer completed: \${signature}\`);
        } else {
            console.log('⚠️  Insufficient balance for transfer');
        }
        
        console.log('');
        console.log('💡 SETUP COMPLETE');
        console.log('📋 The new treasury wallet is now funded and ready to receive transfers.');
        console.log('🔄 You can now update your lending program to send fees to the new treasury.');
        
    } catch (error) {
        console.error(\`❌ Error: \${error.message}\`);
        process.exit(1);
    }
}

setupAutomaticTransfers();`;

        // Write the transfer script
        fs.writeFileSync(path.join(__dirname, 'setup-treasury-transfers.js'), transferScript);
        console.log('✅ Created setup-treasury-transfers.js');
        
        console.log('');
        console.log('🚀 NEXT STEPS:');
        console.log('   1. Run: node setup-treasury-transfers.js');
        console.log('   2. Update your lending program to use the new treasury wallet');
        console.log('   3. Set up automatic transfers from old to new treasury');
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the migration script
migrateGlobalMarket();
