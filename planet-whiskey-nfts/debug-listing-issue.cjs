// Use built-in fetch (Node.js 18+)
// const fetch = require('node-fetch');

async function debugListingIssue() {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    console.log(`🔍 Debugging listing issue...`);
    console.log(`🔗 Base URL: ${baseUrl}`);
    
    // Test 1: Check if the API is accessible
    try {
        console.log(`\n📡 Testing API accessibility...`);
        const response = await fetch(`${baseUrl}/api/marketplace/listings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const listings = await response.json();
            console.log(`✅ API accessible - Found ${listings.length} listings`);
            
            // Look for the specific NFT
            const stuckNft = listings.find(l => l.nftMintAddress === "5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5");
            if (stuckNft) {
                console.log(`✅ Found stuck NFT in database:`, stuckNft);
            } else {
                console.log(`❌ Stuck NFT not found in database`);
            }
        } else {
            console.log(`❌ API not accessible: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log(`❌ Error accessing API: ${error.message}`);
    }
    
    // Test 2: Try to manually add the listing with the correct signature
    console.log(`\n📝 Testing manual listing creation...`);
    
    // You'll need to provide the full transaction signature from your transaction
    const listingData = {
        nftMintAddress: "5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5",
        price: 1000000,
        collectionMintAddress: "5U4fRbS1NCdTaFxfaJ7LB8hJ5uijuSTMsezPNsnBCnCT",
        signature: "2ALGN1UsN3nquke7gCWm..." // This needs to be the FULL signature from your transaction
    };
    
    const headers = {
        'Content-Type': 'application/json',
        'x-wallet-address': 'CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n'
    };
    
    console.log(`📝 Attempting to create listing with data:`, listingData);
    
    try {
        const response = await fetch(`${baseUrl}/api/marketplace/list`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(listingData)
        });
        
        const result = await response.json();
        
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📄 Response:`, result);
        
        if (response.ok) {
            console.log(`✅ Listing created successfully!`);
        } else {
            console.log(`❌ Failed to create listing: ${result.message}`);
            
            // If it's a verification error, let's check what the verification is looking for
            if (result.message && result.message.includes('verification')) {
                console.log(`\n🔍 Verification failed. This could be because:`);
                console.log(`1. The transaction signature is incorrect or incomplete`);
                console.log(`2. The transaction hasn't been confirmed yet`);
                console.log(`3. The verification logic is looking for the wrong instruction name`);
                console.log(`4. The accounts in the transaction don't match what's expected`);
                
                console.log(`\n💡 To fix this:`);
                console.log(`1. Get the FULL transaction signature from Solana Explorer`);
                console.log(`2. Make sure the transaction is confirmed`);
                console.log(`3. Check that the seller wallet matches: CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n`);
                console.log(`4. Check that the NFT mint matches: 5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5`);
                console.log(`5. Check that the price matches: 1000000`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Error creating listing: ${error.message}`);
    }
    
    // Test 3: Check server logs
    console.log(`\n📋 To debug further:`);
    console.log(`1. Check the server logs for detailed verification messages`);
    console.log(`2. Look for [VERIFY_LIST_TX] logs to see what's failing`);
    console.log(`3. Check if the transaction is being found and decoded correctly`);
    console.log(`4. Verify the instruction name matches 'listNft'`);
}

debugListingIssue();
