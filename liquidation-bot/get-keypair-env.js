#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the keypair file and output it as an environment variable
try {
    const keypairPath = path.join(__dirname, 'keypairs/mainnet-liquidation-keypair.json');
    
    if (!fs.existsSync(keypairPath)) {
        console.error('❌ Keypair file not found at:', keypairPath);
        process.exit(1);
    }
    
    const keypair = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
    
    console.log('🔑 KEYPAIR environment variable:');
    console.log('KEYPAIR=' + JSON.stringify(keypair));
    console.log('');
    console.log('📋 Copy this line and add it to your Render environment variables');
    
} catch (error) {
    console.error('❌ Error reading keypair:', error.message);
    process.exit(1);
}
