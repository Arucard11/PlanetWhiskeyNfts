import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from '@solana/web3.js';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import lendingIdl from '../../../lib/idl/lendingprogram.json';

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);

interface LoanInfo {
  loanId: string;
  principalAmount: number;
  interestRate: number;
  duration: string;
  startDate: string;
  dueDate: string;
  status: 'active' | 'defaulted' | 'repaid';
  interestPaid: number;
  totalOwed: number;
  daysRemaining: number;
  asset: 'USDC';
}

interface CollateralNft {
  mintAddress: string;
  name: string;
  imageUrl: string;
  collectionName: string;
  value: number;
}

interface UserLendingData {
  totalBorrowingPower: number;
  totalDebt: number;
  availableToBorrow: number;
  depositedNfts: CollateralNft[];
  activeLoans: LoanInfo[];
  healthRatio: number; // Collateral value / debt ratio
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

    // Get global market data
    const globalMarketAccount = await program.account.globalMarket.fetch(globalMarketPda);
    
    // Get collection registry to fetch individual collection values
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry_v2')],
      LENDING_PROGRAM_ID
    );
    
    const collectionRegistry = await program.account.collectionRegistry.fetch(collectionRegistryPda);
    
    // Build collection values map
    const collectionValues: { [key: string]: number } = {};
    collectionRegistry.collections.forEach((collection: any) => {
      if (collection.isApproved) {
        const valueUsd = collection.valueUsd.toNumber() / 1_000_000; // Convert from micro-dollars
        collectionValues[collection.mint.toString()] = valueUsd;
      }
    });

    console.log('📊 Loaded collection values for user data:', Object.keys(collectionValues).length);

    // Derive user's BorrowerAccount PDA
    const userWallet = new PublicKey(walletAddress);
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );

    let userLendingData: UserLendingData;

    try {
      // Try to fetch user's borrower account
      const borrowerAccount = await program.account.borrowerAccount.fetch(borrowerAccountPda);
      
      // Fetch all user's NFT metadata once
      const depositedNfts: CollateralNft[] = [];
      let allUserNfts: any[] = [];
      
      try {
        // Fetch all NFT metadata once instead of per NFT
        const metadataResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/my-nfts?walletAddress=${walletAddress}`);
        if (metadataResponse.ok) {
          const nftData = await metadataResponse.json();
          allUserNfts = nftData.ownedCollectionNfts || [];
          console.log(`📊 Found ${allUserNfts.length} total NFTs for user`);
        }
      } catch (nftError) {
        console.warn('Failed to fetch user NFT metadata:', nftError);
      }
      
      // Process each deposited NFT
      for (const nftMint of borrowerAccount.depositedNfts) {
        try {
          const nftInfo = allUserNfts.find((nft: any) => nft.address === nftMint.toString());
          
          if (nftInfo) {
            // Get collection-specific value using the NFT's collection
            const nftCollectionMint = nftInfo.collectionMintAddress || nftInfo.collection?.address;
            const collectionValue = collectionValues[nftCollectionMint] || 1; // Default $1
            
            depositedNfts.push({
              mintAddress: nftMint.toString(),
              name: nftInfo.name || 'Unknown NFT',
              imageUrl: nftInfo.json?.image || '/placeholder-image.svg',
              collectionName: nftInfo.collectionName || 'Unknown Collection',
              value: collectionValue
            });
            
            console.log(`📊 NFT value set: ${nftInfo.name} = $${collectionValue} (collection: ${nftCollectionMint})`);
          } else {
            // NFT not found in user's current NFTs (it's in escrow)
            // Get collection from on-chain metadata or use default
            const defaultValue = 1; // $1 default
            
            depositedNfts.push({
              mintAddress: nftMint.toString(),
              name: 'Deposited NFT',
              imageUrl: '/placeholder-image.svg',
              collectionName: 'Planet Whiskey Collection',
              value: defaultValue
            });
            
            console.log(`📊 Deposited NFT (in escrow): ${nftMint.toString()} = $${defaultValue}`);
          }
        } catch (nftError) {
          console.warn(`Failed to process NFT ${nftMint.toString()}:`, nftError);
          // Add basic info even if processing fails
          depositedNfts.push({
            mintAddress: nftMint.toString(),
            name: 'Unknown NFT',
            imageUrl: '/placeholder-image.svg',
            collectionName: 'Unknown Collection',
            value: 1 // Default $1
          });
        }
      }

      // Fetch active loans
      const activeLoans: LoanInfo[] = [];
      for (const loanPubkey of borrowerAccount.activeLoans) {
        try {
          const loanAccount = await program.account.loan.fetch(loanPubkey);
          
          // Calculate days remaining
          const currentTime = Math.floor(Date.now() / 1000);
          const daysRemaining = Math.max(0, Math.floor((Number(loanAccount.gracePeriodEndsTs) - currentTime) / (24 * 60 * 60)));
          
          // Determine duration string
          const durationSecs = loanAccount.durationSecs;
          let durationString = '';
          if (durationSecs <= 31 * 24 * 60 * 60) durationString = '1 Month';
          else if (durationSecs <= 93 * 24 * 60 * 60) durationString = '3 Months';
          else durationString = '6 Months';
          
          // Determine asset
          const assetMint = loanAccount.borrowedAssetMint.toString();
          const asset = 'USDC'; // Only USDC supported
          
          // Convert from micro-dollars (6 decimals) to regular dollars
          const principalUsd = Number(loanAccount.principalAmountUsd) / 1_000_000;
          const interestPaidUsd = Number(loanAccount.interestPaidUsd) / 1_000_000;
          
          // Calculate total owed using the smart contract's formula
          const interestAmountMicro = (BigInt(loanAccount.principalAmountUsd) * BigInt(loanAccount.interestRateAtOriginationBps)) / BigInt(10000);
          const totalOwedMicro = BigInt(loanAccount.principalAmountUsd) + interestAmountMicro - BigInt(loanAccount.interestPaidUsd);
          const totalOwedUsd = Number(totalOwedMicro) / 1_000_000;

          activeLoans.push({
            loanId: loanPubkey.toString(),
            principalAmount: principalUsd,
            interestRate: loanAccount.interestRateAtOriginationBps / 100, // Convert BPS to percentage
            duration: durationString,
            startDate: new Date(Number(loanAccount.startTs) * 1000).toISOString().split('T')[0],
            dueDate: new Date(Number(loanAccount.gracePeriodEndsTs) * 1000).toISOString().split('T')[0],
            status: loanAccount.status.active ? 'active' : loanAccount.status.defaulted ? 'defaulted' : 'repaid',
            interestPaid: interestPaidUsd,
            totalOwed: Math.max(0, totalOwedUsd), // Ensure non-negative
            daysRemaining,
            asset: asset as 'USDC'
          });
          
          console.log(`💰 Loan ${loanPubkey.toString().slice(0,8)}...:`);
          console.log(`  Principal: $${principalUsd}`);
          console.log(`  Interest Rate: ${loanAccount.interestRateAtOriginationBps / 100}%`);
          console.log(`  Interest Paid: $${interestPaidUsd}`);
          console.log(`  Total Owed: $${totalOwedUsd}`);
          console.log(`  Days Remaining: ${daysRemaining}`);
        } catch (loanError) {
          console.warn(`Failed to fetch loan data for ${loanPubkey.toString()}:`, loanError);
        }
      }

      // Calculate stats - Fix: Convert from micro-dollars to dollars
      // The on-chain data was stored incorrectly (treating micro-dollars as dollars)
      const totalBorrowingPowerRaw = Number(borrowerAccount.totalBorrowingPowerUsd);
      const totalBorrowingPower = totalBorrowingPowerRaw / 1_000_000; // Convert from micro-dollars
      
      const totalDebtRaw = Number(borrowerAccount.totalDebtUsd);
      const totalDebt = totalDebtRaw / 1_000_000; // Convert from micro-dollars
      
      const availableToBorrow = Math.max(0, totalBorrowingPower - totalDebt);
      const healthRatio = totalDebt > 0 ? totalBorrowingPower / totalDebt : 999; // High ratio if no debt

      userLendingData = {
        totalBorrowingPower,
        totalDebt,
        availableToBorrow,
        depositedNfts,
        activeLoans,
        healthRatio
      };

      console.log(`✅ Fetched real lending data for wallet: ${walletAddress}`, {
        depositedNfts: depositedNfts.length,
        activeLoans: activeLoans.length,
        borrowingPower: totalBorrowingPower,
        debt: totalDebt
      });
      
    } catch (borrowerAccountError) {
      // User doesn't have a borrower account yet
      console.log(`No borrower account found for wallet: ${walletAddress}, returning empty data`);
      
      userLendingData = {
        totalBorrowingPower: 0,
        totalDebt: 0,
        availableToBorrow: 0,
        depositedNfts: [],
        activeLoans: [],
        healthRatio: 0
      };
    }
    
    res.status(200).json(userLendingData);
  } catch (error) {
    console.error('Error fetching user lending data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch lending data',
      error: error.toString()
    });
  }
}
