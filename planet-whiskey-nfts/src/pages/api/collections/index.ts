import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import NftCollection, { INftCollection } from '@/models/NftCollection';
import { getSolanaConnection, getSolanaProgram, adminKeypair } from '@/lib/solanaUtils';
import { Program } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';

// Extend INftCollection to include itemsMinted from on-chain
interface INftCollectionWithMintedCount extends Omit<INftCollection, 'mintPriceLamports' | 'itemLimit'> {
  _id: string; // Ensure _id is part of the type if using .lean()
  collectionOnChainAddress: string;
  collectionMintAddress: string;
  name: string;
  symbol: string;
  metadataUri: string;
  nftBaseMetadataUri: string;
  mintPriceLamports: number; // Keep these as numbers from DB
  itemLimit: number; // Keep these as numbers from DB
  companyId: string; // Assuming companyId is string representation of ObjectId
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date; // Assuming timestamps: true in schema
  itemsMintedOnChain?: number;
}

async function getCollectionItemsMinted(collectionPdaString: string, program: Program<any>) {
  try {
    const pda = new PublicKey(collectionPdaString);
    const accountInfo = await program.account.collectionConfig.fetch(pda);
    // itemsMinted in CollectionConfig is u64, which Anchor maps to BN
    return accountInfo.itemsMinted.toNumber(); 
  } catch (error) {
    console.error(`Error fetching on-chain itemsMinted for PDA ${collectionPdaString}:`, error);
    return undefined; 
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  const { companyId } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  try {
    await dbConnect();

    // Get Solana program instance. 
    // No specific signer needed for fetching account data, 
    // getSolanaProgram from solanaUtils will use a default provider if adminKeypair is not explicitly needed or passed.
    // Or, if getSolanaProgram requires a signer, ensure solanaUtils handles a read-only scenario.
    // For simplicity, assuming getSolanaProgram can provide a program instance for reads.
    const program = getSolanaProgram(); // This uses adminKeypair by default if solanaUtils is set up that way
                                      // If adminKeypair isn't desired for reads, solanaUtils needs a read-only provider option.
                                      // For now, proceeding with the existing getSolanaProgram behavior.

    const filter: any = {};
    if (companyId && typeof companyId === 'string') {
      filter.companyId = companyId;
    }

    // Fetch from DB. Using .lean() for performance and plain objects.
    const collectionsFromDB = await NftCollection.find(filter).lean<INftCollection[]>();
    
    console.log(`[COLLECTIONS_API] 📊 Found ${collectionsFromDB.length} collections in database for filter:`, filter);
    collectionsFromDB.forEach((collection, index) => {
      console.log(`[COLLECTIONS_API] 📝 Collection ${index + 1}:`, {
        name: collection.name,
        _id: collection._id.toString(),
        metadataUri: collection.metadataUri,
        nftBaseMetadataUri: collection.nftBaseMetadataUri,
        collectionOnChainAddress: collection.collectionOnChainAddress
      });
    });

    // Augment with on-chain items_minted count
    const augmentedCollections: INftCollectionWithMintedCount[] = await Promise.all(
      collectionsFromDB.map(async (collection) => {
        let itemsMintedOnChain: number | undefined = undefined;
        if (collection.collectionOnChainAddress) {
          itemsMintedOnChain = await getCollectionItemsMinted(collection.collectionOnChainAddress, program);
        }
        const augmented = {
          ...(collection as any), // Cast to any to avoid Omit issues if INftCollection has more fields
          _id: collection._id.toString(), // ensure _id is string
          companyId: collection.companyId.toString(), // ensure companyId is string
          itemsMintedOnChain,
        };
        
        console.log(`[COLLECTIONS_API] 🔄 Augmented collection "${collection.name}":`, {
          metadataUri: augmented.metadataUri,
          itemsMintedOnChain: augmented.itemsMintedOnChain
        });
        
        return augmented;
      })
    );

    res.status(200).json({ success: true, data: augmentedCollections });
  } catch (error: any) {
    console.error("Error fetching collections:", error);
    res.status(500).json({ success: false, message: "Error fetching collections", error: error.message });
  }
} 