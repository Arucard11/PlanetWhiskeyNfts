const { Connection, PublicKey, Keypair, TransactionInstruction, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

// Constants
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const LENDING_PROGRAM_ID = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function log(message, color = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
}

// Instruction discriminators (from IDL)
const CLOSE_COLLECTION_REGISTRY_DISCRIMINATOR = Buffer.from([107, 212, 98, 37, 246, 112, 213, 87]);
const INITIALIZE_COLLECTION_REGISTRY_DISCRIMINATOR = Buffer.from([67, 46, 195, 231, 11, 87, 70, 204]);

async function main() {
    try {
        // Setup connection
        log('🔗 Connecting to Solana mainnet...', colors.cyan);
        const connection = new Connection(RPC_URL, 'confirmed');

        // Load admin keypair
        log('🔑 Loading admin keypair...', colors.cyan);
        const adminKeypairPath = path.join(__dirname, 'mainnet-admin-keypair.json');
        const adminKeypairData = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
        const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
        
        log(`Admin wallet: ${adminKeypair.publicKey.toString()}`, colors.yellow);

        // Derive collection registry PDA
        const [collectionRegistryPda, registryBump] = PublicKey.findProgramAddressSync(
            [Buffer.from('collection_registry')],
            LENDING_PROGRAM_ID
        );

        log(`\n📍 Collection Registry PDA: ${collectionRegistryPda.toString()}`, colors.magenta);
        log(`🏷️  Registry Bump: ${registryBump}`, colors.yellow);

        // Check if registry exists
        log('\n🔍 Checking current registry status...', colors.cyan);
        const registryAccount = await connection.getAccountInfo(collectionRegistryPda);
        
        if (!registryAccount) {
            log('❌ Collection registry does not exist', colors.red);
            log('✅ Proceeding directly to initialization...', colors.green);
        } else {
            log('✅ Collection registry exists', colors.green);
            log(`📊 Registry account size: ${registryAccount.data.length} bytes`, colors.yellow);
            log(`👤 Registry owner: ${registryAccount.owner.toString()}`, colors.yellow);
            
            // Step 1: Close the existing registry
            log('\n🗑️  STEP 1: Closing existing collection registry...', colors.red);
            
            // Create close instruction manually
            const closeInstruction = new TransactionInstruction({
                keys: [
                    { pubkey: collectionRegistryPda, isSigner: false, isWritable: true },
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                ],
                programId: LENDING_PROGRAM_ID,
                data: CLOSE_COLLECTION_REGISTRY_DISCRIMINATOR,
            });

            const closeTransaction = new Transaction();
            closeTransaction.add(closeInstruction);
            closeTransaction.feePayer = adminKeypair.publicKey;
            
            const { blockhash } = await connection.getLatestBlockhash();
            closeTransaction.recentBlockhash = blockhash;
            
            // Sign and send the close transaction
            closeTransaction.sign(adminKeypair);
            
            try {
                const closeSignature = await connection.sendRawTransaction(closeTransaction.serialize());
                log(`📤 Close transaction sent: ${closeSignature}`, colors.yellow);
                
                // Wait for confirmation
                const closeConfirmation = await connection.confirmTransaction(closeSignature, 'confirmed');
                if (closeConfirmation.value.err) {
                    log(`❌ Close transaction failed: ${JSON.stringify(closeConfirmation.value.err)}`, colors.red);
                } else {
                    log(`✅ Registry closed! Transaction: ${closeSignature}`, colors.green);
                }
                
                log('⏳ Waiting 5 seconds for finalization...', colors.yellow);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
            } catch (closeError) {
                log(`❌ Failed to close registry: ${closeError.message}`, colors.red);
                log('🤔 Registry might already be closed or have an issue', colors.yellow);
            }
        }

        // Step 2: Check registry status after close
        log('\n🔍 Checking registry status after close...', colors.cyan);
        const postCloseAccount = await connection.getAccountInfo(collectionRegistryPda);
        if (postCloseAccount) {
            log('⚠️  Registry account still exists after close attempt', colors.yellow);
            log(`📊 Account size: ${postCloseAccount.data.length} bytes`, colors.yellow);
        } else {
            log('✅ Registry account successfully closed', colors.green);
        }
        
        // Step 3: Re-initialize the registry
        log('\n🚀 STEP 3: Re-initializing collection registry...', colors.green);
        
        try {
            // Create initialize instruction manually
            const initInstruction = new TransactionInstruction({
                keys: [
                    { pubkey: collectionRegistryPda, isSigner: false, isWritable: true },
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: LENDING_PROGRAM_ID,
                data: INITIALIZE_COLLECTION_REGISTRY_DISCRIMINATOR,
            });

            const initTransaction = new Transaction();
            initTransaction.add(initInstruction);
            initTransaction.feePayer = adminKeypair.publicKey;
            
            const { blockhash: initBlockhash } = await connection.getLatestBlockhash();
            initTransaction.recentBlockhash = initBlockhash;
            
            // Sign and send the initialize transaction
            initTransaction.sign(adminKeypair);
            
            const initSignature = await connection.sendRawTransaction(initTransaction.serialize());
            log(`📤 Initialize transaction sent: ${initSignature}`, colors.yellow);
            
            // Wait for confirmation
            const initConfirmation = await connection.confirmTransaction(initSignature, 'confirmed');
            if (initConfirmation.value.err) {
                log(`❌ Initialize transaction failed: ${JSON.stringify(initConfirmation.value.err)}`, colors.red);
            } else {
                log(`✅ Collection registry re-initialized! Transaction: ${initSignature}`, colors.green);
            }
            
        } catch (initError) {
            log(`❌ Failed to initialize registry: ${initError.message}`, colors.red);
            if (initError.logs) {
                log('📝 Error logs:', colors.yellow);
                initError.logs.forEach(logLine => log(`  ${logLine}`, colors.white));
            }
        }

        // Step 4: Verify the new registry
        log('\n🔍 STEP 4: Verifying registry status...', colors.cyan);
        
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for confirmation
        
        const finalRegistryAccount = await connection.getAccountInfo(collectionRegistryPda);
        if (finalRegistryAccount) {
            log('✅ Registry account exists!', colors.green);
            log(`📊 Account size: ${finalRegistryAccount.data.length} bytes`, colors.white);
            log(`👤 Account owner: ${finalRegistryAccount.owner.toString()}`, colors.white);
            log(`💰 Account lamports: ${finalRegistryAccount.lamports}`, colors.white);
            
            // Try to parse basic info (first few bytes after discriminator)
            try {
                const data = finalRegistryAccount.data;
                if (data.length >= 40) {
                    // Skip discriminator (8 bytes) and read authority (32 bytes)
                    const authority = new PublicKey(data.slice(8, 40));
                    log(`📊 Registry authority: ${authority.toString()}`, colors.white);
                    
                    // Read collections length (4 bytes after authority)
                    if (data.length >= 44) {
                        const collectionsLength = data.readUInt32LE(40);
                        log(`📚 Collections count: ${collectionsLength}`, colors.white);
                        
                        if (collectionsLength === 0) {
                            log('\n🎉 SUCCESS: Collection registry has been wiped clean!', colors.green);
                        } else {
                            log('\n⚠️  WARNING: Registry still contains collections', colors.yellow);
                        }
                    }
                }
            } catch (parseError) {
                log(`⚠️  Could not parse registry data: ${parseError.message}`, colors.yellow);
            }
        } else {
            log('❌ Registry account does not exist after initialization', colors.red);
        }

        // Get admin balance
        const adminBalance = await connection.getBalance(adminKeypair.publicKey);
        log(`\n💰 Admin wallet balance: ${(adminBalance / 1e9).toFixed(4)} SOL`, colors.yellow);

        log('\n✅ Collection registry operation completed!', colors.green);

    } catch (error) {
        log(`\n❌ Unexpected error: ${error.message}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

main().catch(console.error);
