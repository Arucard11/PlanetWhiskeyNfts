#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Expected program addresses
const EXPECTED_ADDRESSES = {
    lending: 'HegC6oTgMNyHW1g1kDSP8bWe22uCdoQhBxKXfu3joXpK',
    marketplace: 'BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT',
    whiskey: '3sNM6w7GBRs41o4a9X6RuECLR5ZZUsADvxpsZXM1kBU8'
};

function checkIDLFiles() {
    console.log('🔍 VERIFYING IDL FILES AND ADDRESSES');
    console.log('=' .repeat(50));
    
    const idlDir = '../planet-whiskey-nfts/src/lib/idl';
    const programs = ['lendingprogram', 'marketplaceprogram', 'whiskeyprogram'];
    
    let allCorrect = true;
    
    programs.forEach(program => {
        console.log(`\n📋 Checking ${program}:`);
        
        // Check JSON IDL
        const jsonPath = path.join(idlDir, `${program}.json`);
        const tsPath = path.join(idlDir, `${program}.ts`);
        
        try {
            // Check JSON file
            const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const jsonAddress = jsonContent.address;
            
            // Check TypeScript file
            const tsContent = fs.readFileSync(tsPath, 'utf8');
            const tsAddressMatch = tsContent.match(/"address":\s*"([^"]+)"/);
            const tsAddress = tsAddressMatch ? tsAddressMatch[1] : 'NOT_FOUND';
            
            // Determine expected address
            let expectedAddress;
            if (program === 'lendingprogram') expectedAddress = EXPECTED_ADDRESSES.lending;
            else if (program === 'marketplaceprogram') expectedAddress = EXPECTED_ADDRESSES.marketplace;
            else if (program === 'whiskeyprogram') expectedAddress = EXPECTED_ADDRESSES.whiskey;
            
            console.log(`  JSON Address: ${jsonAddress}`);
            console.log(`  TS Address:   ${tsAddress}`);
            console.log(`  Expected:     ${expectedAddress}`);
            
            if (jsonAddress === expectedAddress && tsAddress === expectedAddress) {
                console.log('  Status:       ✅ CORRECT');
            } else {
                console.log('  Status:       ❌ INCORRECT');
                allCorrect = false;
            }
            
        } catch (error) {
            console.log(`  Error:        ❌ ${error.message}`);
            allCorrect = false;
        }
    });
    
    console.log('\n' + '=' .repeat(50));
    if (allCorrect) {
        console.log('🎉 ALL ADDRESSES ARE CORRECT!');
    } else {
        console.log('❌ SOME ADDRESSES NEED FIXING!');
    }
    
    return allCorrect;
}

function checkEnvironmentFiles() {
    console.log('\n🌍 CHECKING ENVIRONMENT FILES');
    console.log('=' .repeat(50));
    
    const envFiles = [
        '../planet-whiskey-nfts/env.mainnet',
        '../planet-whiskey-nfts/env.example'
    ];
    
    envFiles.forEach(envFile => {
        console.log(`\n📄 Checking ${path.basename(envFile)}:`);
        
        try {
            const content = fs.readFileSync(envFile, 'utf8');
            
            const lendingMatch = content.match(/NEXT_PUBLIC_LENDING_PROGRAM_ID=([^\n\r]+)/);
            const marketplaceMatch = content.match(/NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=([^\n\r]+)/);
            const whiskeyMatch = content.match(/NEXT_PUBLIC_WHISKEY_PROGRAM_ID=([^\n\r]+)/);
            
            const lending = lendingMatch ? lendingMatch[1].trim() : 'NOT_FOUND';
            const marketplace = marketplaceMatch ? marketplaceMatch[1].trim() : 'NOT_FOUND';
            const whiskey = whiskeyMatch ? whiskeyMatch[1].trim() : 'NOT_FOUND';
            
            console.log(`  Lending:     ${lending} ${lending === EXPECTED_ADDRESSES.lending ? '✅' : '❌'}`);
            console.log(`  Marketplace: ${marketplace} ${marketplace === EXPECTED_ADDRESSES.marketplace ? '✅' : '❌'}`);
            console.log(`  Whiskey:     ${whiskey} ${whiskey === EXPECTED_ADDRESSES.whiskey ? '✅' : '❌'}`);
            
        } catch (error) {
            console.log(`  Error:       ❌ ${error.message}`);
        }
    });
}

function main() {
    const idlsCorrect = checkIDLFiles();
    checkEnvironmentFiles();
    
    console.log('\n🚀 VERIFICATION COMPLETE!');
    
    if (idlsCorrect) {
        console.log('\n✅ Ready to deploy frontend!');
    } else {
        console.log('\n❌ Please fix the addresses before deploying!');
    }
}

main();
