import type { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getSolanaConnection, getAnchorProvider, getSolanaProgram } from '@/lib/solanaUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { collectionName, collectionMint, adminWalletAddress } = req.body;

    if (!collectionName || !collectionMint || !adminWalletAddress) {
      return res.status(400).json({ message: 'Missing required fields: collectionName, collectionMint, adminWalletAddress' });
    }

    const expectedAdmin = process.env.NEXT_PUBLIC_ADMIN_WALLET || 'F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X';
    if (adminWalletAddress !== expectedAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const connection = getSolanaConnection();
    const adminPubkey = new PublicKey(adminWalletAddress);
    const tempKeypair = Keypair.generate();
    const provider = getAnchorProvider(tempKeypair);

    // Load whiskey program to read current mint_price_usd
    const whiskeyProgram = getSolanaProgram(provider);
    const whiskeyProgramId = whiskeyProgram.programId;

    const [collectionConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), Buffer.from(collectionName)],
      whiskeyProgramId
    );

    // Read collection config to get the current mint price
    const collectionConfig = await whiskeyProgram.account.collectionConfig.fetch(collectionConfigPDA) as any;
    const currentMintPriceUsd = collectionConfig.mintPriceUsd.toNumber();

    console.log(`[SYNC_PRICE] Collection "${collectionName}" current mint price: ${currentMintPriceUsd} microdollars`);

    // Load lending program
    const lendingIdl = require('@/lib/idl/lendingprogram.json');
    const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
    const lendingProgram = new anchor.Program(lendingIdl, provider);

    // Derive lending PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      LENDING_PROGRAM_ID
    );

    const collectionMintPubkey = new PublicKey(collectionMint);

    // Build the update_collection_value instruction on the lending program
    const instruction = await lendingProgram.methods
      .updateCollectionValue(collectionMintPubkey, new anchor.BN(currentMintPriceUsd))
      .accounts({
        globalMarket: globalMarketPda,
        collectionRegistry: collectionRegistryPda,
        admin: adminPubkey,
      } as any)
      .instruction();

    const transaction = new Transaction();
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    transaction.add(instruction);
    transaction.feePayer = adminPubkey;

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    res.status(200).json({
      success: true,
      transaction: Buffer.from(serialized).toString('base64'),
      currentMintPriceUsd,
    });
  } catch (error: any) {
    console.error('[SYNC_PRICE_FROM_MINT] Error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
