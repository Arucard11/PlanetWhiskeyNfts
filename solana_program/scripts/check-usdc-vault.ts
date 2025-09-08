import { Connection, PublicKey } from "@solana/web3.js";

async function checkUsdcVault() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const WHISKEY_PROGRAM_ID = new PublicKey("68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD");
  
  console.log("🔍 Checking USDC Vault V2 status...");
  
  // Derive USDC Vault V2 address
  const [usdcVaultV2, usdcBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
    WHISKEY_PROGRAM_ID
  );
  
  console.log(`📍 USDC Vault V2 PDA: ${usdcVaultV2.toString()}`);
  console.log(`📍 Bump: ${usdcBump}`);
  
  try {
    const accountInfo = await connection.getAccountInfo(usdcVaultV2);
    
    if (accountInfo) {
      console.log("✅ USDC Vault V2 EXISTS");
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data length: ${accountInfo.data.length} bytes`);
      
      // Try to get token account balance
      try {
        const balance = await connection.getTokenAccountBalance(usdcVaultV2);
        console.log(`   Balance: ${balance.value.amount} USDC (${balance.value.uiAmount} UI)`);
      } catch (balanceError) {
        console.log(`   ⚠️ Could not get token balance: ${balanceError}`);
      }
    } else {
      console.log("❌ USDC Vault V2 DOES NOT EXIST");
      console.log("   This is likely the cause of the seeds constraint violation!");
      console.log("   You need to initialize the lending pool first.");
    }
  } catch (error) {
    console.error(`❌ Error checking account: ${error}`);
  }
  
  // Also check lending pool config
  const [lendingPoolConfig, poolBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("lending_pool")],
    WHISKEY_PROGRAM_ID
  );
  
  console.log(`\n📍 Lending Pool Config PDA: ${lendingPoolConfig.toString()}`);
  console.log(`📍 Bump: ${poolBump}`);
  
  try {
    const poolInfo = await connection.getAccountInfo(lendingPoolConfig);
    
    if (poolInfo) {
      console.log("✅ Lending Pool Config EXISTS");
    } else {
      console.log("❌ Lending Pool Config DOES NOT EXIST");
      console.log("   You need to run: anchor invoke initialize_lending_pool");
    }
  } catch (error) {
    console.error(`❌ Error checking pool config: ${error}`);
  }
}

checkUsdcVault().catch(console.error);
