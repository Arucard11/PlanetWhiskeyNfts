import { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solanaUtils';
import * as anchor from '@coral-xyz/anchor';

function loadLendingProgram() {
  try {
    const connection = getSolanaConnection();
    
    // Use a temporary keypair for read-only operations
    const tempKeypair = anchor.web3.Keypair.generate();
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(tempKeypair),
      { preflightCommitment: 'confirmed' }
    );
    
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { collectionMintAddresses } = req.body;

  if (!collectionMintAddresses || !Array.isArray(collectionMintAddresses)) {
    return res.status(400).json({ 
      message: 'Collection mint addresses array is required' 
    });
  }

  try {
    // Load lending program
    const lendingProgramData = loadLendingProgram();
    if (!lendingProgramData) {
      return res.status(500).json({ 
        message: 'Failed to load lending program' 
      });
    }

    const { program, LENDING_PROGRAM_ID } = lendingProgramData;

    // Get the collection registry PDA
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      LENDING_PROGRAM_ID
    );

    try {
      // Fetch the collection registry
      const registryAccount = await (program.account as any).collectionRegistry.fetch(collectionRegistryPda);
      console.log(`📋 Found ${registryAccount.collections.length} collections in registry`);
      
      // Create a map of approved collections
      const approvedCollections = new Map();
      registryAccount.collections.forEach((collection: any) => {
        approvedCollections.set(collection.mint.toString(), collection.isApproved);
      });

      // Check each collection
      const results = collectionMintAddresses.map((collectionMint: string) => {
        const isApproved = approvedCollections.get(collectionMint) || false;
        return {
          collectionMint,
          isApproved
        };
      });

      console.log('✅ Collection approval check completed:', results);

      res.status(200).json({
        message: 'Collection approval status retrieved successfully',
        results
      });

    } catch (regError) {
      console.error('❌ Error fetching collection registry:', regError);
      return res.status(400).json({ 
        message: 'Collection registry not found. Please contact admin to set up lending collections.',
        results: collectionMintAddresses.map((collectionMint: string) => ({
          collectionMint,
          isApproved: false
        }))
      });
    }

  } catch (error) {
    console.error('Error checking collection approval:', error);
    res.status(500).json({ 
      message: 'Failed to check collection approval status',
      error: error.toString()
    });
  }
}
