import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🏦 INITIALIZE LENDING CAPITAL VAULT
 * 
 * This script initializes the lending program's capital vault with proper authority.
 * This is a CRITICAL step for mainnet readiness.
 */

async function main() {
  console.log('🏦 Initializing Lending Capital Vault...');
  
  // Connection and admin keypair
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const adminKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(join(__dirname, '../admin-keypair.json'), 'utf-8')))
  );
  
  console.log(`👤 Admin: ${adminKeypair.publicKey.toString()}`);
  
  // Program IDs and addresses
  const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
  const USDC_MINT = new PublicKey("5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR");
  
  // Derive PDAs
  const [globalMarket] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_market")],
    LENDING_PROGRAM_ID
  );
  
  const [lendingCapitalVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("capital_vault_usdc")],
    LENDING_PROGRAM_ID
  );
  
  console.log(`🏛️ Global Market: ${globalMarket.toString()}`);
  console.log(`💰 Capital Vault: ${lendingCapitalVault.toString()}`);
  
  // Setup program
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), {
    commitment: 'confirmed'
  });
  
  const lendingIdl = JSON.parse(readFileSync(join(__dirname, '../target/idl/lendingprogram.json'), 'utf-8'));
  const program = new anchor.Program(lendingIdl, provider);
  
  try {
    // Check if global market exists
    const globalMarketAccount = await (program.account as any).globalMarket.fetch(globalMarket);
    console.log('✅ Global Market exists');
    console.log(`   Treasury: ${globalMarketAccount.treasuryWallet.toString()}`);
    console.log(`   Capital Vault: ${globalMarketAccount.capitalVaultUsdc.toString()}`);
    
    // Check if capital vault is already initialized
    try {
      const vaultInfo = await connection.getTokenAccountBalance(lendingCapitalVault);
      console.log(`✅ Capital Vault already exists with balance: ${parseInt(vaultInfo.value.amount) / 1_000_000} USDC`);
      return;
    } catch (error) {
      console.log('⚠️  Capital Vault not initialized yet - proceeding with initialization...');
    }
    
    // Initialize capital vault
    console.log('🔄 Initializing capital vault...');
    
    const tx = await program.methods
      .initializeCapitalVault()
      .accounts({
        admin: adminKeypair.publicKey,
        globalMarket: globalMarket,
        capitalVault: lendingCapitalVault,
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([adminKeypair])
      .rpc();
    
    console.log(`✅ Capital Vault initialized! Transaction: ${tx}`);
    
    // Verify the vault
    const vaultInfo = await connection.getTokenAccountBalance(lendingCapitalVault);
    console.log(`💰 Capital Vault Balance: ${parseInt(vaultInfo.value.amount) / 1_000_000} USDC`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.message?.includes('already in use')) {
      console.log('✅ Capital Vault already initialized!');
    } else {
      throw error;
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
