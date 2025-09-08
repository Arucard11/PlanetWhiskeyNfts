import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * 🔍 CHECK NFT DEPOSITS
 * 
 * This script checks if NFTs are deposited in the lending program
 * and fetches their collection information.
 */

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
  const userWallet = new PublicKey("CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n");
  
  // Derive borrower account PDA
  const [borrowerAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("borrower_account"), userWallet.toBuffer()],
    LENDING_PROGRAM_ID
  );
  
  console.log('🔍 Checking NFT deposits...');
  console.log(`👤 User Wallet: ${userWallet.toString()}`);
  console.log(`🏦 Borrower Account PDA: ${borrowerAccount.toString()}`);
  
  try {
    // Check if borrower account exists
    const accountInfo = await connection.getAccountInfo(borrowerAccount);
    if (!accountInfo) {
      console.log('❌ No borrower account found - no NFTs deposited yet');
      console.log('💡 User needs to deposit an NFT first using the Borrow page');
      return;
    }
    
    // Load IDL and fetch borrower account data
    const lendingIdl = JSON.parse(readFileSync(join(__dirname, '../target/idl/lendingprogram.json'), 'utf-8'));
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    const program = new anchor.Program(lendingIdl, provider);
    
    const borrowerData = await (program.account as any).borrowerAccount.fetch(borrowerAccount);
    
    console.log('✅ Borrower Account Found!');
    console.log('📊 Borrower Data:');
    console.log(`  Owner: ${borrowerData.owner.toString()}`);
    console.log(`  Deposited NFTs: ${borrowerData.depositedNfts.length}`);
    console.log(`  Active Loans: ${borrowerData.activeLoans.length}`);
    console.log(`  Total Borrowing Power: ${parseInt(borrowerData.totalBorrowingPowerUsd) / 1_000_000} USD`);
    console.log(`  Total Debt: ${parseInt(borrowerData.totalDebtUsd) / 1_000_000} USD`);
    console.log(`  Loan Counter: ${borrowerData.loanCounter.toString()}`);
    
    if (borrowerData.depositedNfts.length > 0) {
      console.log('\n🖼️ Deposited NFTs:');
      for (let i = 0; i < borrowerData.depositedNfts.length; i++) {
        const nftMint = borrowerData.depositedNfts[i];
        console.log(`  NFT ${i + 1}: ${nftMint.toString()}`);
        
        // Try to get NFT metadata to find collection
        try {
          const metadataPda = PublicKey.findProgramAddressSync(
            [
              Buffer.from("metadata"),
              new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
              nftMint.toBuffer()
            ],
            new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s")
          )[0];
          
          const metadataAccount = await connection.getAccountInfo(metadataPda);
          if (metadataAccount && metadataAccount.data.length > 0) {
            console.log(`    Metadata PDA: ${metadataPda.toString()}`);
            
            // Parse collection from metadata (simplified parsing)
            const data = metadataAccount.data;
            if (data.length > 326) { // Minimum size for collection data
              // Collection is at offset 326 (32 bytes for collection mint + 1 byte for verified)
              try {
                const collectionBytes = data.slice(326, 358); // 32 bytes for collection mint
                const collectionMint = new PublicKey(collectionBytes);
                console.log(`    🏷️ Collection Mint: ${collectionMint.toString()}`);
                
                // Check if collection is verified
                const isVerified = data[358] === 1;
                console.log(`    ✅ Collection Verified: ${isVerified}`);
              } catch (e) {
                console.log(`    ⚠️ Could not parse collection data`);
              }
            }
          } else {
            console.log(`    ❌ No metadata found`);
          }
        } catch (e) {
          console.log(`    ❌ Error fetching metadata: ${e.message}`);
        }
        
        // Check if NFT is in escrow
        try {
          const [nftEscrow] = PublicKey.findProgramAddressSync(
            [Buffer.from("collateral_escrow"), userWallet.toBuffer(), nftMint.toBuffer()],
            LENDING_PROGRAM_ID
          );
          
          const escrowInfo = await connection.getTokenAccountBalance(nftEscrow);
          console.log(`    🔒 NFT in Escrow: ${escrowInfo.value.amount} (should be 1)`);
        } catch (e) {
          console.log(`    ❌ NFT not in escrow or error: ${e.message}`);
        }
      }
    } else {
      console.log('⚠️ No NFTs deposited in borrower account');
      console.log('💡 The user should visit /lending/borrow to deposit NFTs');
    }
    
    // Check collection registry
    console.log('\n🏛️ Checking Collection Registry...');
    try {
      const [collectionRegistry] = PublicKey.findProgramAddressSync(
        [Buffer.from("collection_registry_v2")],
        LENDING_PROGRAM_ID
      );
      
      const registryData = await (program.account as any).collectionRegistry.fetch(collectionRegistry);
      console.log(`✅ Collection Registry found with ${registryData.collections.length} collections:`);
      
      for (const collection of registryData.collections) {
        console.log(`  📚 Collection: ${collection.mint.toString()}`);
        console.log(`    Value: ${parseInt(collection.valueUsd) / 1_000_000} USD`);
        console.log(`    Approved: ${collection.isApproved}`);
      }
    } catch (e) {
      console.log(`❌ Error fetching collection registry: ${e.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
