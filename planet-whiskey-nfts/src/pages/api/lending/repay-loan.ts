import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import { getCurrentWhiskeyRate } from '../../../lib/coingeckoPricing';
import lendingIdl from '../../../lib/idl/lendingprogram.json';

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
const WHISKEY_TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_MINT!);
const USDC_MINT = new PublicKey(process.env.NEXT_PUBLIC_USDC_MINT!);
const TREASURY_WALLET = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  console.log('📥 Received request body:', req.body);
  
  const { walletAddress, loanId, repaymentAmountUsd, signature, clientSideTransaction } = req.body;

  if (!walletAddress || !loanId) {
    console.error('❌ Missing required fields:', { walletAddress, loanId });
    return res.status(400).json({ 
      message: 'All fields are required: walletAddress, loanId' 
    });
  }

  // If this is a client-side transaction, just validate and record
  if (clientSideTransaction && signature) {
    try {
      console.log('📝 Recording client-side loan repayment:', {
        walletAddress,
        loanId,
        repaymentAmountUsd,
        signature,
        timestamp: new Date().toISOString()
      });

      // TODO: Store in database if needed
      // For now, just validate and return success
      
      return res.status(200).json({ 
        success: true, 
        message: 'Loan repayment recorded successfully',
        signature 
      });
    } catch (error) {
      console.error('Error recording client-side repayment:', error);
      return res.status(500).json({ 
        error: 'Failed to record repayment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  console.log('💰 Repayment request details:', { walletAddress, loanId, repaymentAmountUsd });

  console.log('✅ Request validation passed:', { walletAddress, loanId });

  // Validate environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_LENDING_PROGRAM_ID',
    'NEXT_PUBLIC_WHISKEY_MINT',
    'NEXT_PUBLIC_USDC_MINT',
    'NEXT_PUBLIC_TREASURY_WALLET',
    'NEXT_PUBLIC_SOLANA_RPC_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing environment variable: ${envVar}`);
      return res.status(500).json({ 
        message: `Server configuration error: Missing ${envVar}` 
      });
    }
  }

  try {
    // Get current WHISKEY price
    const currentWhiskeyRate = await getCurrentWhiskeyRate();
    console.log('📊 Current WHISKEY price:', currentWhiskeyRate);

    // Setup Solana connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    anchor.setProvider(provider);
    
    // Create program instance using IDL
    const program = new anchor.Program(lendingIdl as anchor.Idl, provider) as anchor.Program<Lendingprogram>;
    
    // Setup accounts
    const userWallet = new PublicKey(walletAddress);
    const loanPda = new PublicKey(loanId);
    
    console.log('🔍 Dual Payment Loan Repay Debug:');
    console.log('  Connected wallet:', walletAddress);
    console.log('  Loan ID:', loanId);
    
    // Fetch loan data
    let loanAccount: any;
    try {
      loanAccount = await program.account.loan.fetch(loanPda);
      console.log('📋 Loan account data:', {
        borrowerAccount: loanAccount.borrowerAccount.toString(),
        principalAmountUsd: loanAccount.principalAmountUsd.toString(),
        interestRateAtOriginationBps: loanAccount.interestRateAtOriginationBps.toString(),
        interestPaidUsd: loanAccount.interestPaidUsd.toString(),
        status: loanAccount.status,
      });
    } catch (error) {
      console.error('❌ Error fetching loan account:', error);
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Calculate repayment amounts
    const principalAmountMicro = BigInt(loanAccount.principalAmountUsd); // Already in micro-dollars (6 decimals)
    const interestRateAtOriginationBps = BigInt(loanAccount.interestRateAtOriginationBps);
    const interestPaidMicro = BigInt(loanAccount.interestPaidUsd);

    // Calculate total interest due
    const totalInterestMicro = (principalAmountMicro * interestRateAtOriginationBps) / BigInt(10000);
    const remainingInterestMicro = totalInterestMicro - interestPaidMicro;

    // Convert to regular units for display and calculations
    const principalAmountUsd = Number(principalAmountMicro) / 1_000_000;
    const remainingInterestUsd = Number(remainingInterestMicro) / 1_000_000;

    // For dual payment: USDC for principal, WHISKEY for interest only
    let actualRepaymentAmountUsd = remainingInterestUsd;
    let isFullRepayment = false;
    
    if (repaymentAmountUsd && repaymentAmountUsd > 0) {
      // Check if this is a full repayment (principal + interest)
      const totalOwedUsd = principalAmountUsd + remainingInterestUsd;
      if (Math.abs(repaymentAmountUsd - totalOwedUsd) < 0.001) {
        // This is a full repayment
        isFullRepayment = true;
        actualRepaymentAmountUsd = remainingInterestUsd; // WHISKEY only for interest
        console.log('💡 Full repayment detected: USDC for principal ($' + principalAmountUsd + '), WHISKEY for interest ($' + remainingInterestUsd + ')');
      } else {
        // Partial payment - use specified amount for interest only
        actualRepaymentAmountUsd = repaymentAmountUsd;
        console.log('💡 Partial payment: WHISKEY for interest ($' + actualRepaymentAmountUsd + ')');
      }
    } else {
      // Default to remaining interest only
      console.log('💡 No repayment amount specified, using remaining interest only:', actualRepaymentAmountUsd);
    }

    // Calculate WHISKEY amount needed for the INTEREST portion only (with 6 decimals)
    const whiskeyAmountNeeded = (actualRepaymentAmountUsd / currentWhiskeyRate) * 1_000_000;
    // Add 1% buffer to account for price fluctuations
    const whiskeyAmountWithBuffer = Math.ceil(whiskeyAmountNeeded * 1.01);

    console.log('💰 Dual Payment Calculations:');
    console.log('  🔵 Principal (USDC to Capital Vault): $', principalAmountUsd);
    console.log('  🟡 Interest remaining: $', remainingInterestUsd);
    console.log('  💵 Interest Amount (WHISKEY): $', actualRepaymentAmountUsd);
    console.log('  🥃 WHISKEY tokens needed (interest only):', whiskeyAmountWithBuffer / 1_000_000);
    console.log('  📊 Current WHISKEY rate: $', currentWhiskeyRate);
    console.log('  ⚡ DUAL PAYMENT: Principal (' + principalAmountUsd + ' USDC) + Interest (' + (whiskeyAmountWithBuffer / 1_000_000) + ' WHISKEY)');
    console.log('  🔍 Smart Contract expects:');
    console.log('    - Principal (micro-USDC):', loanAccount.principalAmountUsd);
    console.log('    - Interest (WHISKEY tokens):', whiskeyAmountWithBuffer);
    console.log('    - WHISKEY price (micro-USD):', Math.floor(currentWhiskeyRate * 1_000_000));

    // Derive PDAs
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );

    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      LENDING_PROGRAM_ID
    );

    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("capital_vault_usdc")],
      LENDING_PROGRAM_ID
    );

    // Get associated token accounts
    const borrowerUsdcTokenAccount = await getAssociatedTokenAddress(USDC_MINT, userWallet);
    const borrowerWhiskeyTokenAccount = await getAssociatedTokenAddress(WHISKEY_TOKEN_MINT, userWallet);
    const treasuryWhiskeyTokenAccount = await getAssociatedTokenAddress(WHISKEY_TOKEN_MINT, TREASURY_WALLET);

    console.log('🏦 Account Addresses:');
    console.log('  Borrower Account PDA:', borrowerAccountPda.toString());
    console.log('  Global Market PDA:', globalMarketPda.toString());
    console.log('  Capital Vault PDA:', capitalVaultPda.toString());
    console.log('  Borrower USDC Account:', borrowerUsdcTokenAccount.toString());
    console.log('  Borrower WHISKEY Account:', borrowerWhiskeyTokenAccount.toString());
    console.log('  Treasury WHISKEY Account:', treasuryWhiskeyTokenAccount.toString());

    // Convert current WHISKEY price to program format (6 decimals)
    const currentWhiskeyPriceProgram = Math.floor(currentWhiskeyRate * 1_000_000);

    // Build the dual payment transaction
    const instruction = await program.methods
      .repayLoanDualPayment(
        new anchor.BN(loanAccount.principalAmountUsd), // USDC principal amount (micro-dollars)
        new anchor.BN(whiskeyAmountWithBuffer), // WHISKEY interest amount (with 6 decimals)
        new anchor.BN(currentWhiskeyPriceProgram) // Current WHISKEY price (with 6 decimals)
      )
      .accounts({
        loan: loanPda,
        borrowerAccount: borrowerAccountPda,
        globalMarket: globalMarketPda,
        capitalVault: capitalVaultPda,
        borrowerUsdcTokenAccount: borrowerUsdcTokenAccount,
        borrowerWhiskeyTokenAccount: borrowerWhiskeyTokenAccount,
        treasuryWhiskeyTokenAccount: treasuryWhiskeyTokenAccount,
        treasuryWallet: TREASURY_WALLET,
        borrower: userWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .instruction();

    const transaction = new Transaction().add(instruction);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Serialize transaction for client
    const serializedTransaction = transaction.serialize({ requireAllSignatures: false });
    const transactionBase64 = serializedTransaction.toString('base64');

    console.log('✅ Dual payment transaction prepared successfully');

    return res.status(200).json({
      success: true,
      transaction: transactionBase64,
      message: 'Dual payment transaction prepared successfully',
      paymentDetails: {
        principalUSDC: principalAmountUsd,
        repaymentWhiskey: whiskeyAmountWithBuffer / 1_000_000,
        repaymentUSDValue: actualRepaymentAmountUsd,
        whiskeyPrice: currentWhiskeyRate,
        totalUSDValue: principalAmountUsd + actualRepaymentAmountUsd
      },
      paymentBreakdown: {
        type: 'DUAL_PAYMENT',
        principal: {
          amount: principalAmountUsd,
          currency: 'USDC',
          destination: 'Capital Vault'
        },
        repayment: {
          amountUSD: actualRepaymentAmountUsd,
          amountWhiskey: whiskeyAmountWithBuffer / 1_000_000,
          currency: 'WHISKEY',
          destination: 'Treasury Wallet',
          whiskeyPrice: currentWhiskeyRate
        }
      }
    });

  } catch (error) {
    console.error('❌ Error preparing dual payment transaction:', error);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return res.status(500).json({ 
      message: 'Failed to prepare dual payment transaction',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
}