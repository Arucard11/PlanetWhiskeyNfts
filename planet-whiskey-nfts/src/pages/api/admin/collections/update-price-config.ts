import type { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey, Transaction, ComputeBudgetProgram, Keypair } from '@solana/web3.js';
import { getAnchorProvider, getSolanaConnection, getSolanaProgram } from '@/lib/solanaUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { collectionName, priceIncreaseBps, nftsPerPriceStep, adminWalletAddress } = req.body;

    if (!collectionName || priceIncreaseBps == null || nftsPerPriceStep == null || !adminWalletAddress) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const expectedAdmin = process.env.NEXT_PUBLIC_ADMIN_WALLET || 'F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X';
    if (adminWalletAddress !== expectedAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const connection = getSolanaConnection();
    const adminPubkey = new PublicKey(adminWalletAddress);
    const tempKeypair = Keypair.generate();
    const provider = getAnchorProvider(tempKeypair);
    const program = getSolanaProgram(provider);

    const [collectionConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), Buffer.from(collectionName)],
      program.programId
    );

    const instruction = await program.methods
      .updatePriceConfig(priceIncreaseBps, nftsPerPriceStep)
      .accounts({
        collectionConfig: collectionConfigPDA,
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
    });
  } catch (error: any) {
    console.error('[UPDATE_PRICE_CONFIG] Error:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
