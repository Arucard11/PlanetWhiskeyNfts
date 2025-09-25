import { NextApiRequest, NextApiResponse } from 'next';
import { getSolanaConnection, getAnchorProvider } from '@/lib/solanaUtils';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

function loadLendingProgram() {
  try {
    const connection = getSolanaConnection();
    const tempKeypair = Keypair.generate();
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(tempKeypair),
      { preflightCommitment: 'confirmed' }
    );
    
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
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const lendingProgramData = loadLendingProgram();
    if (!lendingProgramData) {
      return res.status(500).json({ message: 'Failed to load lending program' });
    }

    const { program, LENDING_PROGRAM_ID } = lendingProgramData;

    // Derive collection registry PDA
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      LENDING_PROGRAM_ID
    );

    try {
      const registryAccount = await (program.account as any).collectionRegistry.fetch(collectionRegistryPda);
      
      const collections = registryAccount.collections.map((entry: any) => ({
        mint: entry.mint.toString(),
        valueUsd: Number(entry.valueUsd) / 1_000_000, // Convert from microdollars
        isApproved: entry.isApproved,
        addedAt: new Date(Number(entry.addedAt) * 1000).toISOString()
      }));

      res.status(200).json({
        message: 'Collection registry fetched successfully',
        registryAddress: collectionRegistryPda.toString(),
        totalCollections: collections.length,
        collections: collections
      });
    } catch (error) {
      console.error('❌ Error fetching collection registry:', error);
      res.status(400).json({ 
        message: 'Collection registry not found or not initialized',
        error: error.toString()
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      message: 'Failed to check collection registry',
      error: error.toString()
    });
  }
}
