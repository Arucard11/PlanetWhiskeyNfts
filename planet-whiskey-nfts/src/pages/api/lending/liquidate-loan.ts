import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Lendingprogram } from '../../../lib/idl/lendingprogram';
import fs from 'fs';
import path from 'path';

// Load environment variables
const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const LENDING_PROGRAM_ID = process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  console.log('📥 Received liquidation request body:', req.body);
  
  const { walletAddress, loanId, nftMintAddress, collectionMintAddress } = req.body;

  if (!walletAddress || !loanId || !nftMintAddress) {
    console.error('❌ Missing required fields:', { walletAddress, loanId, nftMintAddress });
    return res.status(400).json({ 
      message: 'All fields are required: walletAddress, loanId, nftMintAddress' 
    });
  }

  console.log('✅ Liquidation request validation passed:', { walletAddress, loanId, nftMintAddress });

  try {
    // Create connection and load program
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    
    // Load dedicated liquidation keypair (only liquidation authority can trigger)
    const liquidationKeypairPath = path.join(process.cwd(), '../../solana_program/liquidation-keypair.json');
    const liquidationSecretKey = JSON.parse(fs.readFileSync(liquidationKeypairPath, 'utf8'));
    const liquidationKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(liquidationSecretKey));
    
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(liquidationKeypair), {});
    
    // Load IDL
    const idlPath = path.join(process.cwd(), 'src/lib/idl/lendingprogram.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const program = new anchor.Program<Lendingprogram>(idl, provider);

    // Convert addresses to PublicKeys
    const userWallet = new PublicKey(walletAddress);
    const loanPda = new PublicKey(loanId);
    const nftMint = new PublicKey(nftMintAddress);

    // Derive necessary PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      new PublicKey(LENDING_PROGRAM_ID)
    );

    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('borrower_account'), userWallet.toBuffer()],
      new PublicKey(LENDING_PROGRAM_ID)
    );

    const [nftEscrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collateral_escrow'), userWallet.toBuffer(), nftMint.toBuffer()],
      new PublicKey(LENDING_PROGRAM_ID)
    );

    console.log('🔥 Creating NFT liquidation transaction...');
    console.log('  Loan PDA:', loanPda.toString());
    console.log('  NFT Mint:', nftMint.toString());
    console.log('  User Wallet:', userWallet.toString());

    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      new PublicKey(LENDING_PROGRAM_ID)
    );

    // Use collectionMintAddress if provided, otherwise use nftMint as fallback
    const collectionMintKey = collectionMintAddress ? new PublicKey(collectionMintAddress) : nftMint;

    const instruction = await program.methods
      .liquidateExpiredLoan(loanPda, collectionMintKey)
      .accounts({
        borrowerAccount: borrowerAccountPda,
        globalMarket: globalMarketPda,
        collectionRegistry: collectionRegistryPda,
        loan: loanPda,
        nftMint: nftMint,
        nftEscrow: nftEscrowPda,
        liquidator: liquidationKeypair.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      } as any)
      .instruction();

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = liquidationKeypair.publicKey;
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    // Sign the transaction with liquidation keypair
    transaction.sign(liquidationKeypair);

    // Serialize transaction
    const serializedTransaction = transaction.serialize();
    const transactionBase64 = Buffer.from(serializedTransaction).toString('base64');

    console.log('✅ NFT liquidation transaction prepared successfully');

    return res.status(200).json({
      success: true,
      transaction: transactionBase64,
      message: 'NFT liquidation transaction prepared - NFT will be permanently burned',
      liquidationDetails: {
        nftMintAddress,
        loanId,
        liquidationType: 'BURN',
        liquidatedBy: liquidationKeypair.publicKey.toString()
      }
    });

  } catch (error) {
    console.error('❌ Error preparing NFT liquidation transaction:', error);
    
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return res.status(500).json({ 
      message: 'Failed to prepare NFT liquidation transaction',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
}
