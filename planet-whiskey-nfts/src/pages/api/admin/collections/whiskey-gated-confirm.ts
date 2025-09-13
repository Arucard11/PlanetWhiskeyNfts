import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import NftCollection from '@/models/NftCollection';
import Company from '@/models/Company';
import { withAdminAuth } from '@/lib/adminAuth';

export default withAdminAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const {
      name,
      symbol,
      metadataUri,
      collectionMint,
      collectionConfig,
      requiredWhiskeyAmount,
      itemLimit
    } = req.body;

    // Create or find the Whiskey Hodler Rewards company
    let whiskeyCompany = await Company.findOne({ name: 'Whiskey Hodler Rewards' });
    if (!whiskeyCompany) {
      whiskeyCompany = new Company({
        name: 'Whiskey Hodler Rewards',
        description: 'Exclusive NFT collections for WHISKEY token holders with special perks and free mints.'
      });
      await whiskeyCompany.save();
      console.log('✨ Created new Whiskey Hodler Rewards company');
    }
    
    const companyId = whiskeyCompany._id.toString();

    // Validate required fields
    if (!name || !symbol || !metadataUri || !collectionMint || !collectionConfig || !requiredWhiskeyAmount || !itemLimit) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['name', 'symbol', 'metadataUri', 'collectionMint', 'collectionConfig', 'requiredWhiskeyAmount', 'itemLimit']
      });
    }

    console.log('💾 Saving whiskey-gated collection to database:', {
      name,
      symbol,
      collectionMint,
      collectionConfig,
      requiredWhiskeyAmount,
      itemLimit
    });

    // Create the collection document
    const newCollection = new NftCollection({
      name,
      symbol,
      description: "Whiskey-gated collection for WHISKEY token holders", // Default description
      metadataUri,
      nftBaseMetadataUri: metadataUri, // Use same URI as base for whiskey-gated
      nftBaseName: name, // Use collection name as base name
      collectionOnChainAddress: collectionConfig, // PDA address
      collectionMintAddress: collectionMint, // Collection mint address
      mintPriceLamports: 0, // Free mint for qualified holders (but they need WHISKEY to qualify)
      mintPriceWhiskeyTokens: parseInt(requiredWhiskeyAmount), // Show required WHISKEY amount as price
      mintPriceUsd: 0, // No USD price for whiskey-gated
      itemLimit: parseInt(itemLimit),
      companyId,
      isActive: true,
      authority: process.env.NEXT_PUBLIC_ADMIN_WALLET, // Admin wallet is the authority
      // NEW: Whiskey gating fields
      isWhiskeyGated: true,
      requiredWhiskeyAmount: parseInt(requiredWhiskeyAmount)
    });

    const savedCollection = await newCollection.save();

    console.log('✅ Whiskey-gated collection saved to database:', savedCollection._id);

    res.status(200).json({
      success: true,
      message: 'Whiskey-gated collection saved successfully',
      collection: {
        _id: savedCollection._id,
        name: savedCollection.name,
        symbol: savedCollection.symbol,
        collectionOnChainAddress: savedCollection.collectionOnChainAddress,
        collectionMintAddress: savedCollection.collectionMintAddress,
        metadataUri: savedCollection.metadataUri,
        itemLimit: savedCollection.itemLimit,
        isWhiskeyGated: true,
        requiredWhiskeyAmount
      }
    });

  } catch (error) {
    console.error('Error saving whiskey-gated collection:', error);
    res.status(500).json({ 
      message: 'Failed to save whiskey-gated collection', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});
