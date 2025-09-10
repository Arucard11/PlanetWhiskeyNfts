#!/usr/bin/env node

const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  getAccount
} = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../devnet-complete-environment.env') });

async function main() {
  console.log('🏦 Funding Capital Vault with USDC...');
  
  // Setup connection
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');
  
  // Load admin keypair from Solana config (the correct admin wallet)
  const adminKeypairPath = path.join(require('os').homedir(), '.config/solana/admin-keypair.json');
  if (!fs.existsSync(adminKeypairPath)) {
    console.error('❌ Admin keypair not found at:', adminKeypairPath);
    console.log('Please ensure admin-keypair.json exists in ~/.config/solana/');
    console.log('Expected admin wallet: 2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk');
    process.exit(1);
  }
  
  const adminKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8')))
  );
  
  // Verify this is the correct admin wallet
  const expectedAdmin = new PublicKey('2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk');
  if (!adminKeypair.publicKey.equals(expectedAdmin)) {
    console.error('❌ Wrong admin wallet loaded!');
    console.log('Expected:', expectedAdmin.toString());
    console.log('Loaded:', adminKeypair.publicKey.toString());
    console.log('Please ensure admin-keypair.json contains the correct keypair');
    process.exit(1);
  }
  
  console.log('👤 Admin wallet:', adminKeypair.publicKey.toString());
  
  // USDC mint
  const usdcMint = new PublicKey(process.env.NEXT_PUBLIC_USDC_TOKEN_MINT);
  
  // Capital vault (destination)
  const capitalVault = new PublicKey(process.env.NEXT_PUBLIC_LENDING_CAPITAL_VAULT);
  
  // Admin's USDC token account (source)
  const adminUsdcAccount = await getAssociatedTokenAddress(usdcMint, adminKeypair.publicKey);
  
  console.log('💰 USDC Mint:', usdcMint.toString());
  console.log('🏦 Capital Vault:', capitalVault.toString());
  console.log('👤 Admin USDC Account:', adminUsdcAccount.toString());
  
  // Check admin's USDC balance
  try {
    const adminAccountInfo = await getAccount(connection, adminUsdcAccount);
    const adminBalance = Number(adminAccountInfo.amount);
    console.log(`💳 Admin USDC Balance: ${adminBalance / 1_000_000} USDC`);
    
    if (adminBalance === 0) {
      console.error('❌ Admin has no USDC to transfer!');
      console.log('Please fund the admin account with devnet USDC first.');
      console.log('You can get devnet USDC from: https://spl-token-faucet.com/');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Admin USDC account not found or has no balance');
    console.log('Please create and fund the admin USDC account first.');
    console.log('You can get devnet USDC from: https://spl-token-faucet.com/');
    process.exit(1);
  }
  
  // Check current capital vault balance
  try {
    const vaultAccountInfo = await getAccount(connection, capitalVault);
    const currentBalance = Number(vaultAccountInfo.amount);
    console.log(`🏦 Current Capital Vault Balance: ${currentBalance / 1_000_000} USDC`);
  } catch (error) {
    console.error('❌ Error reading capital vault:', error.message);
    process.exit(1);
  }
  
  // Amount to transfer (let's fund with 10,000 USDC for testing)
  const transferAmount = 10_000 * 1_000_000; // 10,000 USDC in micro-USDC
  
  console.log(`💸 Transferring ${transferAmount / 1_000_000} USDC to capital vault...`);
  
  // Create transfer instruction
  const transferInstruction = createTransferInstruction(
    adminUsdcAccount,     // source
    capitalVault,         // destination
    adminKeypair.publicKey, // authority
    transferAmount        // amount
  );
  
  // Create and send transaction
  const transaction = new anchor.web3.Transaction().add(transferInstruction);
  
  try {
    const signature = await anchor.web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [adminKeypair],
      { commitment: 'confirmed' }
    );
    
    console.log('✅ Transfer successful!');
    console.log('🔗 Transaction signature:', signature);
    
    // Verify the transfer
    const vaultAccountInfo = await getAccount(connection, capitalVault);
    const newBalance = Number(vaultAccountInfo.amount);
    console.log(`🏦 New Capital Vault Balance: ${newBalance / 1_000_000} USDC`);
    
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
