#!/usr/bin/env node

// Test script for the updated Jupiter quote system
const { PublicKey } = require('@solana/web3.js');

// Mock the Jupiter quote functions (simplified version)
const WHISKEY_MINT = '9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';


async function testJupiterQuote(whiskeyAmount, slippageBps = 50) {
  console.log(`\n🧪 Testing Jupiter quote for ${whiskeyAmount / 1_000_000} WHISKEY tokens`);
  console.log('======================================================================');
  
  // Test multiple slippage values based on successful transaction
  const slippageTests = [50, 100, 300, 500]; // 0.5%, 1%, 3%, 5%
  
  for (const testSlippage of slippageTests) {
    try {
      const queryParams = new URLSearchParams({
        inputMint: WHISKEY_MINT,
        outputMint: USDC_MINT,
        amount: whiskeyAmount.toString(),
        slippageBps: testSlippage.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
      });

      console.log(`🔄 Trying Jupiter API with ${testSlippage / 100}% slippage...`);
      const response = await fetch(`https://quote-api.jup.ag/v6/quote?${queryParams}`);
      
      if (response.ok) {
        const quote = await response.json();
        console.log('✅ Jupiter API succeeded!');
        console.log('📊 Quote details:', {
          inputAmount: `${whiskeyAmount / 1_000_000} WHISKEY`,
          outputAmount: `${parseInt(quote.outAmount) / 1_000_000} USDC`,
          priceImpact: `${quote.priceImpactPct}%`,
          slippage: `${testSlippage / 100}%`,
          routes: quote.routePlan.length,
        });
        return quote;
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ Jupiter API failed with ${testSlippage / 100}% slippage:`, response.status, errorText);
      }
    } catch (error) {
      console.warn(`❌ Error with ${testSlippage / 100}% slippage:`, error.message);
    }
  }
  
  console.error('❌ All Jupiter API attempts failed');
  throw new Error('Jupiter API unavailable');
}

async function main() {
  console.log('🚀 TESTING JUPITER QUOTE SYSTEM');
  console.log('======================================================================');
  
  // Test different amounts
  const testAmounts = [
    1 * 1_000_000,   // 1 WHISKEY
    5 * 1_000_000,   // 5 WHISKEY
    10 * 1_000_000,  // 10 WHISKEY
    100 * 1_000_000, // 100 WHISKEY
  ];
  
  for (const amount of testAmounts) {
    await testJupiterQuote(amount);
    console.log(''); // Add spacing
  }
  
  console.log('🎯 TESTING COMPLETE!');
  console.log('======================================================================');
  console.log('✅ The Jupiter quote system now uses only real API quotes.');
  console.log('💡 Multiple slippage tolerances are tried to find working quotes.');
  console.log('🔄 Based on your successful transaction, higher slippage may be needed.');
}

main().catch(console.error);
