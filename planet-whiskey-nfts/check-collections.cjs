const { MongoClient } = require('mongodb');

async function checkCollections() {
    console.log('🔍 Checking collections in database...');
    
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whiskeyplanet';
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db('whiskeyplanet');
        const collections = await db.collection('nftcollections').find({}).toArray();
        
        console.log(`\n📊 Found ${collections.length} collections:`);
        
        collections.forEach((col, i) => {
            console.log(`\n${i + 1}. ${col.name}`);
            console.log(`   Symbol: ${col.symbol}`);
            console.log(`   Collection Address: ${col.collectionOnChainAddress}`);
            console.log(`   Is Whiskey Gated: ${col.isWhiskeyGated || false}`);
            console.log(`   Required Whiskey: ${col.requiredWhiskeyAmount || 'N/A'}`);
            console.log(`   Item Limit: ${col.itemLimit}`);
            console.log(`   Items Minted: ${col.itemsMintedOnChain || 'Unknown'}`);
            console.log(`   Active: ${col.isActive}`);
        });
        
        const whiskeyGatedCollections = collections.filter(col => col.isWhiskeyGated);
        console.log(`\n🥃 Whiskey-gated collections: ${whiskeyGatedCollections.length}`);
        
        if (whiskeyGatedCollections.length === 0) {
            console.log('❌ No whiskey-gated collections found!');
            console.log('💡 You need to create a whiskey-gated collection first.');
        } else {
            console.log('✅ Whiskey-gated collections found:');
            whiskeyGatedCollections.forEach((col, i) => {
                console.log(`   ${i + 1}. ${col.name} (${col.collectionOnChainAddress})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

checkCollections().catch(console.error);
