import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createMint, mintTo, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import fs from 'fs';

const LENDING_PROGRAM_ID = new PublicKey('EKGgPnSkQEJpEBaLpxWXpLQNFcC5TR3SkSUDqsuWLcKK');

async function main() {
  console.log('🏦 Creating test USDC mint for devnet lending testing...');

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

  try {
    // Create a new test USDC mint with admin as authority
    console.log('🔄 Creating new test USDC mint...');
    const testUsdcMint = await createMint(
      connection,
      adminKeypair, // payer
      adminKeypair.publicKey, // mint authority
      adminKeypair.publicKey, // freeze authority
      6 // decimals (USDC has 6 decimals)
    );
    console.log('✅ Created test USDC mint:', testUsdcMint.toString());

    // Derive USDC capital vault PDA
    const [usdcCapitalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('capital_vault_usdc')],
      LENDING_PROGRAM_ID
    );

    // Create token account for admin to hold test USDC
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

    console.log('✅ Successfully created test USDC setup!');
    console.log('📊 Summary:');
    console.log('  Test USDC Mint:', testUsdcMint.toString());
    console.log('  Admin USDC Account:', adminUsdcAccount.address.toString());
    console.log('  Amount Minted: 1,000,000 USDC');
    console.log('  Capital Vault PDA:', usdcCapitalVault.toString());
    
    // Save the test USDC mint address for use in other scripts
    const testConfig = {
      testUsdcMint: testUsdcMint.toString(),
      adminUsdcAccount: adminUsdcAccount.address.toString(),
      capitalVaultPda: usdcCapitalVault.toString(),
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync('test-usdc-config.json', JSON.stringify(testConfig, null, 2));
    console.log('💾 Saved test USDC config to test-usdc-config.json');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Update lending program constants to use this test USDC mint');
    console.log('2. Transfer some USDC to the capital vault for lending');
    console.log('3. Test NFT minting without Jupiter swap');
    console.log('4. Test lending operations with real USDC');

  } catch (error) {
    console.error('❌ Error creating test USDC:', error);
    throw error;
  }
}

main().catch(console.error);
