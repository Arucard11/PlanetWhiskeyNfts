import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import { getCurrentWhiskeyRate } from '../../../lib/coingeckoPricing';
import lendingIdl from '../../../lib/idl/lendingprogram.json';

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
const WHISKEY_TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_TOKEN_MINT!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, loanId, repaymentAmountUsd } = req.body;

  if (!walletAddress || !loanId || !repaymentAmountUsd) {
    return res.status(400).json({ 
      message: 'All fields are required: walletAddress, loanId, repaymentAmountUsd' 
    });
  }

  if (repaymentAmountUsd <= 0) {
    return res.status(400).json({ 
      message: 'Repayment amount must be greater than 0' 
    });
  }

  try {
    // Get current WHISKEY price
    const currentWhiskeyRate = await getCurrentWhiskeyRate();
    console.log('📊 Current WHISKEY price:', currentWhiskeyRate);

    // Calculate WHISKEY amount needed (with 6 decimals)
    const whiskeyAmountNeeded = (repaymentAmountUsd / currentWhiskeyRate) * 1_000_000;
    
    // Add 1% buffer to account for price fluctuations
    const whiskeyAmountWithBuffer = Math.ceil(whiskeyAmountNeeded * 1.01);

    console.log('💰 Repayment calculation:', {
      repaymentAmountUsd,
      currentWhiskeyRate,
      whiskeyAmountNeeded: whiskeyAmountNeeded / 1_000_000,
      whiskeyAmountWithBuffer: whiskeyAmountWithBuffer / 1_000_000
    });

    // Setup Solana connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    anchor.setProvider(provider);
    
    // Create program instance using IDL
    const program = new anchor.Program(lendingIdl as anchor.Idl, provider) as anchor.Program<Lendingprogram>;
    
    // Setup accounts
    const userWallet = new PublicKey(walletAddress);
    const loanPda = new PublicKey(loanId);
    
    console.log('🔍 Repay Loan Debug:');
    console.log('  Connected wallet:', walletAddress);
    console.log('  Loan ID:', loanId);
    
    // Fetch loan and ensure it belongs to this wallet's borrowerAccount PDA
    let borrowerAccountFromLoan: PublicKey;
    try {
      const loanAccount: any = await (program.account as any).loan.fetch(loanPda);
      borrowerAccountFromLoan = new PublicKey(loanAccount.borrowerAccount);
    } catch (e) {
      return res.status(400).json({
        message: 'Invalid loan account',
        details: e instanceof Error ? e.message : String(e)
      });
    }

    // Derive global market PDA
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      LENDING_PROGRAM_ID
    );
    
    // Derive borrower account PDA per program seeds using the borrower signer
    const [borrowerAccountPda, derivedBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );
    
    console.log('  Derived borrower PDA:', borrowerAccountPda.toString());
    console.log('  Derived bump:', derivedBump);
    console.log('  Loan borrower account:', borrowerAccountFromLoan.toString());

    if (!borrowerAccountFromLoan.equals(borrowerAccountPda)) {
      return res.status(400).json({
        message: 'This loan does not belong to the connected wallet.',
        expectedBorrowerAccount: borrowerAccountFromLoan.toBase58(),
        connectedWalletBorrowerAccount: borrowerAccountPda.toBase58(),
      });
    }

    // Borrower account validation - program now handles bump automatically

    const borrowerAccountToUse = borrowerAccountPda;
    
    // WHISKEY token mint
    const whiskeyTokenMint = WHISKEY_TOKEN_MINT;
    
    // Get borrower's WHISKEY token account
    const borrowerWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyTokenMint, userWallet);
    
    // Treasury wallet and its WHISKEY token account
    const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
    const treasuryWhiskeyTokenAccount = await getAssociatedTokenAddress(whiskeyTokenMint, treasuryWallet);

    // Convert WHISKEY price to program format (6 decimals)
    const whiskeyPriceForProgram = Math.floor(currentWhiskeyRate * 1_000_000);

    // Build repayment transaction
    const repaymentInstruction = await (program.methods as any)
      .makeInterestPayment(
        new anchor.BN(whiskeyAmountWithBuffer),
        new anchor.BN(whiskeyPriceForProgram)
      )
      .accounts({
        loan: loanPda,
        borrowerAccount: borrowerAccountToUse,
        globalMarket: globalMarketPda,
        borrowerWhiskeyTokenAccount: borrowerWhiskeyTokenAccount,
        treasuryWhiskeyTokenAccount: treasuryWhiskeyTokenAccount,
        treasuryWallet: treasuryWallet,
        borrower: userWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Create transaction
    const transaction = new Transaction();
    transaction.add(repaymentInstruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Serialize transaction for frontend
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    console.log(`✅ Created loan repayment transaction for wallet: ${walletAddress}`, {
      loanId,
      repaymentAmountUsd,
      whiskeyAmountNeeded: whiskeyAmountWithBuffer / 1_000_000,
      currentWhiskeyRate
    });

    res.status(200).json({
      message: 'Loan repayment transaction created successfully',
      transaction: serializedTransaction.toString('base64'),
      lastValidBlockHeight,
      repaymentDetails: {
        loanId,
        repaymentAmountUsd,
        whiskeyAmountNeeded: whiskeyAmountWithBuffer / 1_000_000,
        whiskeyAmountWithBuffer,
        currentWhiskeyRate,
        asset: 'WHISKEY'
      }
    });
  } catch (error) {
    console.error('Error creating repayment transaction:', error);
    res.status(500).json({ 
      message: 'Failed to create repayment transaction',
      error: error.toString()
    });
  }
}
