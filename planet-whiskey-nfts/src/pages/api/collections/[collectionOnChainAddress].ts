import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import NftCollection, { INftCollection } from '@/models/NftCollection';
import { getSolanaProgram } from '@/lib/solanaUtils';
import { Program } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

// Interface for the augmented collection data
interface IAugmentedNftCollection {
  _id: string; 
  collectionOnChainAddress: string;
  collectionMintAddress: string;
  name: string;
  symbol: string;
  metadataUri: string;
  nftBaseMetadataUri: string;
  mintPriceLamports: number;
  mintPriceWhiskeyTokens: number;
  itemLimit: number;
  companyId: string; 
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date; 
  itemsMintedOnChain?: number;
  authority?: string;
}

async function getCollectionItemsMinted(collectionPdaString: string, program: any): Promise<number | undefined> {
  try {
    const pda = new PublicKey(collectionPdaString);
    const accountInfo = await program.account.collectionConfig.fetch(pda);
    return (accountInfo as any).itemsMinted.toNumber();
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
  const { collectionOnChainAddress } = req.query;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  if (typeof collectionOnChainAddress !== 'string') {
    return res.status(400).json({ success: false, message: 'Collection on-chain address must be a string.' });
  }

  try {
    await dbConnect();

    // Get Solana program instance (using default provider from solanaUtils for reads)
    const program = getSolanaProgram(); 

    const collectionFromDB = await NftCollection.findOne({ collectionOnChainAddress }).lean<INftCollection>();

    if (!collectionFromDB) {
      return res.status(404).json({ success: false, message: 'Collection not found in database.' });
    }

    let itemsMintedOnChain: number | undefined = undefined;
    if (collectionFromDB.collectionOnChainAddress) { // Should always be true if found by this field
        itemsMintedOnChain = await getCollectionItemsMinted(collectionFromDB.collectionOnChainAddress, program);
    }
    
    // Ensure _id and companyId are strings
    const augmentedCollection: IAugmentedNftCollection = {
      ...(collectionFromDB as any),
      _id: collectionFromDB._id.toString(),
      companyId: collectionFromDB.companyId.toString(),
      itemsMintedOnChain,
    };

    res.status(200).json({ success: true, data: augmentedCollection });

  } catch (error: any) {
    console.error(`Error fetching collection ${collectionOnChainAddress}:`, error);
    res.status(500).json({ success: false, message: `Error fetching collection ${collectionOnChainAddress}`, error: error.message });
  }
} 