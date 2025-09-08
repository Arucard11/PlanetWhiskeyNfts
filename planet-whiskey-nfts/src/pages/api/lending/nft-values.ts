import { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection, getAnchorProvider } from '@/lib/solanaUtils';
import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

interface NFTCollectionValue {
  collectionMintAddress: string;
  valueUsd: number;
  isApproved: boolean;
  addedAt: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const connection = getSolanaConnection();
    
    // Use a temporary keypair for read-only operations
    const tempKeypair = Keypair.generate();
    const provider = getAnchorProvider(tempKeypair);
    
    // Load the lending program IDL
    const lendingIdl = require('@/lib/idl/lendingprogram.json');
    const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
    
    const program = new anchor.Program(lendingIdl as any, provider);
    
    // Derive collection registry PDA
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry_v2')],
      LENDING_PROGRAM_ID
    );

    console.log('🔍 Fetching collection registry:', collectionRegistryPda.toString());

    // Fetch collection registry data
    const collectionRegistry = await (program.account as any).collectionRegistry.fetch(collectionRegistryPda);
    
    console.log('✅ Collection registry fetched:', {
      authority: collectionRegistry.authority.toString(),
      collectionsCount: collectionRegistry.collections.length,
    });

    // Transform the collections data
    const nftValues: NFTCollectionValue[] = collectionRegistry.collections.map((collection: any) => ({
      collectionMintAddress: collection.mint.toString(),
      valueUsd: collection.valueUsd.toNumber() / 1_000_000, // Convert from micro-dollars
      isApproved: collection.isApproved,
      addedAt: collection.addedAt.toNumber(),
    }));

    // Also fetch WhiskeyProgram collections for cross-reference
    const whiskeyIdl = require('@/lib/idl/whiskeyprogram.json');
    const WHISKEY_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!);
    const whiskeyProgram = new anchor.Program(whiskeyIdl as any, provider);

    // Get all collection configs from WhiskeyProgram (these contain the USD prices set by admin)
    const collectionConfigs = await (whiskeyProgram.account as any).collectionConfig.all();
    
    console.log('✅ Found collection configs:', collectionConfigs.length);

    // Create a map of collection mint -> USD price from WhiskeyProgram
    const collectionPrices: { [key: string]: number } = {};
    
    collectionConfigs.forEach((config: any) => {
      const collectionMint = config.account.collectionMint.toString();
      const usdPrice = config.account.mintPriceUsd.toNumber() / 1_000_000; // Convert from micro-dollars
      collectionPrices[collectionMint] = usdPrice;
      
      console.log('📊 Collection price:', {
        mint: collectionMint,
        usdPrice: usdPrice,
        name: config.account.name,
      });
    });

    res.status(200).json({
      message: 'NFT collection values fetched successfully',
      nftValues,
      collectionPrices,
      registryAddress: collectionRegistryPda.toString(),
      totalCollections: nftValues.length,
    });

  } catch (error) {
    console.error('Error fetching NFT values:', error);
    res.status(500).json({ 
      message: 'Failed to fetch NFT collection values',
      error: error.toString()
    });
  }
}
