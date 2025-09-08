import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('💰 Funding USDC Capital Vault for Lending Tests...\n');

  // Load admin keypair
  const adminKeypairPath = join(__dirname, '../admin-keypair.json');
  const adminKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(readFileSync(adminKeypairPath, 'utf-8')))
  );
  
  console.log(`👤 Admin Wallet: ${adminKeypair.publicKey.toString()}`);

  // Connect to devnet
  const connection = new Connection(
    'https://api.devnet.solana.com',
    'confirmed'
  );

  // Check admin balance
  const balance = await connection.getBalance(adminKeypair.publicKey);
  console.log(`💰 Admin Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);

  try {
    // Load test USDC mint address
    const testUsdcConfigPath = join(__dirname, '../test-usdc-config.json');
    const testUsdcConfig = JSON.parse(readFileSync(testUsdcConfigPath, 'utf-8'));
    const testUsdcMint = new PublicKey(testUsdcConfig.testUsdcMint);
    
    console.log(`🪙 Test USDC Mint: ${testUsdcMint.toString()}`);

    // Derive USDC Capital Vault PDA
    const lendingProgramId = new PublicKey('25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ');
    const [usdcCapitalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('capital_vault_usdc')],
      lendingProgramId
    );

    console.log(`🏦 USDC Capital Vault PDA: ${usdcCapitalVault.toString()}`);

    // Create or get the associated token account for the capital vault
    console.log('\n🔧 Creating/Getting Capital Vault Token Account...');
    const capitalVaultTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair, // payer
      testUsdcMint, // mint
      usdcCapitalVault, // owner (PDA)
      true // allowOwnerOffCurve (required for PDAs)
    );

    console.log(`📊 Capital Vault Token Account: ${capitalVaultTokenAccount.address.toString()}`);

    // Check current balance
    const currentBalance = Number(capitalVaultTokenAccount.amount);
    console.log(`💵 Current Capital Vault Balance: ${currentBalance / 1_000_000} USDC`);

    // Mint amount (let's add 100,000 USDC for testing)
    const mintAmount = 100_000 * 1_000_000; // 100,000 USDC with 6 decimals
    
    console.log(`\n💰 Minting ${mintAmount / 1_000_000} test USDC to Capital Vault...`);

    // Mint tokens to the capital vault
    const mintTx = await mintTo(
      connection,
      adminKeypair, // payer
      testUsdcMint, // mint
      capitalVaultTokenAccount.address, // destination
      adminKeypair, // mint authority (we control the test mint)
      mintAmount // amount
    );

    console.log(`✅ Mint Transaction: ${mintTx}`);

    // Verify the mint
    const updatedAccount = await connection.getTokenAccountBalance(capitalVaultTokenAccount.address);
    const newBalance = Number(updatedAccount.value.amount);
    
    console.log(`\n🎉 SUCCESS! Capital Vault Funded!`);
    console.log(`📊 Previous Balance: ${currentBalance / 1_000_000} USDC`);
    console.log(`📊 New Balance: ${newBalance / 1_000_000} USDC`);
    console.log(`📊 Added: ${(newBalance - currentBalance) / 1_000_000} USDC`);

    // Save funding info
    const fundingInfo = {
      network: 'Devnet',
      timestamp: new Date().toISOString(),
      mintTransaction: mintTx,
      testUsdcMint: testUsdcMint.toString(),
      capitalVaultPda: usdcCapitalVault.toString(),
      capitalVaultTokenAccount: capitalVaultTokenAccount.address.toString(),
      previousBalance: currentBalance / 1_000_000,
      newBalance: newBalance / 1_000_000,
      amountAdded: (newBalance - currentBalance) / 1_000_000,
      notes: [
        'Capital vault now has USDC for lending operations',
        'Users can now borrow against their NFT collateral',
        'Interest payments will go to treasury wallet',
        'Principal repayments will return to this vault'
      ]
    };

    const fs = require('fs');
    fs.writeFileSync(
      join(__dirname, '../capital-vault-funding.json'),
      JSON.stringify(fundingInfo, null, 2)
    );

    console.log('\n📁 Funding info saved to: capital-vault-funding.json');
    console.log('\n🚀 Ready for Lending Tests!');
    console.log('✅ Capital vault has sufficient USDC for loans');
    console.log('✅ Users can now deposit NFTs and borrow USDC');
    console.log('✅ Interest payments will go to your treasury wallet');
    console.log('✅ Test the lending functionality on the admin page!');

  } catch (error) {
    console.error('❌ Error funding capital vault:', error);
    throw error;
  }
}

main().catch(console.error);
