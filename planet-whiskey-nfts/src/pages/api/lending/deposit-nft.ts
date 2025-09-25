import { NextApiRequest, NextApiResponse } from 'next';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection, getAnchorProvider } from '@/lib/solanaUtils';
import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';
import fs from 'fs';

function loadLendingProgram() {
  try {
    const connection = getSolanaConnection();
    
    // Use a temporary keypair for read-only operations
    const tempKeypair = Keypair.generate();
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

  const { nftMintAddress, walletAddress, collectionMintAddress } = req.body;

  console.log('🔍 API Debug - Received addresses:');
  console.log('🔍 nftMintAddress:', nftMintAddress);
  console.log('🔍 walletAddress:', walletAddress);
  console.log('🔍 collectionMintAddress:', collectionMintAddress);

  if (!nftMintAddress || !walletAddress || !collectionMintAddress) {
    return res.status(400).json({ 
      message: 'NFT mint address, wallet address, and collection mint address are required' 
    });
  }

  try {
    // Load lending program using environment variables
    const lendingProgramData = loadLendingProgram();
    if (!lendingProgramData) {
      return res.status(500).json({ 
        message: 'Failed to load lending program' 
      });
    }

    const { program, connection, LENDING_PROGRAM_ID } = lendingProgramData;

    // First, validate that the NFT belongs to an approved collection
    console.log('🔍 Validating NFT collection...');
    
    // Get NFT metadata to check collection
    const nftMint = new PublicKey(nftMintAddress);
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [nftMetadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), nftMint.toBuffer()],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Get the collection registry PDA
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry')],
      LENDING_PROGRAM_ID
    );

    try {
      // Debug: Log the PDA we're trying to fetch
      console.log(`🔍 [DEPOSIT_NFT] Checking NFT metadata account:`, {
        nftMintAddress: nftMintAddress,
        nftMetadataPda: nftMetadataPda.toString(),
        TOKEN_METADATA_PROGRAM_ID: TOKEN_METADATA_PROGRAM_ID.toString()
      });

      // Fetch NFT metadata to get collection information
      const metadataAccount = await connection.getAccountInfo(nftMetadataPda);
      console.log(`🔍 [DEPOSIT_NFT] Metadata account result:`, {
        exists: !!metadataAccount,
        dataLength: metadataAccount?.data?.length,
        owner: metadataAccount?.owner?.toString(),
        executable: metadataAccount?.executable
      });

      if (!metadataAccount) {
        console.error(`❌ [DEPOSIT_NFT] NFT metadata account not found for mint: ${nftMintAddress}`);
        console.error(`❌ [DEPOSIT_NFT] Expected metadata PDA: ${nftMetadataPda.toString()}`);
        
        // Try to use Metaplex to verify the NFT exists
        try {
          const { Metaplex } = await import('@metaplex-foundation/js');
          const metaplex = Metaplex.make(connection);
          const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint });
          console.log(`🔍 [DEPOSIT_NFT] Metaplex found NFT:`, {
            name: nft.name,
            uri: nft.uri,
            hasCollection: !!nft.collection,
            collectionAddress: nft.collection?.address?.toString()
          });
          
          // If Metaplex found it, the issue might be with our PDA derivation
          console.log(`⚠️ [DEPOSIT_NFT] NFT exists per Metaplex, but metadata PDA not found. Possible PDA derivation issue.`);
        } catch (metaplexError) {
          console.error(`❌ [DEPOSIT_NFT] Metaplex also failed to find NFT:`, metaplexError);
          console.error(`❌ [DEPOSIT_NFT] This NFT appears to have been minted without proper on-chain metadata.`);
          console.error(`❌ [DEPOSIT_NFT] This is likely due to a failed mint transaction that only partially succeeded.`);
          
          return res.status(400).json({ 
            message: 'NFT metadata account not found. This NFT was not properly minted with on-chain metadata. Please try minting a new NFT.' 
          });
        }
        
        return res.status(400).json({ 
          message: 'NFT was not properly minted with on-chain metadata. This NFT cannot be used for lending. Please try minting a new NFT.' 
        });
      }

      console.log(`✅ [DEPOSIT_NFT] NFT metadata account found successfully`);
      
      // Try to deserialize the metadata account to get more info
      try {
        // We'll skip full deserialization for now, but at least we know the account exists
        console.log(`✅ [DEPOSIT_NFT] Metadata account exists, proceeding with collection validation...`);
      } catch (deserializeError) {
        console.warn(`⚠️ [DEPOSIT_NFT] Could not deserialize metadata, but account exists:`, deserializeError);
      }

      // Check the collection registry for approved collections
      try {
        const registryAccount = await (program.account as any).collectionRegistry.fetch(collectionRegistryPda);
        console.log(`📋 Found ${registryAccount.collections.length} collections in registry`);
        
        // For now, we'll proceed with the transaction since the program will validate
        // TODO: Parse NFT metadata to extract collection mint and validate against registry
        console.log('✅ NFT metadata found, proceeding with transaction...');
      } catch (regError) {
        console.error('❌ Error fetching collection registry:', regError);
        return res.status(400).json({ 
          message: 'Collection registry not found. Please contact admin to set up lending collections.' 
        });
      }
    } catch (error) {
      console.error('❌ Error fetching NFT metadata:', error);
      return res.status(400).json({ 
        message: 'Failed to validate NFT. Please ensure this is a valid NFT from an approved collection.' 
      });
    }

    // Derive global market PDA using environment variable
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    // collectionRegistryPda already defined above during validation

    console.log('🔧 Using environment-based addresses:');
    console.log('  Lending Program ID:', LENDING_PROGRAM_ID.toString());
    console.log('  Global Market PDA:', globalMarketPda.toString());
    console.log('  Collection Registry PDA:', collectionRegistryPda.toString());

    // Setup accounts
    const userWallet = new PublicKey(walletAddress);
    // nftMint already defined above during validation

    // Derive PDAs using correct seeds for lending program
    const [borrowerAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("borrower_account"), userWallet.toBuffer()],
      LENDING_PROGRAM_ID
    );

    const [nftEscrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_escrow"), userWallet.toBuffer(), nftMint.toBuffer()],
      LENDING_PROGRAM_ID
    );

    // Get user's NFT token account
    const userNftTokenAccount = await getAssociatedTokenAddress(nftMint, userWallet);

    // TOKEN_METADATA_PROGRAM_ID and nftMetadataPda already defined above during validation

    // Debug: Check all PublicKey objects before using them
    console.log('🔍 Checking all PublicKey objects:');
    console.log('  globalMarketPda:', globalMarketPda?.toString());
    console.log('  borrowerAccountPda:', borrowerAccountPda?.toString());
    console.log('  nftMint:', nftMint?.toString());
    console.log('  userNftTokenAccount:', userNftTokenAccount?.toString());
    console.log('  nftEscrowPda:', nftEscrowPda?.toString());
    console.log('  userWallet:', userWallet?.toString());
    console.log('  nftMetadataPda:', nftMetadataPda?.toString());
    console.log('  TOKEN_METADATA_PROGRAM_ID:', TOKEN_METADATA_PROGRAM_ID?.toString());
    console.log('  TOKEN_PROGRAM_ID:', TOKEN_PROGRAM_ID?.toString());
    console.log('  ASSOCIATED_TOKEN_PROGRAM_ID:', ASSOCIATED_TOKEN_PROGRAM_ID?.toString());
          console.log('  SystemProgram:', '11111111111111111111111111111111');

    // Validate all PublicKey objects are defined
    const requiredPublicKeys = {
      globalMarketPda,
      borrowerAccountPda,
      nftMint,
      userNftTokenAccount,
      nftEscrowPda,
      userWallet,
      nftMetadataPda,
      TOKEN_METADATA_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: new PublicKey('11111111111111111111111111111111')
    };

    for (const [name, pubkey] of Object.entries(requiredPublicKeys)) {
      if (!pubkey) {
        console.error(`❌ Missing required PublicKey: ${name}`);
        return res.status(500).json({ 
          message: `Missing required PublicKey: ${name}`,
          error: `PublicKey ${name} is undefined`
        });
      }
      if (!(pubkey instanceof PublicKey)) {
        console.error(`❌ Invalid PublicKey type for ${name}:`, typeof pubkey);
        return res.status(500).json({ 
          message: `Invalid PublicKey type for ${name}`,
          error: `Expected PublicKey, got ${typeof pubkey}`
        });
      }
    }
    console.log('✅ All PublicKey objects are valid');

    // Build deposit NFT transaction
    console.log('🔨 Building deposit NFT instruction...');
    
    let depositInstruction;
    try {
      depositInstruction = await (program.methods as any)
        .depositNft(new PublicKey(collectionMintAddress))
        .accounts({
          globalMarket: globalMarketPda,
          collectionRegistry: collectionRegistryPda,
          borrowerAccount: borrowerAccountPda,
          nftMint: nftMint,
          userNftAccount: userNftTokenAccount,
          nftEscrow: nftEscrowPda,
          user: userWallet,
          nftMetadata: nftMetadataPda,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: new PublicKey('11111111111111111111111111111111'),
        })
        .instruction();
      
      console.log('✅ Deposit instruction created successfully');
    } catch (instructionError) {
      console.error('❌ Error creating deposit instruction:', instructionError);
      return res.status(500).json({ 
        message: 'Failed to create deposit instruction',
        error: instructionError.toString()
      });
    }

    // Create transaction
    const transaction = new Transaction();
    transaction.add(depositInstruction);

    // Get recent blockhash (use finalized for more reliability)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = userWallet;

    // Test transaction with simulation first
    console.log('🧪 Simulating transaction...');
    try {
      const simulation = await connection.simulateTransaction(transaction);
      console.log('📊 Simulation result:', simulation);
      
      if (simulation.value.err) {
        console.error('❌ Transaction simulation failed:', simulation.value.err);
        
        // Check for specific error codes and provide user-friendly messages
        let userMessage = 'Transaction simulation failed';
        const logs = simulation.value.logs || [];
        
        // Check logs for specific error messages
        const errorLogs = logs.filter(log => 
          log.includes('InvalidNftCollection') || 
          log.includes('not from an approved collection') ||
          log.includes('Error Code: InvalidNftCollection')
        );
        
        if (errorLogs.length > 0) {
          userMessage = 'This NFT is not from an approved collection. Only NFTs from approved collections can be used as collateral for lending.';
        } else if (simulation.value.err.InstructionError) {
          const instructionError = simulation.value.err.InstructionError;
          if (Array.isArray(instructionError) && instructionError.length >= 2) {
            const [instructionIndex, customError] = instructionError;
            if (customError.Custom === 6022) { // InvalidNftCollection error code
              userMessage = 'This NFT is not from an approved collection. Only NFTs from approved collections can be used as collateral for lending.';
            }
          }
        }
        
        return res.status(400).json({ 
          message: userMessage,
          error: simulation.value.err,
          logs: simulation.value.logs,
          errorCode: 'INVALID_NFT_COLLECTION'
        });
      }
      
      console.log('✅ Transaction simulation successful');
    } catch (simError) {
      console.error('❌ Error simulating transaction:', simError);
      return res.status(500).json({ 
        message: 'Failed to simulate transaction',
        error: simError.toString()
      });
    }

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
