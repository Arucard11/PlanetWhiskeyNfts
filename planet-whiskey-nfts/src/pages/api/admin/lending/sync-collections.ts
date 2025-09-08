import { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '../../../../lib/adminAuth';
import dbConnect from '../../../../lib/mongodb';
import NftCollection from '../../../../models/NftCollection';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getSolanaConnection, getAnchorProvider } from '../../../../lib/solanaUtils';

function loadLendingProgram() {
  try {
    const connection = getSolanaConnection();
    
    // Use a temporary keypair for read-only operations
    const tempKeypair = Keypair.generate();
    const provider = getAnchorProvider(tempKeypair);
    
    // Load the lending program IDL
    const lendingIdl = require('@/lib/idl/lendingprogram.json');
    const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
    
    const program = new anchor.Program(lendingIdl as any, provider);
    
    return { program, connection, LENDING_PROGRAM_ID };
  } catch (error) {
    console.error('❌ Error loading lending program:', error);
    return null;
  }
}

// Treasury keypair loading removed - using client-side signing only

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();
    
    // Load lending program using environment variables
    const lendingProgramData = loadLendingProgram();
    if (!lendingProgramData) {
      return res.status(500).json({ 
        message: 'Failed to load lending program' 
      });
    }

    const { program, connection, LENDING_PROGRAM_ID } = lendingProgramData;

    // Get all active collections from database
    const collections = await NftCollection.find({ isActive: true }).lean();
    
    if (collections.length === 0) {
      return res.status(200).json({ 
        message: 'No active collections found to sync',
        syncedCollections: []
      });
    }

    // Derive PDAs using environment variables
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry_v2')],
      LENDING_PROGRAM_ID
    );

    console.log('🔧 Using environment-based addresses:');
    console.log('  Lending Program ID:', LENDING_PROGRAM_ID.toString());
    console.log('  Global Market PDA:', globalMarketPda.toString());
    console.log('  Collection Registry PDA:', collectionRegistryPda.toString());

    // Get current approved collections from collection registry
    let currentApprovedCollections: string[] = [];
    
    console.log(`📊 Found ${collections.length} active collections in database`);
    
    try {
      const registryAccount = await (program.account as any).collectionRegistry.fetch(collectionRegistryPda);
      currentApprovedCollections = registryAccount.collections.map((entry: any) => entry.mint.toString());
      console.log(`📋 Found ${currentApprovedCollections.length} collections already in registry`);
    } catch (error) {
      console.log('Collection registry not found, will create new entries');
    }

    // Find collections that need to be added
    const collectionsToAdd: { mint: PublicKey; valueUsd: number }[] = [];
    const syncedCollections: any[] = [];

    for (const collection of collections) {
      const collectionMint = collection.collectionMintAddress;
      const usdValue = collection.mintPriceUsd || 25; // Default to $25 if no USD price set
      
      if (!currentApprovedCollections.includes(collectionMint)) {
        collectionsToAdd.push({
          mint: new PublicKey(collectionMint),
          valueUsd: Math.round(usdValue * 1_000_000) // Convert to microdollars
        });
        syncedCollections.push({
          name: collection.name,
          mintAddress: collectionMint,
          usdValue: usdValue,
          action: 'needs_to_be_added'
        });
      } else {
        syncedCollections.push({
          name: collection.name,
          mintAddress: collectionMint,
          usdValue: usdValue,
          action: 'already_approved'
        });
      }
    }

    console.log(`📊 Collections analysis:`);
    console.log(`  Total collections: ${collections.length}`);
    console.log(`  Already approved: ${collections.length - collectionsToAdd.length}`);
    console.log(`  Need to be added: ${collectionsToAdd.length}`);

    // Return the collections that need to be added for client-side processing
    if (collectionsToAdd.length > 0) {
      console.log(`[SYNC_COLLECTIONS] Found ${collectionsToAdd.length} collections that need to be added to registry`);
      
      return res.status(200).json({
        message: `${collectionsToAdd.length} collections need to be added to the registry`,
        totalCollections: collections.length,
        newCollectionsAdded: 0,
        syncedCollections: syncedCollections,
        collectionsToAdd: collectionsToAdd.map(c => ({
          mintAddress: c.mint.toString(),
          valueUsd: c.valueUsd / 1_000_000, // Convert back to dollars for display
        })),
        requiresClientSideSigning: true,
        registryAddress: collectionRegistryPda.toString(),
        globalMarketAddress: globalMarketPda.toString()
      });
    }

    res.status(200).json({
      message: `Successfully synced ${collections.length} collections with lending protocol`,
      totalCollections: collections.length,
      newCollectionsAdded: collectionsToAdd.length,
      syncedCollections,
      currentApprovedCount: currentApprovedCollections.length + collectionsToAdd.length
    });

  } catch (error) {
    console.error('Error syncing collections:', error);
    res.status(500).json({ 
      message: 'Failed to sync collections',
      error: error.toString()
    });
  }
}

export default withAdminAuth(handler);
