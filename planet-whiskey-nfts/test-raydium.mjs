/**
 * Simple test runner for Raydium SDK V2 integration
 * Run with: node test-raydium.mjs
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

console.log('🧪 RAYDIUM SDK V2 INTEGRATION TEST');
console.log('=================================');
console.log('');

// Test configuration
const TEST_CONFIG = {
  RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  WHISKEY_SOL_POOL_ID: '6vSXoRsZ4iPH1dW7LKu8CzAgv9AfvWXGXYnnkSrXtDLp',
  SOL_USDC_POOL_ID: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
  WHISKEY_MINT: process.env.NEXT_PUBLIC_WHISKEY_MINT || '9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph',
  USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

console.log('📋 Test Configuration:');
console.log(`• RPC URL: ${TEST_CONFIG.RPC_URL}`);
console.log(`• WHISKEY/SOL Pool: ${TEST_CONFIG.WHISKEY_SOL_POOL_ID}`);
console.log(`• SOL/USDC Pool: ${TEST_CONFIG.SOL_USDC_POOL_ID}`);
console.log(`• WHISKEY Mint: ${TEST_CONFIG.WHISKEY_MINT}`);
console.log(`• USDC Mint: ${TEST_CONFIG.USDC_MINT}`);
console.log('');

/**
 * Test 1: Connection and Pool ID Validation
 */
async function testConnectionAndPools() {
  console.log('🧪 TEST 1: Connection and Pool ID Validation');
  console.log('============================================');
  
  try {
    const connection = new Connection(TEST_CONFIG.RPC_URL);
    
    // Test connection
    console.log('🔄 Testing Solana connection...');
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana RPC: ${version['solana-core']}`);
    
    // Test pool IDs are valid PublicKeys
    console.log('🔄 Validating pool IDs...');
    const whiskeyPoolKey = new PublicKey(TEST_CONFIG.WHISKEY_SOL_POOL_ID);
    const solPoolKey = new PublicKey(TEST_CONFIG.SOL_USDC_POOL_ID);
    
    console.log(`✅ WHISKEY/SOL Pool ID valid: ${whiskeyPoolKey.toString()}`);
    console.log(`✅ SOL/USDC Pool ID valid: ${solPoolKey.toString()}`);
    
    // Test mint addresses
    console.log('🔄 Validating mint addresses...');
    const whiskeyMint = new PublicKey(TEST_CONFIG.WHISKEY_MINT);
    const usdcMint = new PublicKey(TEST_CONFIG.USDC_MINT);
    
    console.log(`✅ WHISKEY Mint valid: ${whiskeyMint.toString()}`);
    console.log(`✅ USDC Mint valid: ${usdcMint.toString()}`);
    
    console.log('✅ TEST 1 PASSED: All connections and IDs are valid');
    return true;
    
  } catch (error) {
    console.error('❌ TEST 1 FAILED:', error.message);
    return false;
  }
}

/**
 * Test 2: Raydium API Pool Fetching
 */
async function testRaydiumAPI() {
  console.log('');
  console.log('🧪 TEST 2: Raydium API Pool Fetching');
  console.log('===================================');
  
  try {
    // Test WHISKEY/SOL pool
    console.log('🔄 Fetching WHISKEY/SOL pool data...');
    const whiskeyResponse = await fetch(`https://api-v3.raydium.io/pools/info/ids?ids=${TEST_CONFIG.WHISKEY_SOL_POOL_ID}`);
    
    if (!whiskeyResponse.ok) {
      throw new Error(`WHISKEY pool API failed: ${whiskeyResponse.status}`);
    }
    
    const whiskeyData = await whiskeyResponse.json();
    const whiskeyPool = whiskeyData.data?.[0];
    
    if (whiskeyPool) {
      console.log('✅ WHISKEY/SOL pool data:', {
        id: whiskeyPool.id,
        mintA: `${whiskeyPool.mintA.symbol} (${whiskeyPool.mintA.address})`,
        mintB: `${whiskeyPool.mintB.symbol} (${whiskeyPool.mintB.address})`,
        tvl: whiskeyPool.tvl,
        price: whiskeyPool.price
      });
    } else {
      throw new Error('WHISKEY pool data not found');
    }
    
    // Test SOL/USDC pool
    console.log('🔄 Fetching SOL/USDC pool data...');
    const solResponse = await fetch(`https://api-v3.raydium.io/pools/info/ids?ids=${TEST_CONFIG.SOL_USDC_POOL_ID}`);
    
    if (!solResponse.ok) {
      throw new Error(`SOL pool API failed: ${solResponse.status}`);
    }
    
    const solData = await solResponse.json();
    const solPool = solData.data?.[0];
    
    if (solPool) {
      console.log('✅ SOL/USDC pool data:', {
        id: solPool.id,
        mintA: `${solPool.mintA.symbol} (${solPool.mintA.address})`,
        mintB: `${solPool.mintB.symbol} (${solPool.mintB.address})`,
        tvl: solPool.tvl,
        price: solPool.price
      });
    } else {
      throw new Error('SOL pool data not found');
    }
    
    console.log('✅ TEST 2 PASSED: Raydium API pool fetching works');
    return true;
    
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error.message);
    return false;
  }
}

/**
 * Test 3: Package Installation Verification
 */
async function testPackageInstallation() {
  console.log('');
  console.log('🧪 TEST 3: Package Installation Verification');
  console.log('===========================================');
  
  try {
    // Test Raydium SDK V2 import
    console.log('🔄 Testing @raydium-io/raydium-sdk-v2 import...');
    const raydiumSdk = await import('@raydium-io/raydium-sdk-v2');
    
    if (raydiumSdk.Raydium && raydiumSdk.TxVersion) {
      console.log('✅ Raydium SDK V2 imported successfully');
      console.log('  - Raydium class available');
      console.log('  - TxVersion enum available');
    } else {
      throw new Error('Raydium SDK exports not found');
    }
    
    // Test Decimal.js import
    console.log('🔄 Testing decimal.js import...');
    const Decimal = (await import('decimal.js')).default;
    
    const testDecimal = new Decimal('123.456');
    if (testDecimal.toString() === '123.456') {
      console.log('✅ Decimal.js imported and working');
    } else {
      throw new Error('Decimal.js not working correctly');
    }
    
    console.log('✅ TEST 3 PASSED: All required packages are installed');
    return true;
    
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  const results = {
    connection: false,
    api: false,
    packages: false
  };
  
  try {
    results.connection = await testConnectionAndPools();
    results.api = await testRaydiumAPI();
    results.packages = await testPackageInstallation();
    
    // Summary
    console.log('');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`Connection & Pool IDs: ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Raydium API Fetching: ${results.api ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Package Installation: ${results.packages ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL BASIC TESTS PASSED!');
      console.log('✅ Foundation is ready for Raydium SDK V2 integration.');
      console.log('');
      console.log('🚀 NEXT STEPS:');
      console.log('• Test the full integration in the browser');
      console.log('• Try minting an NFT with real WHISKEY tokens');
      console.log('• Monitor console logs during the swap process');
      console.log('• Verify Jito bundle submission works end-to-end');
    } else {
      console.log(`⚠️ ${passedTests}/${totalTests} tests passed.`);
      console.log('🔧 Fix the failed tests before proceeding.');
    }
    
  } catch (error) {
    console.error('💥 TEST SUITE CRASHED:', error);
  }
  
  console.log('');
  console.log('🏁 Basic test suite completed.');
}

// Run the tests
runAllTests().catch(console.error);
