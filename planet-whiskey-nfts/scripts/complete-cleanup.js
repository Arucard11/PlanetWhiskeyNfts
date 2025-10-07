const { MongoClient } = require('mongodb');

// Database connection configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/whiskeyplanet';
const DB_NAME = 'whiskeyplanet';

// Collections to clean up
const COLLECTIONS_TO_CLEAN = [
    'walletnftpurchases',    // Wallet NFT purchases/transactions
    'nftcollections',        // NFT collections
    'marketplacelistings',   // Marketplace listings
    'companies',             // Company data
    'adminusers',            // Admin users
    'users',                 // Regular users (if any)
    'sessions',              // User sessions
    'activity',              // Activity logs
    'logs',                  // General logs
    'testcollections',       // Test collections
    'tempdata',              // Temporary data
];

async function completeCleanup() {
    console.log('🚀 Starting COMPLETE database cleanup...');
    console.log('📍 MongoDB URI:', MONGODB_URI);
    
    // Connect to MongoDB
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DB_NAME);
        
        // Get list of all collections
        const allCollections = await db.listCollections().toArray();
        const existingCollections = allCollections.map(c => c.name);
        
        console.log('\n📋 Found collections:', existingCollections);
        
        // Show counts for all collections
        console.log('\n📊 Current database state:');
        const counts = {};
        for (const collectionName of COLLECTIONS_TO_CLEAN) {
            if (existingCollections.includes(collectionName)) {
                const count = await db.collection(collectionName).countDocuments();
                counts[collectionName] = count;
                console.log(`   ${collectionName}: ${count} documents`);
            } else {
                console.log(`   ${collectionName}: ❌ Collection does not exist`);
            }
        }
        
        // Also show any other collections that weren't listed
        const unlistedCollections = existingCollections.filter(name => !COLLECTIONS_TO_CLEAN.includes(name));
        if (unlistedCollections.length > 0) {
            console.log('\n🔍 Other collections found:');
            for (const collectionName of unlistedCollections) {
                const count = await db.collection(collectionName).countDocuments();
                console.log(`   ${collectionName}: ${count} documents`);
            }
        }
        
        if (process.argv.includes('--confirm')) {
            console.log('\n🗑️  DELETING ALL DATA...');
            let totalDeleted = 0;
            
            // Delete from listed collections
            for (const collectionName of COLLECTIONS_TO_CLEAN) {
                if (existingCollections.includes(collectionName)) {
                    console.log(`   🗑️  Deleting from ${collectionName}...`);
                    const result = await db.collection(collectionName).deleteMany({});
                    console.log(`   ✅ Deleted ${result.deletedCount} documents from ${collectionName}`);
                    totalDeleted += result.deletedCount;
                }
            }
            
            // Optionally delete unlisted collections (ask user)
            if (unlistedCollections.length > 0 && process.argv.includes('--delete-all')) {
                console.log('\n🗑️  Deleting unlisted collections...');
                for (const collectionName of unlistedCollections) {
                    console.log(`   🗑️  Deleting ${collectionName}...`);
                    const result = await db.collection(collectionName).deleteMany({});
                    console.log(`   ✅ Deleted ${result.deletedCount} documents from ${collectionName}`);
                    totalDeleted += result.deletedCount;
                }
            }
            
            console.log('\n🎉 Complete cleanup finished!');
            console.log(`📊 Total documents deleted: ${totalDeleted}`);
            
        } else {
            console.log('\n⚠️  DRY RUN MODE - No data was deleted');
            console.log('   To actually delete data, run:');
            console.log('   node scripts/complete-cleanup.js --confirm');
            console.log('\n🔍 What would be deleted:');
            
            let totalWouldDelete = 0;
            for (const [collectionName, count] of Object.entries(counts)) {
                if (count > 0) {
                    console.log(`   • ${collectionName}: ${count} documents`);
                    totalWouldDelete += count;
                }
            }
            
            if (unlistedCollections.length > 0) {
                console.log('\n📋 Unlisted collections (use --delete-all to remove):');
                for (const collectionName of unlistedCollections) {
                    const count = await db.collection(collectionName).countDocuments();
                    if (count > 0) {
                        console.log(`   • ${collectionName}: ${count} documents`);
                    }
                }
            }
            
            console.log(`\n📊 Total documents that would be deleted: ${totalWouldDelete}`);
        }
        
    } catch (error) {
        console.error('❌ Database cleanup failed:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n🔐 Database connection closed');
    }
}

// Safety check with extended timeout
async function safetyCheck() {
    if (process.argv.includes('--confirm')) {
        console.log('⚠️  WARNING: This will permanently delete ALL data!');
        console.log('⚠️  Make sure you have backups if needed');
        console.log('⚠️  Press Ctrl+C to cancel, or wait 10 seconds...');
        
        for (let i = 10; i > 0; i--) {
            process.stdout.write(`\r⏳ Starting cleanup in ${i} seconds...   `);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n🚀 Starting cleanup...');
    }
}

async function main() {
    await safetyCheck();
    await completeCleanup();
}

main().catch(console.error);
