import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import lendingIdl from '../../../lib/idl/lendingprogram.json';

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { walletAddress, nftMintAddress } = req.body;

  if (!walletAddress || !nftMintAddress) {
    return res.status(400).json({ 
      message: 'All fields are required: walletAddress, nftMintAddress' 
    });
  }

  try {
    // Setup Solana connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    anchor.setProvider(provider);
    
    // Create program instance using IDL
    const program = new anchor.Program(lendingIdl as anchor.Idl, provider) as anchor.Program<Lendingprogram>;
    
    // Setup accounts
    const userWallet = new PublicKey(walletAddress);
    const nftMint = new PublicKey(nftMintAddress);
    
    // Derive PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      LENDING_PROGRAM_ID
    );
    
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("collection_registry_v2")],
      LENDING_PROGRAM_ID
    );
    
    // Derive borrower account PDA
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );

    const [nftEscrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_escrow"), userWallet.toBuffer(), nftMint.toBuffer()],
      LENDING_PROGRAM_ID
    );
    
    // Get user's NFT token account
    const userNftAccount = await getAssociatedTokenAddress(nftMint, userWallet);

    // Build withdraw NFT transaction
    const withdrawInstruction = await (program.methods as any)
      .withdrawNft()
      .accounts({
        globalMarket: globalMarketPda,
        collectionRegistry: collectionRegistryPda,
        borrowerAccount: borrowerAccountPda,
        nftMint: nftMint,
        userNftAccount: userNftAccount,
        nftEscrow: nftEscrowPda,
        user: userWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // Create transaction
    const transaction = new Transaction();
    transaction.add(withdrawInstruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Serialize transaction for frontend
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    console.log(`✅ Created NFT withdrawal transaction for wallet: ${walletAddress}`, {
      nftMintAddress
    });

    res.status(200).json({
      message: 'NFT withdrawal transaction created successfully',
      transaction: serializedTransaction.toString('base64'),
      lastValidBlockHeight,
      withdrawalDetails: {
        nftMintAddress,
        borrowerAccount: borrowerAccountPda.toString(),
        nftEscrow: nftEscrowPda.toString()
      }
    });
  } catch (error) {
    console.error('Error creating withdrawal transaction:', error);
    res.status(500).json({ 
      message: 'Failed to create withdrawal transaction',
      error: error.toString()
    });
  }
}
