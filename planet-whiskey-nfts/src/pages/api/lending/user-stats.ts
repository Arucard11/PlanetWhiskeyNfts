import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getSolanaConnection, getAnchorProvider } from '../../../lib/solanaUtils';

interface BorrowingStats {
  perNftValue: number; // Average value for display (deprecated, but kept for compatibility)
  ltvRatio: number; // 80% = 8000 bps
  maxNftsPerUser: number;
  currentBorrowingPower: number;
  currentDebt: number;
  availableToBorrow: number;
  depositedNfts: number;
  collectionValues: { [collectionMint: string]: number }; // New: individual collection values
}

function loadLendingProgram() {
  try {
    const connection = getSolanaConnection();
    
    // Use a temporary keypair for read-only operations
    const tempKeypair = Keypair.generate();
    const provider = getAnchorProvider(tempKeypair);
    
    // Load the lending program IDL
    const lendingIdl = require('@/lib/idl/lendingprogram.json');
    const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
    
    const program = new anchor.Program(lendingIdl, provider);
    
    return { program, connection, LENDING_PROGRAM_ID };
  } catch (error) {
    console.error('❌ Error loading lending program:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress } = req.query;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ message: 'Wallet address is required' });
  }

  try {
    // Load lending program using environment variables
    const lendingProgramData = loadLendingProgram();
    if (!lendingProgramData) {
      return res.status(500).json({ 
        message: 'Failed to load lending program' 
      });
    }

    const { program, connection, LENDING_PROGRAM_ID } = lendingProgramData;

    // Derive global market PDA using environment variable
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    // Derive collection registry PDA
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      LENDING_PROGRAM_ID
    );

    // Fetch global market data for protocol configuration
    const globalMarketAccount = await program.account.globalMarket.fetch(globalMarketPda);
    
    // Fetch collection registry to get individual collection values
    const collectionRegistry = await program.account.collectionRegistry.fetch(collectionRegistryPda);
    
    // Build collection values map
    const collectionValues: { [key: string]: number } = {};
    let totalValue = 0;
    let approvedCount = 0;
    
    collectionRegistry.collections.forEach((collection: any) => {
      if (collection.isApproved) {
        const valueUsd = collection.valueUsd.toNumber() / 1_000_000; // Convert from micro-dollars
        collectionValues[collection.mint.toString()] = valueUsd;
        totalValue += valueUsd;
        approvedCount++;
      }
    });
    
    // Calculate average NFT value for backward compatibility
    const averageNftValue = approvedCount > 0 ? totalValue / approvedCount : 100; // Default $100

    console.log('📊 Collection values loaded:', {
      totalCollections: collectionRegistry.collections.length,
      approvedCollections: approvedCount,
      averageValue: averageNftValue,
    });

    // Derive user's BorrowerAccount PDA
    const userWallet = new PublicKey(walletAddress);
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );

    let userBorrowingStats: BorrowingStats;

    try {
      // Try to fetch user's borrower account
      const borrowerAccount = await program.account.borrowerAccount.fetch(borrowerAccountPda);
      
      // Calculate stats from on-chain data
      const ltvRatio = globalMarketAccount.loanToValueRatioBps;
      const depositedNftsCount = borrowerAccount.depositedNfts.length;
      
      // Fix: Convert borrowing power from micro-dollars to dollars
      // The on-chain data was stored incorrectly (treating micro-dollars as dollars)
      // So we need to divide by 1,000,000 to get the correct USD amount
      const totalBorrowingPowerRaw = Number(borrowerAccount.totalBorrowingPowerUsd);
      const totalBorrowingPower = totalBorrowingPowerRaw / 1_000_000; // Convert from micro-dollars
      
      const totalDebtRaw = Number(borrowerAccount.totalDebtUsd);
      const totalDebt = totalDebtRaw / 1_000_000; // Convert from micro-dollars
      
      // SECURITY FIX: Only show borrowing power if user has deposited NFTs
      const safeBorrowingPower = depositedNftsCount > 0 ? totalBorrowingPower : 0;
      const safeAvailableToBorrow = depositedNftsCount > 0 ? Math.max(0, totalBorrowingPower - totalDebt) : 0;
      
      userBorrowingStats = {
        perNftValue: averageNftValue, // Use calculated average
        ltvRatio,
        maxNftsPerUser: 5, // Hardcoded in protocol
        currentBorrowingPower: safeBorrowingPower,
        currentDebt: totalDebt,
        availableToBorrow: safeAvailableToBorrow,
        depositedNfts: depositedNftsCount,
        collectionValues // Include individual collection values
      };

      console.log(`✅ Fetched real lending stats for wallet: ${walletAddress}`, {
        depositedNfts: depositedNftsCount,
        borrowingPower: totalBorrowingPower,
        debt: totalDebt,
        collectionsWithValues: Object.keys(collectionValues).length
      });
      
    } catch (borrowerAccountError) {
      // User doesn't have a borrower account yet (hasn't deposited any NFTs)
      console.log(`No borrower account found for wallet: ${walletAddress}, returning default stats`);
      
      const ltvRatio = globalMarketAccount.loanToValueRatioBps;
      
      userBorrowingStats = {
        perNftValue: averageNftValue, // Use calculated average
        ltvRatio,
        maxNftsPerUser: 5,
        currentBorrowingPower: 0,
        currentDebt: 0,
        availableToBorrow: 0,
        depositedNfts: 0,
        collectionValues // Include individual collection values
      };
    }
    
    res.status(200).json(userBorrowingStats);
  } catch (error) {
    console.error('Error fetching user lending stats:', error);
    res.status(500).json({ 
      message: 'Failed to fetch lending stats',
      error: error.toString()
    });
  }
}
