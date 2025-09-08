import type { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { getSolanaConnection, getAnchorProvider } from '@/lib/solanaUtils';
import dbConnect from '@/lib/mongodb';
import NftCollection from '@/models/NftCollection';

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

// Treasury keypair loading removed - using client-side signing only

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('🔄 Updating NFT values from collection USD prices...');
    
    // Connect to database and get collections
    await dbConnect();
    const collections = await NftCollection.find({ isActive: true }).lean();
    
    if (collections.length === 0) {
      return res.status(400).json({ message: 'No active collections found' });
    }

    // Calculate average USD value from all collections
    const collectionsWithUsdPrice = collections.filter(c => c.mintPriceUsd && c.mintPriceUsd > 0);
    
    if (collectionsWithUsdPrice.length === 0) {
      return res.status(400).json({ message: 'No collections with USD prices found. Please update collections to use USD pricing.' });
    }

    const averageUsdValue = collectionsWithUsdPrice.reduce((sum, c) => sum + c.mintPriceUsd!, 0) / collectionsWithUsdPrice.length;
    const roundedUsdValue = Math.round(averageUsdValue);

    console.log(`📊 Found ${collectionsWithUsdPrice.length} collections with USD prices`);
    console.log(`💰 Average USD value: $${averageUsdValue.toFixed(2)} (rounded to $${roundedUsdValue})`);

    // Load lending program using environment variables
    const lendingProgramData = loadLendingProgram();
    if (!lendingProgramData) {
      return res.status(500).json({ 
        success: false,
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
      [Buffer.from('collection_registry_v2')],
      LENDING_PROGRAM_ID
    );

    console.log('🔧 Using environment-based addresses:');
    console.log('  Lending Program ID:', LENDING_PROGRAM_ID.toString());
    console.log('  Global Market PDA:', globalMarketPda.toString());
    console.log('  Collection Registry PDA:', collectionRegistryPda.toString());

    // Instead of updating a global value, we now need to update individual collection values
    console.log(`🔄 Updating individual collection values in lending protocol...`);
    
    const adminWalletPublicKey = new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET!);
    
    // Get collection registry to see what collections exist
    let registryAccount;
    try {
      registryAccount = await program.account.collectionRegistry.fetch(collectionRegistryPda);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Collection registry not found. Please sync collections first.',
      });
    }

    // Update each collection's value based on the database USD prices
    const updateInstructions = [];
    const updatedCollections = [];
    
    for (const collection of collectionsWithUsdPrice) {
      const collectionMint = new PublicKey(collection.collectionMintAddress);
      const usdValueMicro = Math.round(collection.mintPriceUsd! * 1_000_000); // Convert to microdollars
      
      // Check if this collection exists in the registry
      const existsInRegistry = registryAccount.collections.some((entry: any) => 
        entry.mint.toString() === collectionMint.toString()
      );
      
      if (existsInRegistry) {
        const instruction = await program.methods
          .updateCollectionValue(
            collectionMint,
            new anchor.BN(usdValueMicro)
          )
          .accounts({
            collectionRegistry: collectionRegistryPda,
            admin: adminWalletPublicKey,
          })
          .instruction();
          
        updateInstructions.push(instruction);
        updatedCollections.push({
          name: collection.name,
          mintAddress: collectionMint.toString(),
          oldValue: 'unknown',
          newValue: collection.mintPriceUsd,
        });
      }
    }
    
    if (updateInstructions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No collections found in registry to update. Please sync collections first.',
      });
    }

    // Create transaction with all update instructions
    const transaction = new anchor.web3.Transaction();
    updateInstructions.forEach(instruction => transaction.add(instruction));
    
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminWalletPublicKey;

    console.log(`✅ Transaction created for updating ${updatedCollections.length} collection values`);

    res.status(200).json({
      success: true,
      message: `Transaction created to update ${updatedCollections.length} collection values`,
      data: {
        collectionsAnalyzed: collectionsWithUsdPrice.length,
        collectionsUpdated: updatedCollections.length,
        updatedCollections: updatedCollections,
        transaction: transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
        requiresWalletSigning: true,
        registryAddress: collectionRegistryPda.toString(),
        globalMarketAddress: globalMarketPda.toString()
      }
    });

  } catch (error) {
    console.error('❌ Error updating NFT values:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update NFT values',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withAdminAuth(handler);
