import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { transfer, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🔧 Fix Vault Funding Script
 * 
 * Transfers USDC from the wrong vault (lending program's capital vault) 
 * to the correct vault (whiskey program's USDC vault V2)
 */

async function fixVaultFunding() {
  console.log('🔧 Fixing USDC Vault Funding...');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load admin keypair
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(__dirname, '../admin-keypair.json'), 'utf-8')))
  );
  
  console.log(`👤 Admin Wallet: ${adminKeypair.publicKey.toString()}`);
  
  // Vault addresses
  const wrongVault = new PublicKey('GR1a3JcYR7tYWNqcatd9bdBvh4d4YKLFTkpuP2Nd1c5v'); // Lending program's capital vault token account
  const correctVault = new PublicKey('GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm'); // Whiskey program's USDC vault V2
  
  // Check balances
  try {
    const wrongBalance = await connection.getTokenAccountBalance(wrongVault);
    const correctBalance = await connection.getTokenAccountBalance(correctVault);
    
    console.log(`💰 Wrong vault balance: ${wrongBalance.value.amount} USDC`);
    console.log(`💰 Correct vault balance: ${correctBalance.value.amount} USDC`);
    
    const transferAmount = parseInt(wrongBalance.value.amount);
    
    if (transferAmount === 0) {
      console.log('✅ No USDC to transfer from wrong vault');
      return;
    }
    
    console.log(`🔄 Transferring ${transferAmount / 1_000_000} USDC to correct vault...`);
    
    // Note: This transfer would require the authority of the wrong vault
    // Since it's a PDA, we'd need to use the lending program to authorize the transfer
    console.log('⚠️  This requires a program instruction to transfer from PDA vault');
    console.log('⚠️  Alternative: Fund the correct vault directly with new USDC');
    
    // For now, let's just fund the correct vault directly
    console.log('🏦 Funding correct vault with new USDC instead...');
    
    // This would require minting new test USDC to the correct vault
    // Since we can't easily transfer from PDA without program instruction
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function fundCorrectVault() {
  console.log('💰 Funding Correct USDC Vault...');
  
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load admin keypair
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(__dirname, '../admin-keypair.json'), 'utf-8')))
  );
  
  const testUsdcMint = new PublicKey('5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR');
  const correctVault = new PublicKey('GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm');
  
  try {
    console.log('🪙 Test USDC Mint:', testUsdcMint.toString());
    console.log('🏦 Correct USDC Vault:', correctVault.toString());
    
    // Check if vault exists and get current balance
    const vaultInfo = await connection.getAccountInfo(correctVault);
    if (!vaultInfo) {
      console.log('❌ Correct vault does not exist yet. Need to initialize whiskey program first.');
      return;
    }
    
    const currentBalance = await connection.getTokenAccountBalance(correctVault);
    console.log(`💰 Current balance: ${currentBalance.value.amount} USDC`);
    
    // Mint 200,000 USDC to the correct vault
    const amountToMint = 200_000 * 1_000_000; // 200,000 USDC with 6 decimals
    
    console.log(`💵 Minting ${amountToMint / 1_000_000} USDC to correct vault...`);
    
    // Note: This requires mint authority
    console.log('⚠️  This requires mint authority for test USDC');
    console.log('⚠️  Run the whiskey program mint instruction instead');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  await fixVaultFunding();
  console.log('\\n');
  await fundCorrectVault();
}

if (require.main === module) {
  main().catch(console.error);
}
