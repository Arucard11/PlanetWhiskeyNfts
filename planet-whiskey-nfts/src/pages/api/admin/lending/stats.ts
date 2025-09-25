import { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import lendingprogramIdl from '@/lib/idl/lendingprogram.json';

// Program ID from environment variables
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    console.log('🔍 Fetching lending statistics from GlobalMarket:', globalMarketPda.toString());

    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );

    const provider = new anchor.AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
    const program = new anchor.Program(lendingprogramIdl as anchor.Idl, provider);

    console.log('🔍 Fetching GlobalMarket account using Anchor...');
    const globalMarketAccount = await (program.account as any).globalMarket.fetch(globalMarketPda);
    console.log('✅ Successfully deserialized GlobalMarket account with Anchor.');
    console.log('📊 Raw GlobalMarket account data for stats:', JSON.stringify(globalMarketAccount, null, 2));

    // Calculate utilization rate
    const totalLiquidityAvailable = Number(globalMarketAccount.totalLiquidityAvailableUsd);
    const totalLiquidityBorrowed = Number(globalMarketAccount.totalLiquidityBorrowedUsd);
    const utilizationRate = totalLiquidityAvailable > 0 
      ? (totalLiquidityBorrowed / totalLiquidityAvailable) * 100 
      : 0;

    res.status(200).json({
      success: true,
      message: 'Lending statistics loaded successfully',
      stats: {
        totalLoansActive: 0, // Would need to query all loan accounts for real count
        totalDebtOutstanding: (totalLiquidityBorrowed / 1_000_000).toFixed(2),
        totalCollateralValue: (globalMarketAccount.currentStakedNfts * Number(globalMarketAccount.perNftValueUsd) / 1_000_000).toFixed(2),
        averageNftValue: (Number(globalMarketAccount.perNftValueUsd) / 1_000_000).toFixed(2),
        currentUtilizationRate: utilizationRate,
        availableLiquidity: ((totalLiquidityAvailable - totalLiquidityBorrowed) / 1_000_000).toFixed(2),
        maxStakedNfts: globalMarketAccount.maxStakedNfts,
        currentStakedNfts: globalMarketAccount.currentStakedNfts,
      },
      globalMarketPda: globalMarketPda.toString(),
      lendingProgramId: LENDING_PROGRAM_ID.toString(),
      network: process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('devnet') ? 'Devnet' : 'Mainnet'
    });

  } catch (error) {
    console.error('Error fetching lending statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lending statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withAdminAuth(handler);