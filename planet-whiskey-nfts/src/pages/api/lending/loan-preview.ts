import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from '@solana/web3.js';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import lendingIdl from '../../../lib/idl/lendingprogram.json';

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");

interface LoanPreview {
  loanAmount: number;
  duration: number; // in months
  interestRate: number; // percentage
  interestAmount: number; // in USD
  totalRepayment: number; // in USD
  monthlyRate: number; // percentage
  durationInDays: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { loanAmount, duration } = req.body; // loanAmount in USD, duration in months

  if (!loanAmount || !duration || typeof loanAmount !== 'number' || typeof duration !== 'number') {
    return res.status(400).json({ message: 'Loan amount and duration are required' });
  }

  if (![1, 2, 3].includes(duration)) {
    return res.status(400).json({ message: 'Duration must be 1, 2, or 3 months' });
  }

  try {
    // Setup Solana connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    anchor.setProvider(provider);
    
    // Create program instance using IDL
    const program = new anchor.Program(lendingIdl as anchor.Idl, provider) as anchor.Program<Lendingprogram>;
    
    // Derive global market PDA
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      LENDING_PROGRAM_ID
    );

    // Get global market data to fetch current interest rates
    const globalMarketAccount = await program.account.globalMarket.fetch(globalMarketPda);
    
    // Get base rate based on duration
    let baseRateBps: number;
    switch (duration) {
      case 1:
        baseRateBps = globalMarketAccount.baseInterestRate1MonthBps;
        break;
      case 2:
        baseRateBps = globalMarketAccount.baseInterestRate2MonthBps;
        break;
      case 3:
        baseRateBps = globalMarketAccount.baseInterestRate3MonthBps;
        break;
      default:
        return res.status(400).json({ message: 'Invalid duration' });
    }
    
    // Calculate dynamic interest rate based on utilization
    // This replicates the smart contract's calculate_dynamic_interest_rate function
    let dynamicRateBps = baseRateBps;
    
    if (globalMarketAccount.totalLiquidityAvailableUsd > 0) {
      const utilizationRateBps = Math.floor(
        (Number(globalMarketAccount.totalLiquidityBorrowedUsd) * 10000) / 
        Number(globalMarketAccount.totalLiquidityAvailableUsd)
      );
      
      if (utilizationRateBps <= globalMarketAccount.optimalUtilizationRateBps) {
        // Before optimal utilization - gradual increase
        const utilizationMultiplier = (utilizationRateBps * globalMarketAccount.utilizationSlope1Bps) / 10000;
        dynamicRateBps = baseRateBps + Math.floor(utilizationMultiplier);
      } else {
        // After optimal utilization - steep increase
        const optimalRate = baseRateBps + Math.floor(
          (globalMarketAccount.optimalUtilizationRateBps * globalMarketAccount.utilizationSlope1Bps) / 10000
        );
        const excessUtilization = utilizationRateBps - globalMarketAccount.optimalUtilizationRateBps;
        const steepIncrease = Math.floor((excessUtilization * globalMarketAccount.utilizationSlope2Bps) / 10000);
        dynamicRateBps = optimalRate + steepIncrease;
      }
      
      // Cap at maximum rate
      const maxRate = Math.floor((baseRateBps * globalMarketAccount.maxInterestRateMultiplierBps) / 10000);
      if (dynamicRateBps > maxRate) {
        dynamicRateBps = maxRate;
      }
    }
    
    // Convert to percentage
    const interestRatePercent = dynamicRateBps / 100;
    
    // Calculate interest amount (simple interest, not compound)
    const interestAmount = (loanAmount * dynamicRateBps) / 10000;
    const totalRepayment = loanAmount + interestAmount;
    
    // Calculate duration in days
    const durationInDays = duration * 30; // Approximate
    
    const preview: LoanPreview = {
      loanAmount,
      duration,
      interestRate: interestRatePercent,
      interestAmount,
      totalRepayment,
      monthlyRate: interestRatePercent / duration, // Monthly equivalent
      durationInDays
    };
    
    console.log(`📊 Loan Preview Generated:`);
    console.log(`  Amount: $${loanAmount}`);
    console.log(`  Duration: ${duration} months (${durationInDays} days)`);
    console.log(`  Base Rate: ${baseRateBps / 100}%`);
    console.log(`  Dynamic Rate: ${interestRatePercent}%`);
    console.log(`  Interest Amount: $${interestAmount.toFixed(2)}`);
    console.log(`  Total Repayment: $${totalRepayment.toFixed(2)}`);
    
    res.status(200).json(preview);
    
  } catch (error) {
    console.error('Error generating loan preview:', error);
    res.status(500).json({ 
      message: 'Failed to generate loan preview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
