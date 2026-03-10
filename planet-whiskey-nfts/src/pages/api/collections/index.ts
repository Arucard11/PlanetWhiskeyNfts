import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import NftCollection, { INftCollection } from '@/models/NftCollection';
import { getSolanaConnection, getSolanaProgram, getAnchorProvider } from '@/lib/solanaUtils';
import { Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

// Interface for collection with items minted from on-chain
interface INftCollectionWithMintedCount {
  _id: string;
  collectionOnChainAddress: string;
  collectionMintAddress: string;
  name: string;
  symbol: string;
  metadataUri: string;
  nftBaseMetadataUri: string;
  mintPriceLamports: number;
  mintPriceWhiskeyTokens: number;
  mintPriceUsd?: number;
  baseMintPriceUsd?: number;
  priceIncreaseBps?: number;
  nftsPerPriceStep?: number;
  itemLimit: number;
  companyId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  itemsMintedOnChain?: number;
  isWhiskeyGated?: boolean;
  requiredWhiskeyAmount?: number;
}

async function getCollectionItemsMinted(collectionPdaString: string, program: any) {
  try {
    const pda = new PublicKey(collectionPdaString);
    const accountInfo = await program.account.collectionConfig.fetch(pda);
    // itemsMinted in CollectionConfig is u64, which Anchor maps to BN
    return (accountInfo as any).itemsMinted.toNumber(); 
  } catch (error) {
    console.error(`Error fetching on-chain itemsMinted for PDA ${collectionPdaString}:`, error);
    return undefined; 
  }
}

async function getCollectionOnChainData(collectionPdaString: string, program: any): Promise<{
  itemsMinted?: number;
  mintPriceUsd?: number;
  baseMintPriceUsd?: number;
  priceIncreaseBps?: number;
  nftsPerPriceStep?: number;
  isWhiskeyGated?: boolean;
  requiredWhiskeyAmount?: number;
}> {
  try {
    console.log(`[COLLECTIONS_API] 🔍 Fetching on-chain data for PDA: ${collectionPdaString}`);
    const pda = new PublicKey(collectionPdaString);
    console.log(`[COLLECTIONS_API] 🔑 PDA parsed successfully: ${pda.toString()}`);
    
    // Use connection.getAccountInfo instead of program.account.fetch
    const connection = getSolanaConnection();
    console.log(`[COLLECTIONS_API] 🌐 Using connection: ${connection.rpcEndpoint}`);
    
    const accountInfo = await connection.getAccountInfo(pda);
    console.log(`[COLLECTIONS_API] 📊 Account info result:`, accountInfo ? 'Account exists' : 'Account not found');
    
    if (!accountInfo) {
      console.log(`[COLLECTIONS_API] ⚠️ No account info found for PDA: ${collectionPdaString}`);
      return {};
    }
    
    // Decode the account data using the program coder
    let collectionConfigData;
    try {
      console.log(`[COLLECTIONS_API] 🔧 Attempting to decode account data for PDA: ${collectionPdaString}`);
      console.log(`[COLLECTIONS_API] 📊 Account data length: ${accountInfo.data.length} bytes`);
      console.log(`[COLLECTIONS_API] 🏷️ Account owner: ${accountInfo.owner.toString()}`);
      
      collectionConfigData = program.coder.accounts.decode('collectionConfig', accountInfo.data);
      console.log(`[COLLECTIONS_API] ✅ Successfully decoded account data`);
    } catch (decodeError) {
      console.error(`[COLLECTIONS_API] ❌ Failed to decode account data:`, decodeError);
      console.log(`[COLLECTIONS_API] 🔍 Raw account data (first 100 bytes):`, accountInfo.data.slice(0, 100));
      
      // Try the old method as fallback
      console.log(`[COLLECTIONS_API] 🔄 Trying fallback method: program.account.collectionConfig.fetch()`);
      try {
        const fallbackData = await program.account.collectionConfig.fetch(pda);
        console.log(`[COLLECTIONS_API] ✅ Fallback method succeeded`);
        collectionConfigData = fallbackData;
      } catch (fallbackError) {
        console.error(`[COLLECTIONS_API] ❌ Fallback method also failed:`, fallbackError);
        return {};
      }
    }
    
    const result = {
      itemsMinted: collectionConfigData.itemsMinted ? collectionConfigData.itemsMinted.toNumber() : 0,
      mintPriceUsd: collectionConfigData.mintPriceUsd ? collectionConfigData.mintPriceUsd.toNumber() / 1_000_000 : undefined,
      baseMintPriceUsd: collectionConfigData.baseMintPriceUsd ? collectionConfigData.baseMintPriceUsd.toNumber() / 1_000_000 : undefined,
      priceIncreaseBps: collectionConfigData.priceIncreaseBps ?? 0,
      nftsPerPriceStep: collectionConfigData.nftsPerPriceStep ?? 0,
      isWhiskeyGated: collectionConfigData.isWhiskeyGated || false,
      requiredWhiskeyAmount: collectionConfigData.requiredWhiskeyAmount ? collectionConfigData.requiredWhiskeyAmount.toNumber() : 0
    };
    
    console.log(`[COLLECTIONS_API] 📊 On-chain data for ${collectionPdaString}:`, result);
    return result;
  } catch (error) {
    console.error(`[COLLECTIONS_API] ❌ Error fetching on-chain data for PDA ${collectionPdaString}:`, error);
    return {};
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

    // Set up Solana program for on-chain data fetching
    console.log(`[COLLECTIONS_API] 🔧 Setting up Solana program...`);
    const connection = getSolanaConnection();
    console.log(`[COLLECTIONS_API] 🌐 Connection endpoint: ${connection.rpcEndpoint}`);
    
    const tempKeypair = Keypair.generate(); // Temporary keypair for read-only operations
    const provider = getAnchorProvider(tempKeypair);
    const program = getSolanaProgram(provider);
    
    console.log(`[COLLECTIONS_API] 📋 Program ID: ${program.programId.toString()}`);
    console.log(`[COLLECTIONS_API] 🔑 Expected program ID: ${process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID}`);
    
    if (program.programId.toString() !== process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID) {
      console.error(`[COLLECTIONS_API] ❌ Program ID mismatch!`);
      console.error(`[COLLECTIONS_API] 📋 Actual: ${program.programId.toString()}`);
      console.error(`[COLLECTIONS_API] 🔑 Expected: ${process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID}`);
    }

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

    // Augment with on-chain data including whiskey-gated information
    const augmentedCollections: INftCollectionWithMintedCount[] = await Promise.all(
      collectionsFromDB.map(async (collection) => {
        let onChainData: { itemsMinted?: number; mintPriceUsd?: number; baseMintPriceUsd?: number; priceIncreaseBps?: number; nftsPerPriceStep?: number; isWhiskeyGated?: boolean; requiredWhiskeyAmount?: number } = {};
        if (collection.collectionOnChainAddress) {
          console.log(`[COLLECTIONS_API] 🔍 Processing collection "${collection.name}" with PDA: ${collection.collectionOnChainAddress}`);
          onChainData = await getCollectionOnChainData(collection.collectionOnChainAddress, program);
          console.log(`[COLLECTIONS_API] 📊 Retrieved on-chain data for "${collection.name}":`, onChainData);
        } else {
          console.log(`[COLLECTIONS_API] ⚠️ Collection "${collection.name}" has no collectionOnChainAddress`);
        }
        const augmented = {
          ...(collection as any),
          _id: collection._id.toString(),
          companyId: collection.companyId.toString(),
          itemsMintedOnChain: onChainData.itemsMinted ?? 0,
          // Use on-chain price as source of truth when available (dynamic pricing updates it)
          mintPriceUsd: onChainData.mintPriceUsd ?? collection.mintPriceUsd,
          baseMintPriceUsd: onChainData.baseMintPriceUsd ?? (collection as any).baseMintPriceUsd,
          priceIncreaseBps: onChainData.priceIncreaseBps ?? (collection as any).priceIncreaseBps ?? 0,
          nftsPerPriceStep: onChainData.nftsPerPriceStep ?? (collection as any).nftsPerPriceStep ?? 0,
          isWhiskeyGated: collection.isWhiskeyGated ?? onChainData.isWhiskeyGated ?? false,
          requiredWhiskeyAmount: collection.requiredWhiskeyAmount ?? onChainData.requiredWhiskeyAmount ?? 0,
        };
        
        console.log(`[COLLECTIONS_API] 🔄 Augmented collection "${collection.name}":`, {
          metadataUri: augmented.metadataUri,
          itemsMintedOnChain: augmented.itemsMintedOnChain,
          isWhiskeyGated: augmented.isWhiskeyGated,
          requiredWhiskeyAmount: augmented.requiredWhiskeyAmount
        });
        
        return augmented;
      })
    );

    console.log(`[COLLECTIONS_API] ✅ Successfully returning ${augmentedCollections.length} collections`);
    
    // Add cache-busting headers to ensure fresh data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.status(200).json({ success: true, data: augmentedCollections });
  } catch (error: any) {
    console.error("[COLLECTIONS_API] ❌ Error fetching collections:", error);
    console.error("[COLLECTIONS_API] ❌ Error stack:", error.stack);
    res.status(500).json({ success: false, message: "Error fetching collections", error: error.message });
  }
} 