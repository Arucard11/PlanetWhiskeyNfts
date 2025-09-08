import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🚀 Initializing Clean Global Market (New Architecture)...\n');

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

  if (balance < 2 * anchor.web3.LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient balance. Need at least 2 SOL for initialization.');
    return;
  }

  try {
    // Create provider
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(adminKeypair),
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Load the program
    const lendingProgramIdl = require('../target/idl/lendingprogram.json');
    const lendingProgram = new anchor.Program(
      lendingProgramIdl,
      provider
    );

    console.log('📚 Program loaded successfully');

    // Derive PDAs - ONLY the ones we actually need
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      lendingProgram.programId
    );

    const [collectionRegistry] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      lendingProgram.programId
    );

    const [usdcCapitalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('capital_vault_usdc')],
      lendingProgram.programId
    );

    console.log('\n📊 ACCOUNTS WE ACTUALLY USE:');
    console.log(`🏦 Global Market PDA: ${globalMarketPda.toString()}`);
    console.log(`📚 Collection Registry: ${collectionRegistry.toString()}`);
    console.log(`💵 USDC Capital Vault (PDA): ${usdcCapitalVault.toString()}`);
    console.log(`🏛️ Treasury Wallet (Admin): ${adminKeypair.publicKey.toString()}`);
    
    console.log('\n❌ ACCOUNTS WE REMOVED:');
    console.log('• USDC Treasury Vault PDA (fees now go to admin wallet)');
    console.log('• WHISKEY Treasury Vault PDA (fees now go to admin wallet)');

    // Check if already initialized
    try {
      const existingAccount = await connection.getAccountInfo(globalMarketPda);
      if (existingAccount) {
        console.log('\n⚠️ Global Market already initialized!');
        console.log(`📊 Account Size: ${existingAccount.data.length} bytes`);
        
        console.log('\n📋 Account already exists - use admin panel to view configuration');
        
        return;
      }
    } catch (error) {
      console.log('✅ Global Market not yet initialized, proceeding...');
    }

    // Initialize with clean parameters
    const maxStakedNfts = 1000;
    const perNftValueUsd = 100 * 1_000_000; // $100 in microdollars

    console.log('\n🏦 Initializing Global Market (Clean Architecture)...');
    console.log(`📊 Max Staked NFTs: ${maxStakedNfts}`);
    console.log(`💰 Per NFT Value: $${perNftValueUsd / 1_000_000}`);
    console.log(`🏛️ Treasury Wallet: ${adminKeypair.publicKey.toString()} (Admin's direct wallet)`);
    console.log(`💵 Capital Vault: ${usdcCapitalVault.toString()} (PDA for USDC lending pool)`);

    // Call the initialize function with ONLY the accounts we need
    const tx = await lendingProgram.methods
      .initializeGlobalMarket(
        maxStakedNfts,
        new anchor.BN(perNftValueUsd)
      )
      .accounts({
        globalMarket: globalMarketPda,
        collectionRegistry: collectionRegistry,
        owner: adminKeypair.publicKey,
        capitalVaultUsdc: usdcCapitalVault,
        treasuryWallet: adminKeypair.publicKey, // Admin's actual wallet - NO MORE VAULT PDAs!
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(`✅ Global Market initialized successfully!`);
    console.log(`📝 Transaction: ${tx}`);

    // Verify the account was created
    const globalMarketAccount = await connection.getAccountInfo(globalMarketPda);
    if (globalMarketAccount) {
      console.log('\n🎉 SUCCESS! Global Market account has been created!');
      console.log(`📊 Account Size: ${globalMarketAccount.data.length} bytes`);
      console.log(`🔑 Owner: ${globalMarketAccount.owner.toString()}`);
      
      console.log('\n📋 Configuration initialized with clean architecture!');
    } else {
      console.error('❌ Failed to verify Global Market account creation');
    }

    // Save clean deployment info
    const deploymentInfo = {
      network: 'Devnet',
      timestamp: new Date().toISOString(),
      transactionSignature: tx,
      accounts: {
        globalMarketPda: globalMarketPda.toString(),
        collectionRegistry: collectionRegistry.toString(),
        usdcCapitalVault: usdcCapitalVault.toString(),
        treasuryWallet: adminKeypair.publicKey.toString(),
      },
      configuration: {
        maxStakedNfts,
        perNftValueUsd: perNftValueUsd / 1_000_000,
        ltvRatio: 70, // 70%
        loanPeriods: [1, 2, 3], // months
      },
      notes: [
        'Clean architecture: No treasury vault PDAs',
        'All fees go directly to admin treasury wallet',
        'Interest payments in WHISKEY tokens',
        'Capital vault PDA holds USDC for lending',
      ]
    };

    const fs = require('fs');
    fs.writeFileSync(
      join(__dirname, '../clean-global-market-deployment.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log('\n📁 Clean deployment info saved to: clean-global-market-deployment.json');
    console.log('\n🚀 Next steps:');
    console.log('1. Add approved NFT collections via admin settings');
    console.log('2. Transfer USDC to the capital vault for lending');
    console.log('3. Test the lending protocol functionality');
    console.log('4. All fees and interest go to your treasury wallet!');

  } catch (error) {
    console.error('❌ Error initializing Global Market:', error);
    throw error;
  }
}

main().catch(console.error);
