#!/usr/bin/env node

/**
 * Fetch Raydium pool data using their API v3
 * This script will get the complete account structure for WHISKEY/SOL and SOL/USDC pools
 */

const https = require('https');
const fs = require('fs');

// Token addresses
const WHISKEY_TOKEN_MINT = '9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph';
const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

async function fetchRaydiumPools() {
    console.log('🔍 Fetching Raydium pool data from API v3...\n');
    
    try {
        // Fetch all AMM pools
        console.log('📡 Fetching AMM pools...');
        const poolsResponse = await fetch('https://api-v3.raydium.io/pools/info/ids?ids=');
        
        if (!poolsResponse.ok) {
            console.log('❌ Failed to fetch from pools endpoint, trying mint endpoint...');
            
            // Try the mint-based endpoint
            const mintResponse = await fetch('https://api-v3.raydium.io/pools/info/mint');
            const mintData = await mintResponse.json();
            
            console.log('📊 Total pools found:', mintData.data?.length || 0);
            
            // Find WHISKEY/SOL pool
            const whiskeyPool = mintData.data?.find(pool => 
                (pool.mintA.address === WHISKEY_TOKEN_MINT && pool.mintB.address === SOL_MINT) ||
                (pool.mintB.address === WHISKEY_TOKEN_MINT && pool.mintA.address === SOL_MINT)
            );
            
            // Find SOL/USDC pool
            const solUsdcPool = mintData.data?.find(pool => 
                (pool.mintA.address === SOL_MINT && pool.mintB.address === USDC_MINT) ||
                (pool.mintB.address === SOL_MINT && pool.mintA.address === USDC_MINT)
            );
            
            console.log('\n🔍 Pool Search Results:');
            console.log('WHISKEY/SOL Pool:', whiskeyPool ? '✅ Found' : '❌ Not found');
            console.log('SOL/USDC Pool:', solUsdcPool ? '✅ Found' : '❌ Not found');
            
            if (whiskeyPool) {
                console.log('\n📋 WHISKEY/SOL Pool Details:');
                console.log('Pool ID:', whiskeyPool.id);
                console.log('Program ID:', whiskeyPool.programId);
                console.log('Authority:', whiskeyPool.authority);
                console.log('Open Orders:', whiskeyPool.openOrders);
                console.log('Target Orders:', whiskeyPool.targetOrders);
                console.log('Base Vault:', whiskeyPool.baseVault);
                console.log('Quote Vault:', whiskeyPool.quoteVault);
                console.log('Market ID:', whiskeyPool.marketId);
                console.log('Market Program ID:', whiskeyPool.marketProgramId);
            }
            
            if (solUsdcPool) {
                console.log('\n📋 SOL/USDC Pool Details:');
                console.log('Pool ID:', solUsdcPool.id);
                console.log('Program ID:', solUsdcPool.programId);
                console.log('Authority:', solUsdcPool.authority);
                console.log('Open Orders:', solUsdcPool.openOrders);
                console.log('Target Orders:', solUsdcPool.targetOrders);
                console.log('Base Vault:', solUsdcPool.baseVault);
                console.log('Quote Vault:', solUsdcPool.quoteVault);
                console.log('Market ID:', solUsdcPool.marketId);
                console.log('Market Program ID:', solUsdcPool.marketProgramId);
            }
            
            // Save complete data
            const poolData = {
                whiskeyPool: whiskeyPool || null,
                solUsdcPool: solUsdcPool || null,
                generatedAt: new Date().toISOString(),
                note: whiskeyPool ? 'WHISKEY/SOL pool found on Raydium' : 'WHISKEY/SOL pool not found - may need to use Jupiter for WHISKEY->SOL step'
            };
            
            fs.writeFileSync('raydium-pools-complete.json', JSON.stringify(poolData, null, 2));
            console.log('\n💾 Pool data saved to raydium-pools-complete.json');
            
            return poolData;
        }
        
    } catch (error) {
        console.error('❌ Error fetching pool data:', error.message);
        
        // Fallback: Use known SOL/USDC pool data
        console.log('\n🔄 Using known SOL/USDC pool data as fallback...');
        
        const fallbackData = {
            whiskeyPool: null,
            solUsdcPool: {
                id: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2",
                programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
                authority: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
                openOrders: "HRk9CMrpq7Jn9sh7mzxE8CChHG8dneX9p475QKz4Fsfc",
                targetOrders: "CZza3Ej4Mc58MnxWA385itCC9jCo3L1D7zc3LKy1bZMR",
                baseVault: "EPHD6BKtTjEqzKKWZ1GrTCJTkp5FGrPqCPRGrfCgYDv5", // SOL
                quoteVault: "4SqVFtKUWgvPqDCJsrw5v3ZYJwwkYRgAHGJdEPrBBpPc", // USDC
                lpMint: "8HoQnePLqPj4M7PUDzfw8e3Ymdwgc7NLGnaTUapubyvu",
                marketId: "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLusDBzvT",
                marketProgramId: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
                marketBids: "14ivtgssEBoBjuZJtSAPKYgpUK7DmnSwuPMqJoVTSgKJ",
                marketAsks: "CEQdAFKdycHugujbcS9pHecSLANv9KV9SEEDoAH4TR6q",
                marketEventQueue: "5KKsLVU6TcbVDK4BS6K1DGDxnh4Q9xjYJ8XaDCG5t8ht",
                marketCoinVault: "36c6YqAwyGKQG66XEp2dJc5JqjaBNv7sVghEtJv4c7u6",
                marketPcVault: "8CFo8bL8mZQK8abbFyypFMwEDd8tVJjHTTojMLgQTUSZ",
                marketVaultSigner: "F8Vyqk3unwxkXukZFQeYyGmFfTG3CAX4v24iyrjEYBJV"
            },
            generatedAt: new Date().toISOString(),
            note: "Using fallback data - WHISKEY/SOL pool may not exist on Raydium"
        };
        
        fs.writeFileSync('raydium-pools-complete.json', JSON.stringify(fallbackData, null, 2));
        console.log('💾 Fallback pool data saved to raydium-pools-complete.json');
        
        return fallbackData;
    }
}

// Helper function for fetch (Node.js compatibility)
async function fetch(url) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            let data = '';
            
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                resolve({
                    ok: response.statusCode >= 200 && response.statusCode < 300,
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        request.on('error', (error) => {
            reject(error);
        });
    });
}

// Run the script
if (require.main === module) {
    fetchRaydiumPools()
        .then((data) => {
            console.log('\n✅ Pool data fetch completed!');
            
            if (data && !data.whiskeyPool) {
                console.log('\n⚠️  IMPORTANT: WHISKEY/SOL pool not found on Raydium.');
                console.log('   Consider using Jupiter for WHISKEY → SOL swap instead.');
                console.log('   Then use Raydium for SOL → USDC swap.');
            } else if (data && data.whiskeyPool) {
                console.log('\n🎉 WHISKEY/SOL pool found! Ready for full Raydium implementation.');
            }
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { fetchRaydiumPools };
