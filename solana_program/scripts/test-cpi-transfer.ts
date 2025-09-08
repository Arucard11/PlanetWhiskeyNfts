import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🔄 TEST CPI TRANSFER MECHANISM
 * 
 * This script tests the transfer_to_lending_vault instruction
 * which moves USDC from whiskey program vault to lending program vault.
 */

async function main() {
  console.log('🔄 Testing CPI Transfer Mechanism...');
  
  // Connection and admin keypair
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(__dirname, '../admin-keypair.json'), 'utf-8')))
  );
  
  console.log(`👤 Admin: ${adminKeypair.publicKey.toString()}`);
  
  // Program IDs and addresses
  const WHISKEY_PROGRAM_ID = new PublicKey("68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD");
  const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
  
  // Derive PDAs
  const [lendingPoolConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from("lending_pool")],
    WHISKEY_PROGRAM_ID
  );
  
  const [whiskeyUsdcVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
    WHISKEY_PROGRAM_ID
  );
  
  const [lendingCapitalVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("capital_vault_usdc")],
    LENDING_PROGRAM_ID
  );
  
  console.log(`🏛️ Lending Pool Config: ${lendingPoolConfig.toString()}`);
  console.log(`💰 Whiskey USDC Vault: ${whiskeyUsdcVault.toString()}`);
  console.log(`🏦 Lending Capital Vault: ${lendingCapitalVault.toString()}`);
  
  // Setup program
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {
    commitment: 'confirmed'
  });
  
  const whiskeyIdl = JSON.parse(readFileSync(join(__dirname, '../target/idl/whiskeyprogram.json'), 'utf-8'));
  const program = new anchor.Program(whiskeyIdl, provider);
  
  try {
    // Check current balances
    console.log('\n📊 BEFORE TRANSFER:');
    const whiskeyVaultBalance = await connection.getTokenAccountBalance(whiskeyUsdcVault);
    const lendingVaultBalance = await connection.getTokenAccountBalance(lendingCapitalVault);
    
    console.log(`💰 Whiskey USDC Vault: ${parseInt(whiskeyVaultBalance.value.amount) / 1_000_000} USDC`);
    console.log(`🏦 Lending Capital Vault: ${parseInt(lendingVaultBalance.value.amount) / 1_000_000} USDC`);
    
    // Transfer amount (100 USDC = 100,000,000 micro USDC)
    const transferAmount = 100_000_000; // 100 USDC
    
    if (parseInt(whiskeyVaultBalance.value.amount) < transferAmount) {
      console.log('❌ Insufficient balance in whiskey vault for transfer');
      console.log(`   Need: ${transferAmount / 1_000_000} USDC`);
      console.log(`   Have: ${parseInt(whiskeyVaultBalance.value.amount) / 1_000_000} USDC`);
      return;
    }
    
    // Execute CPI transfer
    console.log(`\n🔄 Transferring ${transferAmount / 1_000_000} USDC from whiskey vault to lending vault...`);
    
    const tx = await program.methods
      .transferToLendingVault(new anchor.BN(transferAmount))
      .accounts({
        admin: adminKeypair.publicKey,
        lendingPoolConfig: lendingPoolConfig,
        whiskeyUsdcVault: whiskeyUsdcVault,
        lendingCapitalVault: lendingCapitalVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([adminKeypair])
      .rpc();
    
    console.log(`✅ Transfer completed! Transaction: ${tx}`);
    
    // Check balances after transfer
    console.log('\n📊 AFTER TRANSFER:');
    const whiskeyVaultBalanceAfter = await connection.getTokenAccountBalance(whiskeyUsdcVault);
    const lendingVaultBalanceAfter = await connection.getTokenAccountBalance(lendingCapitalVault);
    
    console.log(`💰 Whiskey USDC Vault: ${parseInt(whiskeyVaultBalanceAfter.value.amount) / 1_000_000} USDC`);
    console.log(`🏦 Lending Capital Vault: ${parseInt(lendingVaultBalanceAfter.value.amount) / 1_000_000} USDC`);
    
    const transferred = parseInt(lendingVaultBalanceAfter.value.amount) - parseInt(lendingVaultBalance.value.amount);
    console.log(`\n✅ Successfully transferred: ${transferred / 1_000_000} USDC`);
    console.log('🎉 CPI Transfer Mechanism Working!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.message?.includes('InsufficientFunds')) {
      console.log('💡 The whiskey vault needs more USDC for testing');
    } else if (error.message?.includes('InvalidAmount')) {
      console.log('💡 Transfer amount must be greater than 0');
    } else {
      throw error;
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
