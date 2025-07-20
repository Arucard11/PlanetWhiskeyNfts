import { NextApiRequest, NextApiResponse } from 'next';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { SystemProgram, PublicKey, Transaction, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js';

// The official address for the SPL Memo program
const SPL_MEMO_PROGRAM_ID = new PublicKey('Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { sellerAddress, nftMintAddress, price, timestamp } = req.body;
    
    // Validate inputs
    if (!sellerAddress || !nftMintAddress || !price || !timestamp) {
      return res.status(400).json({ message: 'Missing required fields: sellerAddress, nftMintAddress, price, and timestamp are required.' });
    }
    
    const program = getMarketplaceProgram(); // Uses a default provider
    const seller = new PublicKey(sellerAddress);
    const nftToListMint = new PublicKey(nftMintAddress);
    const priceBN = new BN(price);

    // Derive PDAs
    const [listingPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('listing'), seller.toBuffer(), nftToListMint.toBuffer()],
      program.programId
    );

    const [escrowTokenAccountPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('escrow'), listingPDA.toBuffer()],
      program.programId
    );
    
    const sellerNftTokenAccount = await getAssociatedTokenAddress(nftToListMint, seller);

    const transaction = new Transaction();
    
    // Add a unique memo instruction to prevent "already processed" errors
    transaction.add(
      new TransactionInstruction({
        keys: [], // Memo does not require any accounts
        programId: SPL_MEMO_PROGRAM_ID,
        data: Buffer.from(`Listing NFT via Whiskey Planet: ${timestamp}`, 'utf-8'),
      })
    );
    
    const instruction = await program.methods
      .listNft(priceBN)
      .accounts({
        seller: seller,
        listing: listingPDA,
        sellerNftTokenAccount: sellerNftTokenAccount,
        escrowTokenAccount: escrowTokenAccountPDA,
        nftToListMint: nftToListMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        // Note: associated_token_program is implicitly used by the token program, not needed here
      })
      .instruction();

    transaction.add(instruction);

    // The client will set the real feePayer and recentBlockhash
    transaction.feePayer = seller;
    transaction.recentBlockhash = '11111111111111111111111111111111'; // Dummy blockhash

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });
    
    const base64Transaction = serializedTransaction.toString('base64');

    res.status(200).json({ transaction: base64Transaction });

  } catch (error: any) {
    console.error('[LIST_TX_API] Error creating transaction:', error);
    res.status(500).json({ message: 'Failed to create listing transaction.', error: error.message });
  }
}

export default handler; 