import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import NftCollection, { INftCollection } from '@/models/NftCollection';
import { getSolanaProgram, getAnchorProvider, getSolanaConnection } from '@/lib/solanaUtils';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';

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

async function getCollectionOnChainData(collectionPdaString: string, program: any): Promise<{
  itemsMinted?: number;
  isWhiskeyGated?: boolean;
  requiredWhiskeyAmount?: number;
}> {
  try {
    const pda = new PublicKey(collectionPdaString);
    const accountInfo = await program.account.collectionConfig.fetch(pda);
    return {
      itemsMinted: (accountInfo as any).itemsMinted.toNumber(),
      isWhiskeyGated: (accountInfo as any).isWhiskeyGated || false,
      requiredWhiskeyAmount: (accountInfo as any).requiredWhiskeyAmount ? (accountInfo as any).requiredWhiskeyAmount.toNumber() : 0
    };
  } catch (error) {
    console.error(`Error fetching on-chain data for PDA ${collectionPdaString}:`, error);
    return {};
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

    // Set up Solana program for on-chain data fetching
    const connection = getSolanaConnection();
    const tempKeypair = Keypair.generate(); // Temporary keypair for read-only operations
    const provider = getAnchorProvider(tempKeypair);
    const program = getSolanaProgram(provider); 

    const collectionFromDB = await NftCollection.findOne({ collectionOnChainAddress }).lean<INftCollection>();

    if (!collectionFromDB) {
      return res.status(404).json({ success: false, message: 'Collection not found in database.' });
    }

    // Fetch on-chain data including whiskey-gated information
    let onChainData: { itemsMinted?: number; isWhiskeyGated?: boolean; requiredWhiskeyAmount?: number } = {};
    if (collectionFromDB.collectionOnChainAddress) { // Should always be true if found by this field
        onChainData = await getCollectionOnChainData(collectionFromDB.collectionOnChainAddress, program);
    }
    
    // Ensure _id and companyId are strings
    const augmentedCollection: IAugmentedNftCollection = {
      ...(collectionFromDB as any),
      _id: collectionFromDB._id.toString(),
      companyId: collectionFromDB.companyId.toString(),
      itemsMintedOnChain: onChainData.itemsMinted ?? 0, // Default to 0 if undefined
      isWhiskeyGated: onChainData.isWhiskeyGated ?? false,
      requiredWhiskeyAmount: onChainData.requiredWhiskeyAmount ?? 0,
    };

    res.status(200).json({ success: true, data: augmentedCollection });

  } catch (error: any) {
    console.error(`Error fetching collection ${collectionOnChainAddress}:`, error);
    res.status(500).json({ success: false, message: `Error fetching collection ${collectionOnChainAddress}`, error: error.message });
  }
} 