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

    // Get company name from environment or use default
    const masterDistillerCompanyName = process.env.MASTER_DISTILLER_COMPANY_NAME || 'Master Distiller Rewards';
    
    // Find the Master Distiller Rewards company - it MUST exist
    // First check for old name and update it if found
    const oldCompany = await Company.findOne({ name: 'Whiskey Hodler Rewards' });
    if (oldCompany) {
      oldCompany.name = masterDistillerCompanyName;
      oldCompany.description = 'NFT collections for WHISKEY token holders with special perks and free mints.';
      await oldCompany.save();
      console.log(`✨ Updated old Whiskey Hodler Rewards to ${masterDistillerCompanyName}`);
    }
    
    let whiskeyCompany = await Company.findOne({ name: masterDistillerCompanyName });
    if (!whiskeyCompany) {
      // Company doesn't exist - this should not happen in production
      // Return an error instead of creating a new one
      console.error('❌ Master Distiller Rewards company not found in database!');
      return res.status(500).json({
        message: `${masterDistillerCompanyName} company not found. Please add it to the database first.`,
        instruction: `Run: db.companies.insertOne({name: "${masterDistillerCompanyName}", description: "NFT collections for WHISKEY token holders with special perks and free mints.", createdAt: new Date()})`
      });
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
