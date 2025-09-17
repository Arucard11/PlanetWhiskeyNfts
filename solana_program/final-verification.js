#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Expected addresses
const EXPECTED = {
    programs: {
        lending: 'HegC6oTgMNyHW1g1kDSP8bWe22uCdoQhBxKXfu3joXpK',
        marketplace: 'BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT',
        whiskey: '3sNM6w7GBRs41o4a9X6RuECLR5ZZUsADvxpsZXM1kBU8'
    },
    pdas: {
        globalMarket: '2fEq18DJ6FedNs1d3Sc8TtusoAJTtX8G7vbdAEQQ4fR8',
        collectionRegistry: 'Cd7mLCKsAPEN8y4riN4e1jtYZZGTT1ky5DE8CRxR8oEc',
        capitalVault: '6tCuvX7wx47jT9wWMxRF4yBC8RsnW3VwbMunThoUH9kg',
        lendingPoolConfig: 'sg1dGLL1ZpYeM4d2NYtukWKB84nm7riNHGy6V9L8er9',
        whiskeyVaultV2: 'hzojcKSjsCasLRZUMwjNwsxfTt7EDYjDXtkh91L3AQy',
        usdcVaultV2: '6SwUbJS4ao1LH9q2DNfN56gNp2WpgjJRiQnRaChGNnni'
    }
};

function checkEnvironmentFile(filePath) {
    console.log(`\n📄 Checking ${path.basename(filePath)}:`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let allCorrect = true;
        
        // Check program IDs
        const programChecks = {
            'NEXT_PUBLIC_LENDING_PROGRAM_ID': EXPECTED.programs.lending,
            'NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID': EXPECTED.programs.marketplace,
            'NEXT_PUBLIC_WHISKEY_PROGRAM_ID': EXPECTED.programs.whiskey
        };
        
        console.log('  📋 Program IDs:');
        Object.entries(programChecks).forEach(([envVar, expected]) => {
            const regex = new RegExp(`${envVar}=([^\\n\\r]+)`);
            const match = content.match(regex);
            const actual = match ? match[1].trim() : 'NOT_FOUND';
            const isCorrect = actual === expected;
            console.log(`    ${envVar.replace('NEXT_PUBLIC_', '').replace('_PROGRAM_ID', '').padEnd(12)}: ${isCorrect ? '✅' : '❌'} ${actual}`);
            if (!isCorrect) allCorrect = false;
        });
        
        // Check PDA addresses
        const pdaChecks = {
            'NEXT_PUBLIC_GLOBAL_MARKET_PDA': EXPECTED.pdas.globalMarket,
            'NEXT_PUBLIC_COLLECTION_REGISTRY_PDA': EXPECTED.pdas.collectionRegistry,
            'NEXT_PUBLIC_CAPITAL_VAULT_PDA': EXPECTED.pdas.capitalVault,
            'NEXT_PUBLIC_LENDING_POOL_CONFIG_PDA': EXPECTED.pdas.lendingPoolConfig,
            'NEXT_PUBLIC_WHISKEY_VAULT_V2_PDA': EXPECTED.pdas.whiskeyVaultV2,
            'NEXT_PUBLIC_USDC_VAULT_V2_PDA': EXPECTED.pdas.usdcVaultV2
        };
        
        console.log('  🏛️  PDA Addresses:');
        Object.entries(pdaChecks).forEach(([envVar, expected]) => {
            const regex = new RegExp(`${envVar}=([^\\n\\r]+)`);
            const match = content.match(regex);
            const actual = match ? match[1].trim() : 'NOT_FOUND';
            const isCorrect = actual === expected;
            const displayName = envVar.replace('NEXT_PUBLIC_', '').replace('_PDA', '').replace('_', ' ');
            console.log(`    ${displayName.padEnd(20)}: ${isCorrect ? '✅' : '❌'} ${actual}`);
            if (!isCorrect) allCorrect = false;
        });
        
        return allCorrect;
        
    } catch (error) {
        console.log(`  ❌ Error reading file: ${error.message}`);
        return false;
    }
}

function checkIDLFiles() {
    console.log('\n🔍 CHECKING IDL FILES:');
    
    const idlDir = '../planet-whiskey-nfts/src/lib/idl';
    const programs = [
        { name: 'lendingprogram', expected: EXPECTED.programs.lending },
        { name: 'marketplaceprogram', expected: EXPECTED.programs.marketplace },
        { name: 'whiskeyprogram', expected: EXPECTED.programs.whiskey }
    ];
    
    let allCorrect = true;
    
    programs.forEach(({ name, expected }) => {
        console.log(`\n  📋 ${name}:`);
        
        try {
            // Check JSON
            const jsonPath = path.join(idlDir, `${name}.json`);
            const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const jsonAddress = jsonContent.address;
            
            // Check TypeScript
            const tsPath = path.join(idlDir, `${name}.ts`);
            const tsContent = fs.readFileSync(tsPath, 'utf8');
            const tsMatch = tsContent.match(/"address":\s*"([^"]+)"/);
            const tsAddress = tsMatch ? tsMatch[1] : 'NOT_FOUND';
            
            const jsonCorrect = jsonAddress === expected;
            const tsCorrect = tsAddress === expected;
            
            console.log(`    JSON: ${jsonCorrect ? '✅' : '❌'} ${jsonAddress}`);
            console.log(`    TS:   ${tsCorrect ? '✅' : '❌'} ${tsAddress}`);
            
            if (!jsonCorrect || !tsCorrect) allCorrect = false;
            
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}`);
            allCorrect = false;
        }
    });
    
    return allCorrect;
}

function main() {
    console.log('🔍 FINAL VERIFICATION - ALL ADDRESSES & FILES');
    console.log('=' .repeat(60));
    
    // Check IDL files
    const idlsCorrect = checkIDLFiles();
    
    // Check environment files
    const envFiles = [
        '../planet-whiskey-nfts/env.mainnet',
        '../planet-whiskey-nfts/env.example'
    ];
    
    console.log('\n🌍 CHECKING ENVIRONMENT FILES:');
    let allEnvCorrect = true;
    envFiles.forEach(file => {
        const fileCorrect = checkEnvironmentFile(file);
        if (!fileCorrect) allEnvCorrect = false;
    });
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL SUMMARY:');
    console.log(`IDL Files:        ${idlsCorrect ? '✅ ALL CORRECT' : '❌ NEEDS FIXING'}`);
    console.log(`Environment Files: ${allEnvCorrect ? '✅ ALL CORRECT' : '❌ NEEDS FIXING'}`);
    
    if (idlsCorrect && allEnvCorrect) {
        console.log('\n🎉 PERFECT! ALL FILES ARE READY FOR MAINNET! 🎉');
        console.log('\n🚀 You can now:');
        console.log('   1. Deploy your frontend');
        console.log('   2. Add collections to registry');
        console.log('   3. Fund the capital vault');
        console.log('   4. Start accepting users!');
    } else {
        console.log('\n❌ Please fix the issues above before deploying!');
    }
}

main();
