const { Connection, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

async function debugCollection() {
    console.log('🔍 Debugging collection on-chain data...');
    
    // Get collection address from command line
    const collectionAddress = process.argv[2];
    if (!collectionAddress) {
        console.error('❌ Please provide collection address: node debug-collection.js <COLLECTION_ADDRESS>');
        process.exit(1);
    }
    
    console.log('📍 Collection address:', collectionAddress);
    
    try {
        // Connect to Solana
        const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
        
        // Load program
        const programId = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID || '9HCie1czuSrxHYZ97uxH7WnyBA8bqV1SVjn64VZmCp6q');
        const idlPath = path.join(__dirname, 'src/lib/idl/whiskeyprogram.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Create provider
        const tempKeypair = anchor.web3.Keypair.generate();
        const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(tempKeypair), {});
        const program = new anchor.Program(idl, provider);
        
        // Fetch collection data
        const collectionPda = new PublicKey(collectionAddress);
        console.log('🔑 Fetching collection data from PDA:', collectionPda.toString());
        
        const accountInfo = await connection.getAccountInfo(collectionPda);
        if (!accountInfo) {
            console.error('❌ Collection account not found!');
            return;
        }
        
        console.log('✅ Collection account exists');
        console.log('📊 Account data length:', accountInfo.data.length);
        
        // Decode the account data
        const collectionData = program.coder.accounts.decode('collectionConfig', accountInfo.data);
        
        console.log('\n📋 Collection Data:');
        console.log('  Name:', collectionData.name);
        console.log('  Symbol:', collectionData.symbol);
        console.log('  Authority:', collectionData.authority.toString());
        console.log('  Collection Mint:', collectionData.collectionMint.toString());
        console.log('  Item Limit:', collectionData.itemLimit.toString());
        console.log('  Items Minted:', collectionData.itemsMinted.toString());
        console.log('  Is Whiskey Gated:', collectionData.isWhiskeyGated);
        console.log('  Required Whiskey Amount:', collectionData.requiredWhiskeyAmount.toString());
        console.log('  Mint Price SOL:', collectionData.mintPriceSol.toString());
        console.log('  Mint Price Whiskey:', collectionData.mintPriceWhiskey.toString());
        console.log('  Mint Price USD:', collectionData.mintPriceUsd.toString());
        
        if (collectionData.isWhiskeyGated) {
            console.log('\n✅ This collection IS whiskey-gated!');
        } else {
            console.log('\n❌ This collection is NOT whiskey-gated!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugCollection().catch(console.error);
