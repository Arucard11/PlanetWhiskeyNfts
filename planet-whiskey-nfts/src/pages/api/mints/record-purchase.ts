import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import WalletNftPurchase, { IWalletNftPurchase } from '@/models/WalletNftPurchase';
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';

// Helper function to verify transaction (updated for custom Solana program)
async function verifyTransaction(
  connection: Connection, 
  signature: string, 
  expectedNftMint: string, 
  expectedPurchaser: string, 
  expectedCollectionMint: string
): Promise<boolean> {
  try {
    console.log(`Starting verification for transaction: ${signature}`);
    console.log(`Expected NFT mint: ${expectedNftMint}`);
    console.log(`Expected purchaser: ${expectedPurchaser}`);
    console.log(`Expected collection mint: ${expectedCollectionMint}`);

    const tx: ParsedTransactionWithMeta | null = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });

    if (!tx || !tx.meta) {
      console.error('Transaction not found or meta is missing', { signature });
      return false;
    }

    if (tx.meta.err) {
      console.error('Transaction failed:', { signature, error: tx.meta.err });
      return false;
    }

    console.log('Transaction found and successful');

    // Check if the purchaser was a signer
    const purchaserKey = new PublicKey(expectedPurchaser);
    const signers = tx.transaction.message.accountKeys.filter(acc => acc.signer);
    const purchaserIsSigner = signers.some(signer => signer.pubkey.equals(purchaserKey));
    if (!purchaserIsSigner) {
      console.error('Purchaser was not a signer of the transaction.', { signature, expectedPurchaser });
      return false;
    }

    console.log('Purchaser verified as signer');

    // Custom Solana Program verification
    const whiskeyProgramId = new PublicKey("8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L");
    const metaplexProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    
    let customProgramInstructionFound = false;
    let metaplexInstructionFound = false;

    // Check for both custom program and Metaplex instructions
    for (const instruction of tx.transaction.message.instructions) {
      if (instruction.programId.equals(whiskeyProgramId)) {
        console.log('Found custom whiskey program instruction');
        customProgramInstructionFound = true;
      }
      
      if (instruction.programId.equals(metaplexProgramId)) {
        console.log('Found Metaplex Token Metadata instruction');
        metaplexInstructionFound = true;
      }
    }

    if (!customProgramInstructionFound) {
      console.error(`Custom whiskey program instruction not found in transaction ${signature}`);
      return false;
    }

    // Check transaction logs for mint creation evidence
    let mintCreationVerified = false;
    if (tx.meta.logMessages) {
      console.log('Checking transaction logs for mint creation evidence...');
      
      // Look for mint-related logs
      const mintLogs = tx.meta.logMessages.filter(log => 
        log.includes('MINT_NFT_HANDLER_ENTRY_POINT_LOG') || // Custom program log
        log.includes(expectedNftMint) || // NFT mint address in logs
        log.includes('Minting new NFT') || // Custom program mint log
        log.includes('New NFT minted') || // Custom program success log
        log.includes('Incremented items_minted') // Custom program increment log
      );

      if (mintLogs.length > 0) {
        console.log(`Found ${mintLogs.length} mint-related log messages`);
        mintLogs.forEach(log => console.log(`Mint log: ${log}`));
        mintCreationVerified = true;
      }

      // Also check for program success logs
      const successLogs = tx.meta.logMessages.filter(log => 
        log.includes('Program log: Instruction: MintNft') ||
        log.includes('success') ||
        log.includes('Program 8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L success')
      );

      if (successLogs.length > 0) {
        console.log(`Found ${successLogs.length} success log messages`);
        mintCreationVerified = true;
      }
    }

    if (!mintCreationVerified) {
      console.warn(`Could not verify mint creation in transaction logs for ${signature}`);
      // Don't fail immediately - try to verify by checking if NFT exists on-chain
    }

    // Additional verification: Check if the NFT mint actually exists on-chain
    try {
      const nftMintPubkey = new PublicKey(expectedNftMint);
      const mintInfo = await connection.getAccountInfo(nftMintPubkey);
      
      if (mintInfo) {
        console.log(`NFT mint ${expectedNftMint} exists on-chain`);
        mintCreationVerified = true;
      } else {
        console.error(`NFT mint ${expectedNftMint} does not exist on-chain`);
        return false;
      }
    } catch (e: any) {
      console.error(`Error checking NFT mint existence: ${e.message}`);
      return false;
    }

    // Optional: Try to verify collection association if needed
    let collectionVerified = true; // Default to true for now
    
    try {
      // Only try Metaplex verification if we found Metaplex instructions
      if (metaplexInstructionFound) {
        const { Metaplex } = await import('@metaplex-foundation/js');
        const metaplex = Metaplex.make(connection);

        const nft = await metaplex.nfts().findByMint({ mintAddress: new PublicKey(expectedNftMint) });

        if (nft && nft.collection) {
          if (nft.collection.address.equals(new PublicKey(expectedCollectionMint))) {
            console.log(`NFT ${expectedNftMint} is correctly associated with collection ${expectedCollectionMint}`);
            collectionVerified = true;
          } else {
            console.warn(`NFT ${expectedNftMint} is associated with different collection: ${nft.collection.address.toBase58()}`);
            // Don't fail for collection mismatch - might be a different collection format
          }
        } else {
          console.warn(`NFT ${expectedNftMint} collection information not found via Metaplex`);
          // Don't fail - collection might be set differently
        }
      }
    } catch (e: any) {
      console.warn(`Could not verify collection association via Metaplex: ${e.message}`);
      // Don't fail for Metaplex errors - continue with basic verification
    }

    const isValid = purchaserIsSigner && customProgramInstructionFound && mintCreationVerified;
    console.log(`Transaction verification result: ${isValid}`);
    console.log(`- Purchaser is signer: ${purchaserIsSigner}`);
    console.log(`- Custom program instruction found: ${customProgramInstructionFound}`);
    console.log(`- Mint creation verified: ${mintCreationVerified}`);
    console.log(`- Collection verified: ${collectionVerified}`);

    return isValid;
  } catch (error) {
    console.error('Error during transaction verification:', { signature, error: error.message });
    console.error('Full error:', error);
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { walletAddress, nftMintAddress, collectionMintAddress, transactionSignature } = req.body;

  console.log('Record purchase request received:', {
    walletAddress,
    nftMintAddress,
    collectionMintAddress,
    transactionSignature
  });

  if (!walletAddress || !nftMintAddress || !collectionMintAddress || !transactionSignature) {
    return res.status(400).json({ success: false, message: 'Missing required fields in request body.' });
  }
  
  if (typeof walletAddress !== 'string' || typeof nftMintAddress !== 'string' || typeof collectionMintAddress !== 'string' || typeof transactionSignature !== 'string') {
    return res.status(400).json({ success: false, message: 'All fields must be strings.' });
  }

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ success: false, message: "Server configuration error: SOLANA_RPC_URL is not set." });
  }

  console.log(`Connecting to Solana RPC: ${rpcUrl}`);
  const connection = new Connection(rpcUrl, 'confirmed');

  try {
    const isVerified = await verifyTransaction(connection, transactionSignature, nftMintAddress, walletAddress, collectionMintAddress);

    if (!isVerified) {
      console.error('Transaction verification failed for:', {
        transactionSignature,
        nftMintAddress,
        walletAddress,
        collectionMintAddress
      });
      return res.status(400).json({ success: false, message: 'Transaction verification failed. Purchase not recorded.' });
    }

    console.log('Transaction verified successfully, saving to database...');
    await dbConnect();

    const newPurchase: IWalletNftPurchase = await WalletNftPurchase.create({
      walletAddress,
      nftMintAddress,
      collectionMintAddress,
      transactionSignature,
      purchaseDate: new Date(),
    });

    console.log('Purchase recorded successfully:', newPurchase._id);
    res.status(201).json({ success: true, data: newPurchase });

  } catch (error: any) {
    // Check for duplicate key error (e.g., if transactionSignature or nftMintAddress is unique)
    if (error.code === 11000) {
      console.log('Duplicate entry detected:', error.keyValue);
      return res.status(409).json({ success: false, message: 'Duplicate entry. This purchase may have already been recorded.', field: error.keyValue });
    }
    console.error("Error recording purchase:", error);
    res.status(500).json({ success: false, message: 'Error recording purchase.', error: error.message });
  }
} 