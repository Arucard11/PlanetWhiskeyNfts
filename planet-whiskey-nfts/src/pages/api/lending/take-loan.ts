import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import lendingIdl from '../../../lib/idl/lendingprogram.json';

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
const WHISKEY_PROGRAM_ID = new PublicKey("68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, loanAmount, duration, asset } = req.body;

  if (!walletAddress || !loanAmount || !duration || !asset) {
    return res.status(400).json({ 
      message: 'All fields are required: walletAddress, loanAmount, duration, asset' 
    });
  }

    if (asset !== 'USDC') {
    return res.status(400).json({
      message: 'Asset must be USDC' 
    });
  }

  if (![1, 2, 3].includes(duration)) {
    return res.status(400).json({ 
      message: 'Duration must be 1, 2, or 3 months' 
    });
  }

  try {
    // Setup Solana connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    anchor.setProvider(provider);
    
    // Create program instance using IDL
    const program = new anchor.Program(lendingIdl as anchor.Idl,  provider) as anchor.Program<Lendingprogram>;
    
    // Derive global market PDA
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      LENDING_PROGRAM_ID
    );

    // Setup accounts
    const userWallet = new PublicKey(walletAddress);
    
    // Convert duration to seconds
    const durationSeconds = duration * 30 * 24 * 60 * 60; // Approximate months to seconds
    
    // Determine asset mint
    const assetMint = new PublicKey('5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR'); // USDC devnet

    // Derive PDAs
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );

    // Check if borrower account exists and get loan counter
    let borrowerAccountInfo: any;
    try {
      console.log('🔍 Checking borrower account:', borrowerAccountPda.toString());
      const accountInfo = await connection.getAccountInfo(borrowerAccountPda);
      
      if (!accountInfo) {
        console.log('❌ No borrower account found');
        return res.status(400).json({
          message: 'No borrower account found. Please deposit NFTs first to establish borrowing power.'
        });
      }
      
      console.log('✅ Borrower account exists, fetching data...');
      // Parse borrower account data to get loan counter
      const borrowerData = await (program.account as any).borrowerAccount.fetch(borrowerAccountPda);
      borrowerAccountInfo = { 
        loanCounter: borrowerData.loanCounter.toNumber(),
        totalBorrowingPower: borrowerData.totalBorrowingPowerUsd.toString(),
        totalDebt: borrowerData.totalDebtUsd.toString(),
        depositedNfts: borrowerData.depositedNfts.length
      };
      
      console.log('📊 Borrower account data:', borrowerAccountInfo);
      
      // Check if user has sufficient borrowing power
      const availableBorrowingPower = (borrowerData.totalBorrowingPowerUsd.toNumber() - borrowerData.totalDebtUsd.toNumber()) / 1_000_000;
      if (availableBorrowingPower < loanAmount) {
        return res.status(400).json({
          message: `Insufficient borrowing power. Available: $${availableBorrowingPower.toFixed(2)}, Requested: $${loanAmount}`
        });
      }
      
    } catch (error) {
      console.error('❌ Error fetching borrower account:', error);
      return res.status(500).json({
        message: 'Error fetching borrower account data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create loan PDA using loan counter
    const loanCounterBuffer = Buffer.alloc(8);
    loanCounterBuffer.writeBigUInt64LE(BigInt(borrowerAccountInfo.loanCounter));
    
    const [loanPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("loan"), userWallet.toBuffer(), loanCounterBuffer],
      LENDING_PROGRAM_ID
    );

    // Get capital vault from the lending program (CORRECT: lending program owns its capital vault)
    const [capitalVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("capital_vault_usdc")],
      LENDING_PROGRAM_ID
    );
    
    console.log('🏦 Using LENDING PROGRAM capital vault:', capitalVault.toString());
    console.log('🔍 This should match the funded vault:', 'He84QophgrA8GCQTGjkLkUi5qjKCF5Qmrb4Q6Nrt3jL9');
      
    // Treasury wallet (admin's actual wallet for fees)
    const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
    
    // Treasury wallet's token account for the asset
    const treasuryTokenAccount = await getAssociatedTokenAddress(assetMint, treasuryWallet);

    // Get borrower's token account
    const borrowerTokenAccount = await getAssociatedTokenAddress(assetMint, userWallet);

    // Convert loan amount to lamports (assuming 6 decimals for USDC)
    const loanAmountLamports = Math.floor(loanAmount * 1_000_000);

    // Verify all required accounts exist
    console.log('🔍 Verifying required accounts...');
    console.log('Global Market:', globalMarketPda.toString());
    console.log('Borrower Account:', borrowerAccountPda.toString());
    console.log('Loan PDA:', loanPda.toString());
    console.log('Capital Vault:', capitalVault.toString());
    console.log('Treasury Token Account:', treasuryTokenAccount.toString());
    console.log('Borrower Token Account:', borrowerTokenAccount.toString());

    // Check if borrower token account exists, create if not
    try {
      const borrowerTokenAccountInfo = await connection.getAccountInfo(borrowerTokenAccount);
      if (!borrowerTokenAccountInfo) {
        console.log('⚠️ Borrower token account does not exist, will be created by transaction');
      }
    } catch (error) {
      console.log('⚠️ Error checking borrower token account:', error);
    }

    // Build take loan transaction
    console.log('🏗️ Building take loan instruction...');
    let takeLoanInstruction;
    try {
      takeLoanInstruction = await (program.methods as any)
        .takeLoan(
          new anchor.BN(loanAmountLamports),
          durationSeconds
        )
        .accounts({
          globalMarket: globalMarketPda,
          borrowerAccount: borrowerAccountPda,
          loan: loanPda,
          assetMint: assetMint,
          capitalVault: capitalVault,
          treasuryTokenAccount: treasuryTokenAccount,
          treasuryWallet: treasuryWallet,
          borrowerTokenAccount: borrowerTokenAccount,
          borrower: userWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .instruction();
        
      console.log('✅ Take loan instruction created successfully');
    } catch (error) {
      console.error('❌ Error creating take loan instruction:', error);
      return res.status(500).json({
        message: 'Failed to create loan instruction',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create transaction
    const transaction = new Transaction();
    
    // Add instruction to create borrower's associated token account if it doesn't exist
    try {
      const borrowerTokenAccountInfo = await connection.getAccountInfo(borrowerTokenAccount);
      if (!borrowerTokenAccountInfo) {
        console.log('📝 Adding instruction to create borrower token account...');
        const createATAInstruction = createAssociatedTokenAccountInstruction(
          userWallet, // payer
          borrowerTokenAccount, // ata
          userWallet, // owner
          assetMint // mint
        );
        transaction.add(createATAInstruction);
      }
    } catch (error) {
      console.log('⚠️ Error checking if need to create ATA:', error);
    }
    
    transaction.add(takeLoanInstruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Serialize transaction for frontend
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    console.log(`✅ Created take loan transaction for wallet: ${walletAddress}`, {
      amount: loanAmount,
      duration: `${duration} months`,
      asset
    });

    res.status(200).json({
      message: 'Take loan transaction created successfully',
      transaction: serializedTransaction.toString('base64'),
      lastValidBlockHeight,
      loanDetails: {
        loanPda: loanPda.toString(),
        principalAmount: loanAmount,
        duration: `${duration} month${duration > 1 ? 's' : ''}`,
        asset,
        borrowerAccount: borrowerAccountPda.toString(),
      }
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({ 
      message: 'Failed to create loan',
      error: error.toString()
    });
  }
}
