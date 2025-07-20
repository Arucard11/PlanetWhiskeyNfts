import { NextApiRequest, NextApiResponse } from 'next';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { SystemProgram, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';

// The official address for the SPL Memo program
const SPL_MEMO_PROGRAM_ID = new PublicKey('Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { sellerAddress, nftMintAddress, timestamp } = req.body;
    
    // Validate required fields
    if (!sellerAddress || !nftMintAddress || 
        typeof sellerAddress !== 'string' || typeof nftMintAddress !== 'string' ||
        sellerAddress.trim().length === 0 || nftMintAddress.trim().length === 0) {
      return res.status(400).json({ message: 'Missing or invalid required fields: sellerAddress and nftMintAddress must be valid strings.' });
    }
    
    let seller: PublicKey;
    let nftToListMint: PublicKey;
    
    try {
      seller = new PublicKey(sellerAddress.trim());
      nftToListMint = new PublicKey(nftMintAddress.trim());
    } catch (pubkeyError) {
      return res.status(400).json({ message: 'Invalid public key format for sellerAddress or nftMintAddress.' });
    }
    
    const program = getMarketplaceProgram();

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
    const cancelTimestamp = timestamp || Date.now();
    transaction.add(
      new TransactionInstruction({
        keys: [], // Memo does not require any accounts
        programId: SPL_MEMO_PROGRAM_ID,
        data: Buffer.from(`Cancelling listing via Whiskey Planet: ${cancelTimestamp}`, 'utf-8'),
      })
    );
    
    const instruction = await program.methods
      .cancelListing()
      .accounts({
        seller: seller,
        listing: listingPDA,
        sellerNftTokenAccount: sellerNftTokenAccount,
        escrowTokenAccount: escrowTokenAccountPDA,
        nftToListMint: nftToListMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
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
    console.error('[CANCEL_TX_API] Error creating transaction:', error);
    res.status(500).json({ message: 'Failed to create cancel transaction.', error: error.message });
  }
}

export default handler; 