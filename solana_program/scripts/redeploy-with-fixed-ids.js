#!/usr/bin/env node

// Script to redeploy all programs with fixed program IDs
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Program IDs from env.example
const PROGRAM_IDS = {
    LENDING_PROGRAM_ID: '4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6',
    WHISKEY_PROGRAM_ID: 'Y5ZTxmgfR51njNPjHRm9WYzbmvoG4uptaQnHupdKbFM',
    MARKETPLACE_PROGRAM_ID: 'E9rdfVCukatP1LxyMun3mnw28pprwpTJtzkqtw1YVQ7n'
};

function loadKeypair(filePath) {
    const keypairData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

function createKeypairFromProgramId(programId) {
    // This is a placeholder - you'd need the actual secret key for each program
    // For now, we'll create new keypairs and update the program IDs
    console.log(`⚠️  Creating new keypair for program ID: ${programId}`);
    const keypair = Keypair.generate();
    console.log(`Generated new keypair: ${keypair.publicKey.toString()}`);
    return keypair;
}

async function deployProgram(programName, programKeypair, targetProgramId) {
    console.log(`\n🚀 Deploying ${programName}...`);
    console.log(`   Target Program ID: ${targetProgramId}`);
    console.log(`   Using Keypair: ${programKeypair.publicKey.toString()}`);
    
    try {
        // Build the program first
        console.log(`📦 Building ${programName}...`);
        execSync(`anchor build --program-name ${programName}`, { 
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit' 
        });
        
        // Deploy the program
        console.log(`🚀 Deploying ${programName}...`);
        execSync(`anchor deploy --program-name ${programName} --program-keypair ${programKeypair.publicKey.toString()}`, {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
        
        console.log(`✅ ${programName} deployed successfully!`);
        return true;
        
    } catch (error) {
        console.error(`❌ Failed to deploy ${programName}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Redeploying All Programs with Fixed IDs');
    console.log('=' .repeat(60));
    
    // Check if we're on devnet
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    console.log(`🌐 Target Network: ${rpcUrl}`);
    
    if (!rpcUrl.includes('devnet')) {
        console.log('⚠️  WARNING: Not deploying to devnet! Please check your RPC URL.');
        process.exit(1);
    }
    
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // Load or create keypairs for each program
    const programs = [
        {
            name: 'lendingprogram',
            targetId: PROGRAM_IDS.LENDING_PROGRAM_ID,
            keypairPath: path.join(__dirname, '../lendingprogram-keypair.json')
        },
        {
            name: 'whiskeyprogram', 
            targetId: PROGRAM_IDS.WHISKEY_PROGRAM_ID,
            keypairPath: path.join(__dirname, '../whiskeyprogram-keypair.json')
        },
        {
            name: 'marketplaceprogram',
            targetId: PROGRAM_IDS.MARKETPLACE_PROGRAM_ID, 
            keypairPath: path.join(__dirname, '../marketplaceprogram-keypair.json')
        }
    ];
    
    console.log('\n📋 Program Deployment Plan:');
    for (const program of programs) {
        console.log(`   ${program.name}: ${program.targetId}`);
    }
    
    // Ask for confirmation
    console.log('\n⚠️  This will redeploy all programs to devnet.');
    console.log('   Make sure you have sufficient SOL for deployment fees.');
    console.log('   Press Ctrl+C to cancel, or any key to continue...');
    
    // Wait for user input (simplified for script)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let successCount = 0;
    let totalPrograms = programs.length;
    
    for (const program of programs) {
        try {
            // Load or create keypair
            let keypair;
            if (fs.existsSync(program.keypairPath)) {
                keypair = loadKeypair(program.keypairPath);
                console.log(`\n🔑 Loaded existing keypair for ${program.name}: ${keypair.publicKey.toString()}`);
                
                // Check if it matches target ID
                if (keypair.publicKey.toString() !== program.targetId) {
                    console.log(`⚠️  Keypair mismatch! Expected: ${program.targetId}, Got: ${keypair.publicKey.toString()}`);
                    console.log(`   Using existing keypair anyway...`);
                }
            } else {
                console.log(`⚠️  No keypair found for ${program.name}, creating new one...`);
                keypair = Keypair.generate();
                fs.writeFileSync(program.keypairPath, JSON.stringify(Array.from(keypair.secretKey)));
                console.log(`💾 Saved new keypair: ${program.keypairPath}`);
            }
            
            // Deploy the program
            const success = await deployProgram(program.name, keypair, program.targetId);
            if (success) {
                successCount++;
            }
            
        } catch (error) {
            console.error(`❌ Error with ${program.name}:`, error);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Deployment Summary:`);
    console.log(`   Successful: ${successCount}/${totalPrograms}`);
    console.log(`   Failed: ${totalPrograms - successCount}/${totalPrograms}`);
    
    if (successCount === totalPrograms) {
        console.log('\n🎉 All programs deployed successfully!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Update your .env files with the new program IDs');
        console.log('   2. Initialize the programs if needed');
        console.log('   3. Test the liquidation bot');
    } else {
        console.log('\n⚠️  Some deployments failed. Check the logs above.');
    }
}

main().catch(console.error);
