#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

console.log('🔍 MAINNET PROGRAM ID VERIFICATION');
console.log('===================================');

// Expected mainnet program IDs from keypairs
const expectedProgramIds = {
  WHISKEY_PROGRAM: 'HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA',
  MARKETPLACE_PROGRAM: '5B9BKW8Az3dVhd6sQH4WHEoefiFYneNWFnxsZVf4rw7V',
  LENDING_PROGRAM: 'Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3'
};

// Check environment variables
const envProgramIds = {
  WHISKEY_PROGRAM: process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID,
  MARKETPLACE_PROGRAM: process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID,
  LENDING_PROGRAM: process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID
};

console.log('\n📋 Environment Variables Check:');
let allEnvGood = true;
Object.keys(expectedProgramIds).forEach(program => {
  const expected = expectedProgramIds[program];
  const actual = envProgramIds[program];
  
  if (actual === expected) {
    console.log(`✅ ${program}: ${actual}`);
  } else {
    console.log(`❌ ${program}: Expected ${expected}, got ${actual || 'MISSING'}`);
    allEnvGood = false;
  }
});

// Check Rust program declare_id! statements
console.log('\n🦀 Rust Programs Check:');
const fs = require('fs');
const path = require('path');

const rustFiles = [
  { 
    name: 'WHISKEY_PROGRAM', 
    path: '../../solana_program/programs/solana_program/src/lib.rs',
    expected: expectedProgramIds.WHISKEY_PROGRAM
  },
  { 
    name: 'MARKETPLACE_PROGRAM', 
    path: '../../solana_program/programs/marketplaceprogram/src/lib.rs',
    expected: expectedProgramIds.MARKETPLACE_PROGRAM
  },
  { 
    name: 'LENDING_PROGRAM', 
    path: '../../solana_program/programs/lendingprogram/src/lib.rs',
    expected: expectedProgramIds.LENDING_PROGRAM
  }
];

let allRustGood = true;
rustFiles.forEach(file => {
  try {
    const filePath = path.resolve(__dirname, file.path);
    const content = fs.readFileSync(filePath, 'utf8');
    const declareMatch = content.match(/declare_id!\("([^"]+)"\)/);
    
    if (declareMatch && declareMatch[1] === file.expected) {
      console.log(`✅ ${file.name}: ${declareMatch[1]}`);
    } else {
      console.log(`❌ ${file.name}: Expected ${file.expected}, got ${declareMatch ? declareMatch[1] : 'NOT_FOUND'}`);
      allRustGood = false;
    }
  } catch (error) {
    console.log(`❌ ${file.name}: Error reading file - ${error.message}`);
    allRustGood = false;
  }
});

// Check Anchor.toml
console.log('\n⚓ Anchor.toml Check:');
let anchorGood = true;
try {
  const anchorPath = path.resolve(__dirname, '../solana_program/Anchor.toml');
  const anchorContent = fs.readFileSync(anchorPath, 'utf8');
  
  const programs = {
    whiskeyprogram: expectedProgramIds.WHISKEY_PROGRAM,
    marketplaceprogram: expectedProgramIds.MARKETPLACE_PROGRAM,
    lendingprogram: expectedProgramIds.LENDING_PROGRAM
  };
  
  Object.keys(programs).forEach(program => {
    const regex = new RegExp(`${program}\\s*=\\s*"([^"]+)"`);
    const match = anchorContent.match(regex);
    
    if (match && match[1] === programs[program]) {
      console.log(`✅ ${program}: ${match[1]}`);
    } else {
      console.log(`❌ ${program}: Expected ${programs[program]}, got ${match ? match[1] : 'NOT_FOUND'}`);
      anchorGood = false;
    }
  });
} catch (error) {
  console.log(`❌ Anchor.toml: Error reading file - ${error.message}`);
  anchorGood = false;
}

console.log('\n🏁 Final Result:');
if (allEnvGood && allRustGood && anchorGood) {
  console.log('✅ ALL PROGRAM IDS ARE CORRECTLY CONFIGURED FOR MAINNET!');
  process.exit(0);
} else {
  console.log('❌ SOME PROGRAM IDS ARE INCORRECT - Fix before deployment!');
  process.exit(1);
}
