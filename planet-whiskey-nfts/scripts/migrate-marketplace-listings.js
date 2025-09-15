#!/usr/bin/env node

// Migration script to add NFT metadata to existing marketplace listings

const mongoose = require('mongoose');
const { Connection, PublicKey } = require('@solana/web3.js');
const { Metaplex } = require('@metaplex-foundation/js');

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planet-whiskey-nfts';

// Solana connection
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

// MarketplaceListing Schema (simplified for migration)
const MarketplaceListingSchema = new mongoose.Schema({
  nftMintAddress: String,
  sellerWalletAddress: String,
  collectionMintAddress: String,
  priceInWhiskey: Number,
  listingStatus: String,
  transactionSignature: String,
  nftName: String,
  nftImageUrl: String,
  collectionName: String,
  createdAt: Date,
});

// NftCollection Schema (simplified for migration)
const NftCollectionSchema = new mongoose.Schema({
  collectionMintAddress: String,
  name: String,
  metadataUri: String,
});

const MarketplaceListing = mongoose.model('MarketplaceListing', MarketplaceListingSchema);
const NftCollection = mongoose.model('NftCollection', NftCollectionSchema);

// Fetch metadata using proxy API
async function fetchMetadataWithProxy(metadataUri) {
  if (!metadataUri) return null;
  
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/collections/metadata?metadataUri=${encodeURIComponent(metadataUri)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.warn(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    if (!result.success) {
      console.warn(`API returned error: ${result.message}`);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error(`Error fetching metadata:`, error);
    return null;
  }
}

async function migrateListings() {
  console.log('🚀 Starting marketplace listings migration...');
  
  try {
    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Connect to Solana
    console.log('🌐 Connecting to Solana...');
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const metaplex = Metaplex.make(connection);
    console.log('✅ Connected to Solana');

    // Find all listings that need migration (missing nftName field)
    const listingsToMigrate = await MarketplaceListing.find({
      $or: [
        { nftName: { $exists: false } },
        { nftName: null },
        { nftName: '' },
        { nftName: 'Unknown NFT' }
      ]
    }).lean();

    console.log(`📋 Found ${listingsToMigrate.length} listings to migrate`);

    if (listingsToMigrate.length === 0) {
      console.log('✅ No listings need migration');
      return;
    }

    // Process each listing
    let successCount = 0;
    let errorCount = 0;

    for (const listing of listingsToMigrate) {
      try {
        console.log(`\n🔄 Processing listing: ${listing.nftMintAddress}`);

        let nftName = 'Unknown NFT';
        let nftImageUrl = '/placeholder-image.svg';
        let collectionName = 'Unknown Collection';

        try {
          const nftMint = new PublicKey(listing.nftMintAddress);
          const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint });
          
          let loadedJson = nft.json;
          if (!loadedJson) {
            console.log(`  📥 Fetching metadata from URI: ${nft.uri}`);
            loadedJson = await fetchMetadataWithProxy(nft.uri);
          }
          
          if (loadedJson) {
            nftName = loadedJson.name || 'Unknown NFT';
            
            // Process image URL
            let imageUrl = loadedJson.image || '/placeholder-image.svg';
            if (imageUrl && imageUrl.startsWith('ipfs://')) {
              const hash = imageUrl.substring(7);
              nftImageUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
            } else if (imageUrl && imageUrl.includes('gateway.pinata.cloud/ipfs/')) {
              nftImageUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(imageUrl)}`;
            } else {
              nftImageUrl = imageUrl;
            }
            
            console.log(`  ✅ NFT metadata: ${nftName}`);
          } else {
            console.log(`  ⚠️  Could not fetch NFT metadata`);
          }
        } catch (nftError) {
          console.error(`  ❌ Error fetching NFT metadata:`, nftError.message);
        }

        // Get collection name from database
        try {
          const collection = await NftCollection.findOne({ 
            collectionMintAddress: listing.collectionMintAddress 
          }).lean();
          
          if (collection) {
            collectionName = collection.name;
            console.log(`  ✅ Collection: ${collectionName}`);
          } else {
            console.log(`  ⚠️  Collection not found in database`);
          }
        } catch (collectionError) {
          console.error(`  ❌ Error fetching collection:`, collectionError.message);
        }

        // Update the listing with the new fields
        await MarketplaceListing.findByIdAndUpdate(
          listing._id,
          {
            nftName,
            nftImageUrl,
            collectionName,
          }
        );

        console.log(`  ✅ Updated listing: ${nftName} (${collectionName})`);
        successCount++;

        // Add a small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`  ❌ Error processing listing ${listing.nftMintAddress}:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`✅ Successfully migrated: ${successCount} listings`);
    console.log(`❌ Failed to migrate: ${errorCount} listings`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('📊 Database connection closed');
  }
}

// Run the migration
migrateListings()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
