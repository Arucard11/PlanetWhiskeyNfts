import { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import lendingprogramIdl from '@/lib/idl/lendingprogram.json';
import whiskeyProgramIdl from '@/lib/idl/whiskeyprogram.json';
import dbConnect from '@/lib/mongodb';
import NftCollection from '@/models/NftCollection';

// Program IDs from environment variables
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID || '25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ');
const WHISKEY_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID || 'Y5ZTxmgfR51njNPjHRm9WYzbmvoG4uptaQnHupdKbFM');

// Collection Registry PDA seed (V2 - new registry with correct authority)
const COLLECTION_REGISTRY_SEED = 'collection_registry_v2';

interface CollectionEntry {
  mint: string;
  valueUsd: number;
  isApproved: boolean;
  addedAt: number;
  isWhiskeyGated?: boolean;
  requiredWhiskeyAmount?: number;
}

interface CollectionRegistry {
  authority: string;
  collections: CollectionEntry[];
  nextRegistry: string | null;
  bump: number;
}

// Function to check if a collection is whiskey-gated by looking in the database
async function checkWhiskeyGatedStatus(collectionMint: string): Promise<{isWhiskeyGated: boolean, requiredWhiskeyAmount: number}> {
  try {
    await dbConnect();
    
    // Look for a collection in the database that has this mint as its collection mint address
    const collection = await NftCollection.findOne({ 
      $or: [
        { collectionMintAddress: collectionMint },
        { collectionOnChainAddress: collectionMint }
      ]
    });

    if (collection && collection.isWhiskeyGated) {
      return { 
        isWhiskeyGated: true, 
        requiredWhiskeyAmount: collection.requiredWhiskeyAmount || 0 
      };
    }
    
    return { isWhiskeyGated: false, requiredWhiskeyAmount: 0 };
  } catch (error) {
    console.log(`Could not check whiskey-gated status for ${collectionMint}:`, error);
    return { isWhiskeyGated: false, requiredWhiskeyAmount: 0 };
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT') {
    res.setHeader('Allow', ['GET', 'POST', 'PUT']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    // Setup Solana connection
    const connection = new Connection(
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Derive the Collection Registry PDA
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(COLLECTION_REGISTRY_SEED)],
      LENDING_PROGRAM_ID
    );

    if (req.method === 'GET') {
      try {
        // Fetch the collection registry account data
        const accountInfo = await connection.getAccountInfo(collectionRegistryPda);
        
        if (!accountInfo) {
          return res.status(200).json({
            success: true,
            message: 'Collection registry not initialized',
            collections: [],
            registryPda: collectionRegistryPda.toString(),
            isInitialized: false
          });
        }

        console.log('🔍 Fetching Collection Registry account:', collectionRegistryPda.toString());

        // Parse the account data manually
        const accountData = accountInfo.data.slice(8); // Skip discriminator
        
        // Parse the registry structure
        let offset = 0;
        
        // Authority (32 bytes)
        const authority = new PublicKey(accountData.slice(offset, offset + 32));
        offset += 32;
        
        // Collections length (4 bytes)
        const collectionsLength = accountData.readUInt32LE(offset);
        offset += 4;
        
        // Parse collections
        const collections: CollectionEntry[] = [];
        for (let i = 0; i < collectionsLength; i++) {
          // Mint (32 bytes)
          const mint = new PublicKey(accountData.slice(offset, offset + 32));
          offset += 32;
          
          // Value USD (8 bytes)
          const valueUsd = accountData.readBigUInt64LE(offset);
          offset += 8;
          
          // Is approved (1 byte)
          const isApproved = accountData.readUInt8(offset) === 1;
          offset += 1;
          
          // Added at (8 bytes)
          const addedAt = accountData.readBigInt64LE(offset);
          offset += 8;
          
          collections.push({
            mint: mint.toString(),
            valueUsd: Number(valueUsd) / 1_000_000, // Convert from microdollars
            isApproved,
            addedAt: Number(addedAt)
          });
        }
        
        // Next registry (1 byte for Option<Pubkey>)
        const hasNextRegistry = accountData.readUInt8(offset) === 1;
        offset += 1;
        let nextRegistry: string | null = null;
        if (hasNextRegistry) {
          nextRegistry = new PublicKey(accountData.slice(offset, offset + 32)).toString();
          offset += 32;
        }
        
        // Bump (1 byte)
        const bump = accountData.readUInt8(offset);

        const registry: CollectionRegistry = {
          authority: authority.toString(),
          collections,
          nextRegistry,
          bump
        };

        console.log('✅ Successfully parsed Collection Registry:', registry);

        // Augment collections with whiskey-gated information
        const augmentedCollections = await Promise.all(
          registry.collections.map(async (collection) => {
            const whiskeyGatedInfo = await checkWhiskeyGatedStatus(collection.mint);
            return {
              ...collection,
              isWhiskeyGated: whiskeyGatedInfo.isWhiskeyGated,
              requiredWhiskeyAmount: whiskeyGatedInfo.requiredWhiskeyAmount
            };
          })
        );

        res.status(200).json({
          success: true,
          message: 'Collection registry loaded successfully',
          collections: augmentedCollections,
          registryPda: collectionRegistryPda.toString(),
          isInitialized: true,
          totalCollections: augmentedCollections.length,
          approvedCollections: augmentedCollections.filter(c => c.isApproved).length
        });

      } catch (error) {
        console.error('Error fetching collection registry:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch collection registry',
          error: error instanceof Error ? error.message : 'Unknown error',
          registryPda: collectionRegistryPda.toString()
        });
      }
    } else if (req.method === 'POST') {
      // Add new collection
      const { collectionMint, valueUsd } = req.body;
      
      if (!collectionMint || !valueUsd) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: collectionMint, valueUsd'
        });
      }

      try {
        // Setup Anchor program
        const provider = new anchor.AnchorProvider(connection, {} as any, {});
        const program = new anchor.Program(lendingprogramIdl as any, provider);

        // Create the add collection instruction
        const addCollectionIx = await program.methods
          .addCollection(
            new PublicKey(collectionMint),
            BigInt(Math.floor(valueUsd * 1_000_000)) // Convert to microdollars
          )
          .accounts({
            collectionRegistry: collectionRegistryPda,
            admin: new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET || '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk'), // Admin wallet
          })
          .instruction();

        // Create transaction
        const transaction = new anchor.web3.Transaction().add(addCollectionIx);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET!);
        
        // Serialize transaction
        const serializedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

        res.status(200).json({
          success: true,
          message: 'Add collection transaction created',
          transaction: serializedTransaction.toString('base64'),
          needsWalletSignature: true,
          collectionMint,
          valueUsd
        });

      } catch (error) {
        console.error('Error creating add collection transaction:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create add collection transaction',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } else if (req.method === 'PUT') {
      // Update collection value or toggle approval
      const { collectionMint, newValueUsd, toggleApproval } = req.body;
      
      if (!collectionMint) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: collectionMint'
        });
      }

      try {
        // Setup Anchor program
        const provider = new anchor.AnchorProvider(connection, {} as any, {});
        const program = new anchor.Program(lendingprogramIdl as any, provider);

        let instruction;
        
        if (toggleApproval) {
          // Toggle collection approval
          instruction = await program.methods
            .toggleCollectionApproval(new PublicKey(collectionMint))
            .accounts({
              collectionRegistry: collectionRegistryPda,
              admin: new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET || '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk'), // Admin wallet
            })
            .instruction();
        } else if (newValueUsd) {
          // Update collection value
          instruction = await program.methods
            .updateCollectionValue(
              new PublicKey(collectionMint),
              BigInt(Math.floor(newValueUsd * 1_000_000)) // Convert to microdollars
            )
            .accounts({
              collectionRegistry: collectionRegistryPda,
              admin: new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET || '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk'), // Admin wallet
            })
            .instruction();
        } else {
          return res.status(400).json({
            success: false,
            message: 'Must provide either newValueUsd or toggleApproval: true'
          });
        }

        // Create transaction
        const transaction = new anchor.web3.Transaction().add(instruction);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET!);
        
        // Serialize transaction
        const serializedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });

        res.status(200).json({
          success: true,
          message: toggleApproval ? 'Toggle approval transaction created' : 'Update value transaction created',
          transaction: serializedTransaction.toString('base64'),
          needsWalletSignature: true,
          collectionMint,
          newValueUsd,
          toggleApproval
        });

      } catch (error) {
        console.error('Error creating update transaction:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create update transaction',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

  } catch (error) {
    console.error('Error in collection registry handler:', error);
    res.status(500).json({ 
      message: 'Failed to process collection registry request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default withAdminAuth(handler);
