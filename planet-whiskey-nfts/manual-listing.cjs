const fetch = require('node-fetch');

async function manuallyAddListing() {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    const listingData = {
        nftMintAddress: "5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5",
        price: 1000000,
        collectionMintAddress: "5U4fRbS1NCdTaFxfaJ7LB8hJ5uijuSTMsezPNsnBCnCT", // Master Distiller Rewards collection
        signature: "2ALGN1UsN3nquke7gCWm..." // You'll need to provide the full signature
    };
    
    const headers = {
        'Content-Type': 'application/json',
        'x-wallet-address': 'CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n'
    };
    
    console.log(`🔍 Attempting to manually add listing to database...`);
    console.log(`📝 Data:`, listingData);
    console.log(`🔗 URL: ${baseUrl}/api/marketplace/list`);
    
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
            console.log(`✅ Listing added successfully!`);
        } else {
            console.log(`❌ Failed to add listing: ${result.message}`);
        }
        
    } catch (error) {
        console.error(`❌ Error adding listing:`, error);
    }
}

// Also check existing listings
async function checkExistingListings() {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    console.log(`\n🔍 Checking existing listings...`);
    
    try {
        const response = await fetch(`${baseUrl}/api/marketplace/listings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const listings = await response.json();
            console.log(`📊 Found ${listings.length} total listings`);
            
            const matchingListing = listings.find(l => l.nftMintAddress === "5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5");
            
            if (matchingListing) {
                console.log(`✅ Found matching listing:`, matchingListing);
            } else {
                console.log(`❌ No listing found for NFT: 5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5`);
            }
        } else {
            console.log(`❌ Failed to fetch listings: ${response.status}`);
        }
        
    } catch (error) {
        console.error(`❌ Error checking listings:`, error);
    }
}

async function main() {
    await checkExistingListings();
    await manuallyAddListing();
}

main();




