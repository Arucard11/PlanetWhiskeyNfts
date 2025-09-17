#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

console.log('🔍 MAINNET CONFIGURATION TEST');
console.log('================================');

// Test environment variables
const requiredVars = [
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_SOLANA_CLUSTER', 
  'NEXT_PUBLIC_USDC_MINT',
  'NEXT_PUBLIC_WHISKEY_MINT',
  'NEXT_PUBLIC_WHISKEY_PROGRAM_ID',
  'NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID', 
  'NEXT_PUBLIC_LENDING_PROGRAM_ID',
  'NEXT_PUBLIC_ADMIN_WALLET',
  'NEXT_PUBLIC_TREASURY_WALLET'
];

let allGood = true;

console.log('\n📋 Environment Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`❌ ${varName}: MISSING`);
    allGood = false;
  }
});

// Test mainnet-specific values
console.log('\n🌐 Mainnet Verification:');

// Check RPC URL
const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
if (rpcUrl && rpcUrl.includes('mainnet')) {
  console.log('✅ RPC URL points to mainnet');
} else if (rpcUrl && rpcUrl.includes('devnet')) {
  console.log('❌ RPC URL still points to devnet!');
  allGood = false;
} else {
  console.log('⚠️  RPC URL format unclear');
}

// Check USDC mint (mainnet)
const usdcMint = process.env.NEXT_PUBLIC_USDC_MINT;
if (usdcMint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
  console.log('✅ USDC mint is mainnet');
} else if (usdcMint === '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU') {
  console.log('❌ USDC mint is still devnet!');
  allGood = false;
} else {
  console.log('⚠️  USDC mint is unknown');
}

// Check WHISKEY mint (mainnet)
const whiskeyMint = process.env.NEXT_PUBLIC_WHISKEY_MINT;
if (whiskeyMint === '9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph') {
  console.log('✅ WHISKEY mint is mainnet');
} else if (whiskeyMint === '6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu') {
  console.log('❌ WHISKEY mint is still devnet!');
  allGood = false;
} else {
  console.log('⚠️  WHISKEY mint is unknown');
}

// Check cluster setting
const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
if (cluster === 'mainnet') {
  console.log('✅ Cluster is set to mainnet');
} else {
  console.log(`⚠️  Cluster is set to: ${cluster || 'undefined'}`);
}

console.log('\n🏁 Final Result:');
if (allGood) {
  console.log('✅ ALL CHECKS PASSED - Ready for mainnet deployment!');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED - Fix issues before deployment!');
  process.exit(1);
}
