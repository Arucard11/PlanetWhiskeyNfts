import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import lendingprogramIdl from '@/lib/idl/lendingprogram.json';
import { Lendingprogram } from '@/lib/idl/lendingprogram';

// Program ID from environment variables
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    if (req.method === 'GET') {
      try {
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
          'confirmed'
        );

        const provider = new anchor.AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
        const program = new anchor.Program(lendingprogramIdl as anchor.Idl, provider);

        console.log('🔍 Fetching GlobalMarket account using Anchor...');
        const globalMarketAccount = await (program.account as any).globalMarket.fetch(globalMarketPda);
        console.log('✅ Successfully deserialized GlobalMarket account with Anchor.');
        console.log('📊 Raw GlobalMarket account data:', JSON.stringify(globalMarketAccount, null, 2));

        res.status(200).json({
          success: true,
          message: 'Lending configuration loaded successfully',
          maxStakedNfts: globalMarketAccount.maxStakedNfts,
          currentStakedNfts: globalMarketAccount.currentStakedNfts,
          perNftValueUsd: Number(globalMarketAccount.perNftValueUsd) / 1_000_000,
          interestRate1MonthBps: globalMarketAccount.baseInterestRate1MonthBps,
          interestRate2MonthBps: globalMarketAccount.baseInterestRate2MonthBps,
          interestRate3MonthBps: globalMarketAccount.baseInterestRate3MonthBps,
          optimalUtilizationRateBps: globalMarketAccount.optimalUtilizationRateBps,
          maxInterestRateMultiplierBps: globalMarketAccount.maxInterestRateMultiplierBps,
          utilizationSlope1Bps: globalMarketAccount.utilizationSlope1Bps,
          utilizationSlope2Bps: globalMarketAccount.utilizationSlope2Bps,
          transactionFeeBps: globalMarketAccount.transactionFeeBps,
          lendingWalletShareBps: globalMarketAccount.lendingWalletShareBps,
          treasuryWalletShareBps: globalMarketAccount.treasuryWalletShareBps,
          loanToValueRatioBps: globalMarketAccount.loanToValueRatioBps,
          globalMarketPda: globalMarketPda.toString(),
          lendingProgramId: LENDING_PROGRAM_ID.toString(),
          network: process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.includes('devnet') ? 'Devnet' : 'Mainnet'
        });

      } catch (error) {
        console.error('Error fetching account info:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch account information',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } else if (req.method === 'PUT') {
        // Handle configuration updates
        const {
          interestRate1MonthBps,
          interestRate2MonthBps,
          interestRate3MonthBps,
          optimalUtilizationRateBps,
          maxInterestRateMultiplierBps,
          utilizationSlope1Bps,
          utilizationSlope2Bps,
          loanToValueRatioBps,
          transactionFeeBps,
          lendingWalletShareBps,
          treasuryWalletShareBps,
          maxStakedNfts,
          perNftValueUsd
        } = req.body;

        console.log('🔄 Updating GlobalMarket configuration...');
        console.log('📝 Update parameters:', req.body);

        try {
          const connection = new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
            'confirmed'
          );

          const provider = new anchor.AnchorProvider(connection, {} as any, { commitment: 'confirmed' });
          const program = new anchor.Program(lendingprogramIdl as anchor.Idl, provider);

          // Create the update instruction with ALL parameters
          const updateInstruction = await program.methods
            .updateAdminSettings(
              interestRate1MonthBps || null,
              interestRate2MonthBps || null,
              interestRate3MonthBps || null,
              optimalUtilizationRateBps || null,
              maxInterestRateMultiplierBps || null,
              utilizationSlope1Bps || null,
              utilizationSlope2Bps || null,
              loanToValueRatioBps || null,
              transactionFeeBps || null,
              lendingWalletShareBps || null,
              treasuryWalletShareBps || null,
              maxStakedNfts || null,
              perNftValueUsd ? new anchor.BN(perNftValueUsd * 1_000_000) : null // Convert to microdollars
            )
            .accounts({
              globalMarket: globalMarketPda,
              admin: new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET || '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk'), // Admin wallet
            })
            .instruction();

          // Create transaction
          const transaction = new anchor.web3.Transaction();
          transaction.add(updateInstruction);

          // Get recent blockhash
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET || '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk');

          console.log('✅ Transaction prepared for admin wallet signing');

          res.status(200).json({
            success: true,
            message: 'Transaction prepared successfully',
            requiresWalletSigning: true,
            adminWallet: '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk',
            transaction: transaction.serialize({ requireAllSignatures: false }),
            globalMarketPda: globalMarketPda.toString(),
          });

        } catch (error) {
          console.error('❌ Error preparing update transaction:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to prepare update transaction',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

  } catch (error) {
    console.error('Error in lending config handler:', error);
    res.status(500).json({ 
      message: 'Failed to process lending configuration request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// REMOVED: withAdminAuth middleware - Client-side wallet signing doesn't need server-side admin session
// Admin wallet verification happens in the Rust program itself
export default handler;