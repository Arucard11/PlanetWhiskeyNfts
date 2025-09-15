#!/usr/bin/env node

// Debug script to check lending account state for a specific wallet

const anchor = require("@coral-xyz/anchor");
const { Connection, PublicKey } = require('@solana/web3.js');

async function debugLendingAccount() {
  const walletAddress = process.argv[2];
  
  if (!walletAddress) {
    console.log('❌ Please provide a wallet address as an argument');
    console.log('Usage: node scripts/debug-lending-account.cjs <WALLET_ADDRESS>');
    process.exit(1);
  }

  try {
    console.log('🔍 Debugging lending account for wallet:', walletAddress);
    
    // Setup connection
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Load program
    const lendingIdl = require('../src/lib/idl/lendingprogram.json');
    const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID);
    
    const provider = new anchor.AnchorProvider(connection, {} , {});
    const program = new anchor.Program(lendingIdl, provider);
    
    // Derive borrower account PDA
    const userWallet = new PublicKey(walletAddress);
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );
    
    console.log('📍 Borrower Account PDA:', borrowerAccountPda.toString());
    
    // Fetch borrower account
    try {
      const borrowerAccount = await program.account.borrowerAccount.fetch(borrowerAccountPda);
      
      console.log('\n📊 Borrower Account Data:');
      console.log('  Owner:', borrowerAccount.owner.toString());
      console.log('  Deposited NFTs:', borrowerAccount.depositedNfts.length);
      console.log('  Active Loans:', borrowerAccount.activeLoans.length);
      
      // Convert from micro-dollars to dollars
      const totalBorrowingPowerUsd = Number(borrowerAccount.totalBorrowingPowerUsd) / 1_000_000;
      const totalDebtUsd = Number(borrowerAccount.totalDebtUsd) / 1_000_000;
      const availableToBorrow = Math.max(0, totalBorrowingPowerUsd - totalDebtUsd);
      
      console.log('  Total Borrowing Power (raw):', borrowerAccount.totalBorrowingPowerUsd.toString());
      console.log('  Total Borrowing Power (USD):', totalBorrowingPowerUsd);
      console.log('  Total Debt (raw):', borrowerAccount.totalDebtUsd.toString());
      console.log('  Total Debt (USD):', totalDebtUsd);
      console.log('  Available to Borrow:', availableToBorrow);
      console.log('  Loan Counter:', borrowerAccount.loanCounter.toString());
      
      // List deposited NFTs
      if (borrowerAccount.depositedNfts.length > 0) {
        console.log('\n🖼️  Deposited NFTs:');
        borrowerAccount.depositedNfts.forEach((nft, index) => {
          console.log(`    ${index + 1}. ${nft.toString()}`);
        });
      }
      
      // Check active loans
      if (borrowerAccount.activeLoans.length > 0) {
        console.log('\n💰 Active Loans:');
        for (let i = 0; i < borrowerAccount.activeLoans.length; i++) {
          const loanPda = borrowerAccount.activeLoans[i];
          console.log(`    ${i + 1}. Loan PDA: ${loanPda.toString()}`);
          
          try {
            const loanAccount = await program.account.loan.fetch(loanPda);
            const principalUsd = Number(loanAccount.principalAmountUsd) / 1_000_000;
            const interestPaidUsd = Number(loanAccount.interestPaidUsd) / 1_000_000;
            
            console.log(`       Principal: $${principalUsd}`);
            console.log(`       Interest Rate: ${loanAccount.interestRateAtOriginationBps / 100}%`);
            console.log(`       Interest Paid: $${interestPaidUsd}`);
            console.log(`       Status: ${JSON.stringify(loanAccount.status)}`);
            console.log(`       Start Time: ${new Date(Number(loanAccount.startTs) * 1000).toISOString()}`);
            console.log(`       Duration: ${loanAccount.durationSecs} seconds`);
          } catch (loanError) {
            console.log(`       ❌ Error fetching loan data: ${loanError.message}`);
          }
        }
      } else {
        console.log('\n✅ No active loans found');
      }
      
    } catch (error) {
      console.log('\n❌ No borrower account found for this wallet');
      console.log('   This means the wallet has never deposited NFTs for lending');
    }
    
  } catch (error) {
    console.error('❌ Error debugging lending account:', error);
    process.exit(1);
  }
}

// Run the debug script
debugLendingAccount()
  .then(() => {
    console.log('\n✅ Debug completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
  });
