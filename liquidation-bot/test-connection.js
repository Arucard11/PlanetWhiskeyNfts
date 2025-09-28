#!/usr/bin/env node

import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🧪 Testing basic connection...');

try {
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    console.log('✅ Connection created successfully');
    
    const programId = new PublicKey(process.env.LENDING_PROGRAM_ID);
    console.log('✅ Program ID parsed:', programId.toString());
    
    // Test basic RPC call
    const slot = await connection.getSlot();
    console.log('✅ Current slot:', slot);
    
    // Test program account exists
    const programAccount = await connection.getAccountInfo(programId);
    if (programAccount) {
        console.log('✅ Program account found');
        console.log('   Owner:', programAccount.owner.toString());
        console.log('   Executable:', programAccount.executable);
    } else {
        console.log('❌ Program account not found');
    }
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
}
