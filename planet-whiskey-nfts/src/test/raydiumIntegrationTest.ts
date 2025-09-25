/**
 * Raydium SDK V2 Integration Test
 * This file tests the complete Raydium swap integration
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { 
  initRaydiumSDK, 
  createWhiskeyToSolSwapTx, 
  createSolToUsdcSwapTx,
  testPoolFetching 
} from '../lib/raydiumSwap'
import { getSwapPools } from '../lib/raydiumApi'

// Test configuration
const TEST_CONFIG = {
  RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  WHISKEY_AMOUNT: 1000, // 1000 WHISKEY tokens for testing
  SOL_AMOUNT: 0.1, // 0.1 SOL for testing
  TEST_WALLET: Keypair.generate().publicKey, // Random test wallet
}

/**
 * Test 1: Pool Data Fetching
 */
async function testPoolDataFetching(): Promise<boolean> {
  console.log('🧪 TEST 1: Pool Data Fetching');
  console.log('============================');
  
  try {
    const connection = new Connection(TEST_CONFIG.RPC_URL);
    
    // Test pool fetching from raydiumApi.ts
    console.log('📡 Testing pool fetching via raydiumApi...');
    const { whiskeyToSol, solToUsdc } = await getSwapPools();
    
    if (whiskeyToSol && solToUsdc) {
      console.log('✅ WHISKEY/SOL pool:', {
        id: whiskeyToSol.id.toString(),
        baseMint: whiskeyToSol.baseMint.toString(),
        quoteMint: whiskeyToSol.quoteMint.toString()
      });
      
      console.log('✅ SOL/USDC pool:', {
        id: solToUsdc.id.toString(),
        baseMint: solToUsdc.baseMint.toString(),
        quoteMint: solToUsdc.quoteMint.toString()
      });
      
      // Test SDK pool fetching
      console.log('📡 Testing SDK pool fetching...');
      await testPoolFetching(connection);
      
      console.log('✅ TEST 1 PASSED: Pool data fetching works correctly');
      return true;
    } else {
      console.log('❌ TEST 1 FAILED: Could not fetch pool data');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 1 FAILED:', error);
    return false;
  }
}

/**
 * Test 2: Raydium SDK Initialization
 */
async function testSDKInitialization(): Promise<boolean> {
  console.log('');
  console.log('🧪 TEST 2: Raydium SDK Initialization');
  console.log('====================================');
  
  try {
    const connection = new Connection(TEST_CONFIG.RPC_URL);
    
    console.log('🔄 Initializing Raydium SDK...');
    const raydium = await initRaydiumSDK(connection);
    
    if (raydium && raydium.cluster === 'mainnet') {
      console.log('✅ SDK initialized successfully:', {
        cluster: raydium.cluster,
        connection: raydium.connection ? 'Connected' : 'Not connected'
      });
      
      console.log('✅ TEST 2 PASSED: SDK initialization works correctly');
      return true;
    } else {
      console.log('❌ TEST 2 FAILED: SDK not properly initialized');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error);
    return false;
  }
}

/**
 * Test 3: WHISKEY -> SOL Swap Transaction Creation
 */
async function testWhiskeyToSolSwap(): Promise<boolean> {
  console.log('');
  console.log('🧪 TEST 3: WHISKEY -> SOL Swap Transaction Creation');
  console.log('==================================================');
  
  try {
    const connection = new Connection(TEST_CONFIG.RPC_URL);
    
    console.log(`🔄 Creating WHISKEY->SOL swap for ${TEST_CONFIG.WHISKEY_AMOUNT} WHISKEY...`);
    const swapTransactions = await createWhiskeyToSolSwapTx(
      connection,
      TEST_CONFIG.TEST_WALLET,
      TEST_CONFIG.WHISKEY_AMOUNT
    );
    
    if (swapTransactions && swapTransactions.length > 0) {
      console.log('✅ Swap transactions created:', {
        count: swapTransactions.length,
        firstTxInstructions: swapTransactions[0].instructions?.length || 0
      });
      
      console.log('✅ TEST 3 PASSED: WHISKEY->SOL swap transaction creation works');
      return true;
    } else {
      console.log('❌ TEST 3 FAILED: No swap transactions created');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error);
    return false;
  }
}

/**
 * Test 4: SOL -> USDC Swap Transaction Creation
 */
async function testSolToUsdcSwap(): Promise<boolean> {
  console.log('');
  console.log('🧪 TEST 4: SOL -> USDC Swap Transaction Creation');
  console.log('===============================================');
  
  try {
    const connection = new Connection(TEST_CONFIG.RPC_URL);
    
    console.log(`🔄 Creating SOL->USDC swap for ${TEST_CONFIG.SOL_AMOUNT} SOL...`);
    const swapTransactions = await createSolToUsdcSwapTx(
      connection,
      TEST_CONFIG.TEST_WALLET,
      TEST_CONFIG.SOL_AMOUNT
    );
    
    if (swapTransactions && swapTransactions.length > 0) {
      console.log('✅ Swap transactions created:', {
        count: swapTransactions.length,
        firstTxInstructions: swapTransactions[0].instructions?.length || 0
      });
      
      console.log('✅ TEST 4 PASSED: SOL->USDC swap transaction creation works');
      return true;
    } else {
      console.log('❌ TEST 4 FAILED: No swap transactions created');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 4 FAILED:', error);
    return false;
  }
}

/**
 * Test 5: Integration with NftCollectionCard Functions
 */
async function testNftCardIntegration(): Promise<boolean> {
  console.log('');
  console.log('🧪 TEST 5: NftCollectionCard Integration');
  console.log('=======================================');
  
  try {
    // Import the swap functions from NftCollectionCard (indirectly)
    const connection = new Connection(TEST_CONFIG.RPC_URL);
    
    console.log('🔄 Testing integration flow...');
    
    // Simulate the swap creation process
    console.log('1. Creating WHISKEY->SOL swap...');
    const whiskeySwap = await createWhiskeyToSolSwapTx(
      connection,
      TEST_CONFIG.TEST_WALLET,
      TEST_CONFIG.WHISKEY_AMOUNT
    );
    
    console.log('2. Creating SOL->USDC swap...');
    const solSwap = await createSolToUsdcSwapTx(
      connection,
      TEST_CONFIG.TEST_WALLET,
      TEST_CONFIG.SOL_AMOUNT
    );
    
    if (whiskeySwap.length > 0 && solSwap.length > 0) {
      console.log('✅ Integration flow works:', {
        whiskeySwapTxs: whiskeySwap.length,
        solSwapTxs: solSwap.length,
        totalTransactions: whiskeySwap.length + solSwap.length
      });
      
      console.log('✅ TEST 5 PASSED: NftCollectionCard integration works');
      return true;
    } else {
      console.log('❌ TEST 5 FAILED: Integration flow incomplete');
      return false;
    }
    
  } catch (error) {
    console.error('❌ TEST 5 FAILED:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 RAYDIUM SDK V2 INTEGRATION TEST SUITE');
  console.log('========================================');
  console.log('');
  console.log('Test Configuration:');
  console.log(`• RPC URL: ${TEST_CONFIG.RPC_URL}`);
  console.log(`• Test WHISKEY Amount: ${TEST_CONFIG.WHISKEY_AMOUNT}`);
  console.log(`• Test SOL Amount: ${TEST_CONFIG.SOL_AMOUNT}`);
  console.log(`• Test Wallet: ${TEST_CONFIG.TEST_WALLET.toString()}`);
  console.log('');
  
  const results = {
    poolFetching: false,
    sdkInit: false,
    whiskeySwap: false,
    solSwap: false,
    integration: false
  };
  
  try {
    // Run all tests
    results.poolFetching = await testPoolDataFetching();
    results.sdkInit = await testSDKInitialization();
    results.whiskeySwap = await testWhiskeyToSolSwap();
    results.solSwap = await testSolToUsdcSwap();
    results.integration = await testNftCardIntegration();
    
    // Summary
    console.log('');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('=======================');
    console.log(`Pool Data Fetching: ${results.poolFetching ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`SDK Initialization: ${results.sdkInit ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`WHISKEY->SOL Swap: ${results.whiskeySwap ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`SOL->USDC Swap: ${results.solSwap ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`NftCard Integration: ${results.integration ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Raydium SDK V2 integration is working correctly.');
      console.log('✅ Ready for production use in the NFT minting flow.');
    } else {
      console.log(`⚠️ ${passedTests}/${totalTests} tests passed. Review failed tests above.`);
      console.log('🔧 Some issues need to be addressed before production use.');
    }
    
  } catch (error) {
    console.error('💥 TEST SUITE CRASHED:', error);
    console.log('🔧 Critical issues need to be resolved.');
  }
  
  console.log('');
  console.log('🏁 Test suite completed.');
}

// Export for use in other files
export {
  runAllTests,
  testPoolDataFetching,
  testSDKInitialization,
  testWhiskeyToSolSwap,
  testSolToUsdcSwap,
  testNftCardIntegration
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}
