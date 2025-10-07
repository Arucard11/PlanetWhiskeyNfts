import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable not found');
    console.error('Please define MONGODB_URI in .env.local');
    process.exit(1);
}

// Define the WalletNftPurchase schema (same as in models)
const WalletNftPurchaseSchema = new mongoose.Schema({
    walletAddress: { type: String, required: true, index: true },
    nftMintAddress: { type: String, required: true, unique: true },
    collectionMintAddress: { type: String, required: true, index: true },
    transactionSignature: { type: String, required: true, unique: true },
    purchaseDate: { type: Date, default: Date.now },
});

const WalletNftPurchase = mongoose.models.WalletNftPurchase || mongoose.model('WalletNftPurchase', WalletNftPurchaseSchema);

async function clearFailedTransactions() {
    console.log('🚀 Starting failed transaction cleanup...');
    console.log('📍 MongoDB URI:', MONGODB_URI);
    
    try {
        // Connect to MongoDB using mongoose (same as other files)
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        // Get current count
        const walletPurchasesCount = await WalletNftPurchase.countDocuments();
        console.log(`📊 Current wallet purchases: ${walletPurchasesCount}`);
        
        if (walletPurchasesCount === 0) {
            console.log('✅ No wallet purchases to clear');
            return;
        }
        
        // Clear all wallet purchases (this will allow you to test again)
        console.log('🗑️  Clearing all wallet purchases...');
        const result = await WalletNftPurchase.deleteMany({});
        console.log(`✅ Cleared ${result.deletedCount} wallet purchases`);
        
        console.log('🎉 Failed transaction cleanup completed!');
        console.log('💡 You can now test the whiskey-gated minting again');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔐 Database connection closed');
    }
}

clearFailedTransactions().catch(console.error);
