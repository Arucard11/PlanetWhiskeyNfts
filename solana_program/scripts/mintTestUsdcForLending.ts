import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createMint, mintTo, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import fs from 'fs';

const LENDING_PROGRAM_ID = new PublicKey('25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ');

async function main() {
  console.log('🏦 Minting test USDC tokens for lending pool testing...');

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

  // Derive GlobalMarket PDA
  const [globalMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_market')],
    LENDING_PROGRAM_ID
  );

  // Derive USDC capital vault
  const [usdcCapitalVault] = PublicKey.findProgramAddressSync(
    [Buffer.from('capital_vault_usdc')],
    LENDING_PROGRAM_ID
  );

  console.log('🏦 Global Market PDA:', globalMarketPda.toString());
  console.log('💵 USDC Capital Vault:', usdcCapitalVault.toString());

  try {
    // Use our existing test USDC mint
    const testUsdcConfigPath = 'test-usdc-config.json';
    if (!fs.existsSync(testUsdcConfigPath)) {
      throw new Error('Test USDC config not found. Run createTestUsdcMint.ts first.');
    }
    
    const testUsdcConfig = JSON.parse(fs.readFileSync(testUsdcConfigPath, 'utf8'));
    const testUsdcMint = new PublicKey(testUsdcConfig.testUsdcMint);
    
    console.log('✅ Using existing test USDC mint:', testUsdcMint.toString());

    // Get or create token account for the capital vault
    console.log('🔄 Setting up capital vault token account...');
    
    // For testing, we'll mint to admin's account first, then transfer to vault
    const adminUsdcAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair,
      testUsdcMint,
      adminKeypair.publicKey
    );

    // Mint 1,000,000 USDC (1M * 10^6) for testing
    const mintAmount = 1_000_000 * 1_000_000; // 1M USDC with 6 decimals
    
    console.log('🔄 Minting test USDC tokens...');
    await mintTo(
      connection,
      adminKeypair,
      testUsdcMint,
      adminUsdcAccount.address,
      adminKeypair, // mint authority
      mintAmount
    );

    console.log('✅ Successfully minted 1,000,000 test USDC tokens!');
    console.log('📊 Summary:');
    console.log('  Test USDC Mint:', testUsdcMint.toString());
    console.log('  Admin USDC Account:', adminUsdcAccount.address.toString());
    console.log('  Amount Minted: 1,000,000 USDC');
    console.log('  Capital Vault PDA:', usdcCapitalVault.toString());
    
    console.log('\n💡 Next Steps:');
    console.log('1. Transfer some USDC to the capital vault for lending');
    console.log('2. Update the lending program to use this test USDC mint');
    console.log('3. Test NFT minting without Jupiter swap');
    console.log('4. Test lending operations with real USDC');

  } catch (error) {
    console.error('❌ Error minting test USDC:', error);
    throw error;
  }
}

main().catch(console.error);
