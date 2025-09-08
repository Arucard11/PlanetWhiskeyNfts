import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';

// Load the real lending program IDL
function loadLendingProgramIdl() {
  try {
    const idlPath = path.join(process.cwd(), '../solana_program/target/idl/lendingprogram.json');
    console.log('🔍 Looking for IDL file at:', idlPath);
    
    if (fs.existsSync(idlPath)) {
      console.log('✅ IDL file found');
      const content = fs.readFileSync(idlPath, 'utf8');
      const idl = JSON.parse(content);
      console.log('✅ IDL file parsed successfully');
      return idl;
    } else {
      console.log('❌ IDL file not found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading IDL:', error);
    return null;
  }
}

// Lending program IDL
const LENDING_PROGRAM_IDL = loadLendingProgramIdl();

function loadDeploymentInfo() {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), '../solana_program/project-constellation-deployment.json'),
      path.join(process.cwd(), '../../solana_program/project-constellation-deployment.json'),
      path.join(__dirname, '../../../../solana_program/project-constellation-deployment.json'),
      '/home/arucard/WhiskeyPlanetNfts/solana_program/project-constellation-deployment.json'
    ];
    
    console.log('🔍 Looking for deployment file...');
    console.log('🔍 Current working directory:', process.cwd());
    console.log('🔍 __dirname:', __dirname);
    
    for (const deploymentPath of possiblePaths) {
      console.log('🔍 Trying path:', deploymentPath);
      if (fs.existsSync(deploymentPath)) {
        console.log('✅ Deployment file found at:', deploymentPath);
        const content = fs.readFileSync(deploymentPath, 'utf8');
        const parsed = JSON.parse(content);
        console.log('✅ Deployment file parsed successfully');
        return parsed;
      }
    }
    
    console.log('❌ Deployment file not found in any of the attempted paths');
    return null;
  } catch (error) {
    console.error('❌ Error loading deployment info:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { nftMintAddress, walletAddress } = req.body;

  if (!nftMintAddress || !walletAddress) {
    return res.status(400).json({ 
      message: 'NFT mint address and wallet address are required' 
    });
  }

  try {
    // Load deployment info
    const deploymentInfo = loadDeploymentInfo();
    if (!deploymentInfo) {
      return res.status(500).json({ 
        message: 'Lending protocol not deployed or deployment info not found' 
      });
    }

    // Debug: Log deployment info
    console.log('🔍 Deployment info loaded:', {
      programId: deploymentInfo.programId,
      globalMarketPda: deploymentInfo.globalMarketPda,
      hasProgramId: !!deploymentInfo.programId,
      hasGlobalMarketPda: !!deploymentInfo.globalMarketPda,
      deploymentInfoKeys: Object.keys(deploymentInfo)
    });

    // Validate required fields
    if (!deploymentInfo.programId || typeof deploymentInfo.programId !== 'string') {
      console.error('❌ Invalid programId:', deploymentInfo.programId);
      return res.status(500).json({ 
        message: 'Deployment info missing or invalid programId' 
      });
    }

    if (!deploymentInfo.globalMarketPda || typeof deploymentInfo.globalMarketPda !== 'string') {
      console.error('❌ Invalid globalMarketPda:', deploymentInfo.globalMarketPda);
      return res.status(500).json({ 
        message: 'Deployment info missing or invalid globalMarketPda' 
      });
    }

    // Validate that the values look like valid public keys
    if (!deploymentInfo.programId.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      console.error('❌ Invalid programId format:', deploymentInfo.programId);
      return res.status(500).json({ 
        message: 'Deployment info has invalid programId format' 
      });
    }

    if (!deploymentInfo.globalMarketPda.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      console.error('❌ Invalid globalMarketPda format:', deploymentInfo.globalMarketPda);
      return res.status(500).json({ 
        message: 'Deployment info has invalid globalMarketPda format' 
      });
    }

    // Setup Solana connection and program
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
    const provider = new anchor.AnchorProvider(connection, {} as any, {});
    anchor.setProvider(provider);
    
    // Create program instance using program ID from deployment
    let programId: PublicKey;
    let program: any;
    let globalMarketPda: PublicKey;
    
    try {
      console.log('🔧 Creating PublicKey for programId:', deploymentInfo.programId);
      programId = new PublicKey(deploymentInfo.programId);
      console.log('✅ ProgramId PublicKey created successfully');
      
      console.log('🔧 Creating Anchor Program...');
      // Create program instance using the new Anchor format
      program = new anchor.Program(LENDING_PROGRAM_IDL as any, provider);
      console.log('✅ Anchor Program created successfully');
      
      console.log('🔧 Creating PublicKey for globalMarketPda:', deploymentInfo.globalMarketPda);
      globalMarketPda = new PublicKey(deploymentInfo.globalMarketPda);
      console.log('✅ GlobalMarketPda PublicKey created successfully');
    } catch (error) {
      console.error('❌ Error creating PublicKey or Program:', error);
      return res.status(500).json({ 
        message: 'Failed to create program instance',
        error: error.toString()
      });
    }

    // Setup accounts
    const userWallet = new PublicKey(walletAddress);
    const nftMint = new PublicKey(nftMintAddress);

    // Derive PDAs
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      program.programId
    );

    const [nftEscrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_escrow"), userWallet.toBuffer(), nftMint.toBuffer()],
      program.programId
    );

    // Get user's NFT token account
    const userNftTokenAccount = await getAssociatedTokenAddress(nftMint, userWallet);

    // Derive NFT metadata PDA
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [nftMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Build deposit NFT transaction
    const depositInstruction = await program.methods
      .depositNft()
      .accounts({
        globalMarket: globalMarketPda,
        borrowerAccount: borrowerAccountPda,
        nftMint: nftMint,
        userNftAccount: userNftTokenAccount,
        nftEscrow: nftEscrowPda,
        user: userWallet,
        nftMetadata: nftMetadataPda,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    // Create transaction
    const transaction = new Transaction();
    transaction.add(depositInstruction);

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Serialize transaction for frontend
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    console.log(`✅ Created deposit NFT transaction for wallet: ${walletAddress}, NFT: ${nftMintAddress}`);

    res.status(200).json({
      message: 'Deposit NFT transaction created successfully',
      transaction: serializedTransaction.toString('base64'),
      lastValidBlockHeight,
      accounts: {
        globalMarket: globalMarketPda.toString(),
        borrowerAccount: borrowerAccountPda.toString(),
        nftMint: nftMintAddress,
        nftEscrow: nftEscrowPda.toString(),
        userNftAccount: userNftTokenAccount.toString(),
      }
    });
  } catch (error) {
    console.error('Error depositing NFT:', error);
    res.status(500).json({ 
      message: 'Failed to deposit NFT as collateral',
      error: error.toString()
    });
  }
}
