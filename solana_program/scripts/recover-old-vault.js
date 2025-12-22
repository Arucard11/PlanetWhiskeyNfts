#!/usr/bin/env node

/**
 * RECOVER USDC FROM OLD CAPITAL VAULT
 * 
 * Since the old lending program is closed, we need to use the PDA seeds
 * to sign a transfer instruction directly.
 */

const { Connection, PublicKey, Transaction, SystemProgram, Keypair } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, getAccount, createTransferInstruction, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90';
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const OLD_LENDING_PROGRAM_ID = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');
const OLD_VAULT = new PublicKey('DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');

async function main() {
    console.log('💰 RECOVERING USDC FROM OLD VAULT\n');
    
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync('./mainnet-admin-keypair.json', 'utf-8')))
    );
    
    console.log(`👤 Admin: ${adminKeypair.publicKey.toString()}`);
    
    // Check old vault balance
    try {
        const vaultAccount = await getAccount(connection, OLD_VAULT);
        console.log(`\n📊 Old Vault Info:`);
        console.log(`  Address: ${OLD_VAULT.toString()}`);
        console.log(`  Owner (PDA): ${vaultAccount.owner.toString()}`);
        console.log(`  Balance: ${(Number(vaultAccount.amount) / 1_000_000).toFixed(2)} USDC`);
        
        if (Number(vaultAccount.amount) === 0) {
            console.log('\n❌ Vault is empty, nothing to recover');
            return;
        }
        
        // Derive the old Global Market PDA
        const [oldGlobalMarketPda, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from('global_market')],
            OLD_LENDING_PROGRAM_ID
        );
        
        console.log(`\n🔑 Old Global Market PDA: ${oldGlobalMarketPda.toString()}`);
        console.log(`  Bump: ${bump}`);
        console.log(`  Matches vault owner: ${oldGlobalMarketPda.toString() === vaultAccount.owner.toString()}`);
        
        if (oldGlobalMarketPda.toString() !== vaultAccount.owner.toString()) {
            console.log('\n❌ PDA mismatch - cannot recover');
            return;
        }
        
        // Get destination token account (treasury)
        const destinationTokenAccount = await getAssociatedTokenAddress(
            USDC_MINT,
            TREASURY_WALLET
        );
        
        console.log(`\n🎯 Destination: ${destinationTokenAccount.toString()}`);
        
        // Check if destination account exists
        let destinationAccountInfo;
        try {
            destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
        } catch (e) {
            console.log('⚠️  Destination token account does not exist, will be created');
        }
        
        console.log('\n⚠️  WARNING: Since the program is closed, we cannot use it to sign.');
        console.log('   However, we can attempt to use the PDA seeds directly.');
        console.log('   This requires creating a transaction that uses the PDA as a signer.');
        console.log('\n   Attempting recovery...\n');
        
        // Create transfer instruction with PDA signer
        const transferInstruction = createTransferInstruction(
            OLD_VAULT,                    // source
            destinationTokenAccount,       // destination
            oldGlobalMarketPda,           // authority (PDA)
            Number(vaultAccount.amount),  // amount
            [],                           // multiSigners (empty, using PDA)
            TOKEN_PROGRAM_ID
        );
        
        // Build transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = adminKeypair.publicKey;
        
        // Sign with admin (for fee payer)
        transaction.sign(adminKeypair);
        
        // Add PDA signature using seeds
        // Note: This won't work because the program is closed and can't validate the signature
        // We need to use invoke_signed which requires the program to exist
        
        console.log('❌ Cannot recover funds automatically because:');
        console.log('   1. The program is closed');
        console.log('   2. PDA signatures require the program to exist for validation');
        console.log('   3. The SPL Token program will reject the signature');
        console.log('\n💡 SOLUTION:');
        console.log('   The funds are effectively locked. However, you have a few options:');
        console.log('   1. Redeploy the old program temporarily to recover funds');
        console.log('   2. Contact Solana Foundation for assistance (if significant amount)');
        console.log('   3. Accept the loss (if small amount)');
        console.log('\n   The 372.41 USDC will remain in the old vault until recovered.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);











