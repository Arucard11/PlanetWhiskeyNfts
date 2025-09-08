import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { transfer, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import fs from 'fs';

const LENDING_PROGRAM_ID = new PublicKey('EKGgPnSkQEJpEBaLpxWXpLQNFcC5TR3SkSUDqsuWLcKK');
const TEST_USDC_MINT = new PublicKey('22WPNxuB3dNp8LffgNcHtuqbaUVRwrLgCLC5Fa4x918M'); // From test-usdc-config.json

async function main() {
  console.log('🏦 Adding test USDC liquidity to lending pool...');

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load admin keypair
  const adminKeypairPath = 'admin-keypair.json';
  if (!fs.existsSync(adminKeypairPath)) {
    throw new Error(`Admin keypair not found at ${adminKeypairPath}`);
  }
  
  const adminKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8')))
  );
  
  console.log('👤 Admin wallet:', adminKeypair.publicKey.toString());

  // Derive USDC capital vault PDA
  const [usdcCapitalVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('capital_vault_usdc')],
    LENDING_PROGRAM_ID
  );

  console.log('💵 USDC Capital Vault PDA:', usdcCapitalVault.toString());
  console.log('🪙 Test USDC Mint:', TEST_USDC_MINT.toString());

  try {
    // Get admin's USDC token account
    const adminUsdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      TEST_USDC_MINT,
      adminKeypair.publicKey
    );

    console.log('💳 Admin USDC Account:', adminUsdcAccount.address.toString());

    // Check admin's USDC balance
    const balance = await connection.getTokenAccountBalance(adminUsdcAccount.address);
    console.log('💰 Admin USDC Balance:', balance.value.uiAmount, 'USDC');

    if (!balance.value.uiAmount || balance.value.uiAmount < 100000) {
      console.log('❌ Insufficient USDC balance. Need to mint test USDC first.');
      console.log('💡 Run: ts-node scripts/createTestUsdcMint.ts');
      return;
    }

    // Create or get capital vault token account
    const capitalVaultUsdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      TEST_USDC_MINT,
      usdcCapitalVault,
      true // allowOwnerOffCurve for PDA
    );

    console.log('🏦 Capital Vault USDC Account:', capitalVaultUsdcAccount.address.toString());

    // Transfer 100,000 USDC to capital vault for testing
    const transferAmount = 100_000 * 1_000_000; // 100k USDC with 6 decimals
    
    console.log('🔄 Transferring 100,000 USDC to capital vault...');
    const signature = await transfer(
      connection,
      adminKeypair,
      adminUsdcAccount.address,
      capitalVaultUsdcAccount.address,
      adminKeypair,
      transferAmount
    );

    console.log('✅ Transfer completed!');
    console.log('📊 Summary:');
    console.log('  Transaction:', signature);
    console.log('  Amount Transferred: 100,000 USDC');
    console.log('  From:', adminUsdcAccount.address.toString());
    console.log('  To:', capitalVaultUsdcAccount.address.toString());
    console.log('  Capital Vault PDA:', usdcCapitalVault.toString());
    
    console.log('\n💡 Lending Pool is now ready for testing!');
    console.log('✅ Users can now borrow USDC against their NFT collateral');
    console.log('✅ Interest rates will be calculated dynamically');
    console.log('✅ All transactions will be in WHISKEY tokens for fees/interest');

  } catch (error) {
    console.error('❌ Error adding test liquidity:', error);
    throw error;
  }
}

main().catch(console.error);
