// Simple test to check database directly
const { MongoClient } = require('mongodb');

async function checkDatabase() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/whiskey-planet-nfts';
    
    console.log(`🔍 Connecting to database...`);
    console.log(`🔗 URI: ${uri.substring(0, 30)}...`);
    
    try {
        const client = new MongoClient(uri);
        await client.connect();
        
        const db = client.db();
        
        // Check marketplace listings
        console.log(`\n📋 Checking marketplace listings...`);
        const listingsCollection = db.collection('marketplacelistings');
        const listingsCount = await listingsCollection.countDocuments();
        console.log(`📊 Total listings in database: ${listingsCount}`);
        
        if (listingsCount > 0) {
            const allListings = await listingsCollection.find({}).toArray();
            console.log(`📄 All listings:`, allListings.map(l => ({
                nftMintAddress: l.nftMintAddress,
                sellerWalletAddress: l.sellerWalletAddress,
                priceInWhiskey: l.priceInWhiskey,
                listingStatus: l.listingStatus,
                createdAt: l.createdAt
            })));
            
            // Look for the specific stuck NFT
            const stuckNft = allListings.find(l => l.nftMintAddress === "5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5");
            if (stuckNft) {
                console.log(`✅ Found stuck NFT in database:`, stuckNft);
            } else {
                console.log(`❌ Stuck NFT not found in database`);
            }
        }
        
        // Check NFT collections
        console.log(`\n📚 Checking NFT collections...`);
        const collectionsCollection = db.collection('nftcollections');
        const collectionsCount = await collectionsCollection.countDocuments();
        console.log(`📊 Total collections in database: ${collectionsCount}`);
        
        if (collectionsCount > 0) {
            const allCollections = await collectionsCollection.find({}).toArray();
            console.log(`📄 All collections:`, allCollections.map(c => ({
                name: c.name,
                collectionMintAddress: c.collectionMintAddress,
                itemsMintedOnChain: c.itemsMintedOnChain
            })));
        }
        
        await client.close();
        console.log(`\n✅ Database check complete`);
        
    } catch (error) {
        console.error(`❌ Database error:`, error.message);
    }
}

checkDatabase();




