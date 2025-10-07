const { MongoClient } = require('mongodb');

// Database connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whiskeyplanet';
const DB_NAME = 'whiskeyplanet';

async function cleanupDatabase() {
    console.log('🚀 Starting database cleanup...');
    console.log('📍 MongoDB URI:', MONGODB_URI);
    
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DB_NAME);
        
        // Get collection counts before deletion
        const walletPurchasesCount = await db.collection('walletnftpurchases').countDocuments() || 0;
        const collectionsCount = await db.collection('nftcollections').countDocuments() || 0;
        const listingsCount = await db.collection('marketplacelistings').countDocuments() || 0;
        
        console.log('\n📊 Current database state:');
        console.log(`   Wallet NFT Purchases: ${walletPurchasesCount}`);
        console.log(`   NFT Collections: ${collectionsCount}`);
        console.log(`   Marketplace Listings: ${listingsCount}`);
        
        // Confirmation prompt
        if (process.argv.includes('--confirm')) {
            console.log('\n🗑️  Deleting all data...');
            
            // Delete all wallet purchases (transactions)
            console.log('   🗑️  Deleting wallet purchases...');
            const walletPurchasesResult = await db.collection('walletnftpurchases').deleteMany({});
            console.log(`   ✅ Deleted ${walletPurchasesResult.deletedCount} wallet purchases`);
            
            // Delete all NFT collections
            console.log('   🗑️  Deleting NFT collections...');
            const collectionsResult = await db.collection('nftcollections').deleteMany({});
            console.log(`   ✅ Deleted ${collectionsResult.deletedCount} collections`);
            
            // Delete all marketplace listings
            console.log('   🗑️  Deleting marketplace listings...');
            const listingsResult = await db.collection('marketplacelistings').deleteMany({});
            console.log(`   ✅ Deleted ${listingsResult.deletedCount} listings`);
            
            console.log('\n🎉 Database cleanup completed successfully!');
            console.log('\n📊 Records deleted:');
            console.log(`   Wallet NFT Purchases: ${walletPurchasesResult.deletedCount}`);
            console.log(`   NFT Collections: ${collectionsResult.deletedCount}`);
            console.log(`   Marketplace Listings: ${listingsResult.deletedCount}`);
            
        } else {
            console.log('\n⚠️  DRY RUN MODE - No data was deleted');
            console.log('   To actually delete data, run:');
            console.log('   node scripts/cleanup-database.js --confirm');
            console.log('\n🔍 What would be deleted:');
            console.log(`   • ${walletPurchasesCount} wallet purchases`);
            console.log(`   • ${collectionsCount} NFT collections`);
            console.log(`   • ${listingsCount} marketplace listings`);
        }
        
    } catch (error) {
        console.error('❌ Database cleanup failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n🔐 Database connection closed');
    }
}

// Safety check
async function safetyCheck() {
    if (process.argv.includes('--confirm')) {
        console.log('⚠️  WARNING: This will permanently delete ALL data!');
        console.log('⚠️  Make sure you have backups if needed');
        console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds...');
        
        for (let i = 5; i > 0; i--) {
            process.stdout.write(`\r⏳ Starting in ${i} seconds...   `);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n🚀 Starting cleanup...');
    }
}

async function main() {
    await safetyCheck();
    await cleanupDatabase();
}

main().catch(console.error);
