const { Connection, PublicKey, Keypair, Transaction, SystemProgram } = require('@solana/web3.js');
const { createInitializeAccountInstruction, createInitializeMintInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } = require('@solana/spl-token');
const fs = require('fs');

// Program IDs
const WHISKEY_PROGRAM_ID = new PublicKey('8vEiY4FFwL4dDPhQHMMxuY1EsWys3Uw8hDTw9a3S8rMJ');
const LENDING_PROGRAM_ID = new PublicKey('48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3');

// Token mints
const WHISKEY_TOKEN_MINT = new PublicKey('9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// PDA Seeds
const LENDING_POOL_SEED = Buffer.from('lending_pool');
const COLLECTION_REGISTRY_SEED = Buffer.from('collection_registry');
const GLOBAL_MARKET_SEED = Buffer.from('global_market');
const CAPITAL_VAULT_SEED = Buffer.from('capital_vault_usdc');

function loadKeypair(filePath) {
    const secretKeyString = fs.readFileSync(filePath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
}

function createInstructionData(discriminator, data = Buffer.alloc(0)) {
    return Buffer.concat([Buffer.from(discriminator), data]);
}

function serializeU64(value) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64LE(BigInt(value), 0);
    return buffer;
}

function serializeU32(value) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(value, 0);
    return buffer;
}

function serializePubkey(pubkey) {
    return pubkey.toBuffer();
}

async function main() {
    console.log('🚀 Raw initialization of all program accounts...');
    console.log('📍 Whiskey Program ID:', WHISKEY_PROGRAM_ID.toString());
    console.log('📍 Lending Program ID:', LENDING_PROGRAM_ID.toString());
    
    // Setup connection and wallet
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const adminKeypair = loadKeypair('./mainnet-admin-keypair.json');
    
    console.log('🔑 Admin wallet:', adminKeypair.publicKey.toString());
    
    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log('💰 Admin balance:', balance / 1e9, 'SOL');
    
    // Calculate all PDAs
    console.log('\\n📋 Calculating all PDAs...');
    
    // Whiskey Program PDAs
    const [lendingPoolConfigPda, lendingPoolBump] = PublicKey.findProgramAddressSync(
        [LENDING_POOL_SEED],
        WHISKEY_PROGRAM_ID
    );
    
    const [whiskeyVaultPda] = PublicKey.findProgramAddressSync(
        [LENDING_POOL_SEED, Buffer.from('whiskey_vault_v2')],
        WHISKEY_PROGRAM_ID
    );
    
    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
        [LENDING_POOL_SEED, Buffer.from('usdc_vault_v2')],
        WHISKEY_PROGRAM_ID
    );
    
    const [intermediateSolPda] = PublicKey.findProgramAddressSync(
        [LENDING_POOL_SEED, Buffer.from('intermediate_sol')],
        WHISKEY_PROGRAM_ID
    );
    
    // Lending Program PDAs
    const [collectionRegistryPda, collectionRegistryBump] = PublicKey.findProgramAddressSync(
        [COLLECTION_REGISTRY_SEED],
        LENDING_PROGRAM_ID
    );
    
    const [globalMarketPda, globalMarketBump] = PublicKey.findProgramAddressSync(
        [GLOBAL_MARKET_SEED],
        LENDING_PROGRAM_ID
    );
    
    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
        [CAPITAL_VAULT_SEED],
        LENDING_PROGRAM_ID
    );
    
    console.log('\\n📋 All PDAs calculated:');
    console.log('  === WHISKEY PROGRAM ===');
    console.log('  Lending Pool Config:', lendingPoolConfigPda.toString());
    console.log('  WHISKEY Vault:', whiskeyVaultPda.toString());
    console.log('  USDC Vault:', usdcVaultPda.toString());
    console.log('  Intermediate SOL:', intermediateSolPda.toString());
    console.log('  === LENDING PROGRAM ===');
    console.log('  Collection Registry:', collectionRegistryPda.toString());
    console.log('  Global Market:', globalMarketPda.toString());
    console.log('  Capital Vault:', capitalVaultPda.toString());
    
    // Check which accounts already exist
    console.log('\\n🔍 Checking existing accounts...');
    
    const accountsToCheck = [
        { name: 'Lending Pool Config', pda: lendingPoolConfigPda },
        { name: 'Collection Registry', pda: collectionRegistryPda },
        { name: 'Global Market', pda: globalMarketPda },
        { name: 'Capital Vault', pda: capitalVaultPda },
        { name: 'WHISKEY Vault', pda: whiskeyVaultPda },
        { name: 'USDC Vault', pda: usdcVaultPda },
        { name: 'Intermediate SOL', pda: intermediateSolPda }
    ];
    
    const accountStatuses = {};
    for (const account of accountsToCheck) {
        const accountInfo = await connection.getAccountInfo(account.pda);
        accountStatuses[account.name] = !!accountInfo;
        console.log(`  ${account.name}: ${accountInfo ? '✅ EXISTS' : '❌ MISSING'}`);
    }
    
    // 1. Initialize Collection Registry (Lending Program)
    if (!accountStatuses['Collection Registry']) {
        console.log('\\n🏗️ Step 1: Initializing Collection Registry...');
        try {
            // Collection Registry initialization discriminator
            const initCollectionRegistryDiscriminator = [67, 46, 195, 231, 11, 87, 70, 204];
            const instructionData = createInstructionData(initCollectionRegistryDiscriminator);
            
            const instruction = {
                programId: LENDING_PROGRAM_ID,
                keys: [
                    { pubkey: collectionRegistryPda, isSigner: false, isWritable: true },
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
                ],
                data: instructionData
            };
            
            const transaction = new Transaction().add(instruction);
            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature);
            
            console.log('✅ Collection Registry initialized:', signature);
        } catch (error) {
            console.error('❌ Collection Registry initialization failed:', error.message);
        }
    } else {
        console.log('✅ Collection Registry already exists');
    }
    
    // 2. Initialize Global Market (Lending Program)
    if (!accountStatuses['Global Market']) {
        console.log('\\n🏗️ Step 2: Initializing Global Market...');
        try {
            // Global Market initialization discriminator
            const initGlobalMarketDiscriminator = [67, 173, 52, 201, 74, 169, 150, 163];
            
            // Parameters: max_staked_nfts (u32), per_nft_value_usd (u64), liquidation_authority (Pubkey)
            const maxStakedNfts = 10000;
            const perNftValueUsd = 100_000_000; // $100 in micro-dollars (6 decimals)
            const liquidationAuthority = adminKeypair.publicKey; // Use admin as liquidation authority for now
            
            const instructionData = Buffer.concat([
                Buffer.from(initGlobalMarketDiscriminator),
                serializeU32(maxStakedNfts),
                serializeU64(perNftValueUsd),
                serializePubkey(liquidationAuthority)
            ]);
            
            const instruction = {
                programId: LENDING_PROGRAM_ID,
                keys: [
                    { pubkey: globalMarketPda, isSigner: false, isWritable: true },
                    { pubkey: collectionRegistryPda, isSigner: false, isWritable: false },
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: capitalVaultPda, isSigner: false, isWritable: false },
                    { pubkey: adminKeypair.publicKey, isSigner: false, isWritable: false }, // treasury wallet
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
                ],
                data: instructionData
            };
            
            const transaction = new Transaction().add(instruction);
            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature);
            
            console.log('✅ Global Market initialized:', signature);
        } catch (error) {
            console.error('❌ Global Market initialization failed:', error.message);
        }
    } else {
        console.log('✅ Global Market already exists');
    }
    
    // 3. Initialize Capital Vault (Lending Program)
    if (!accountStatuses['Capital Vault']) {
        console.log('\\n🏗️ Step 3: Initializing Capital Vault...');
        try {
            // Capital Vault initialization discriminator
            const initCapitalVaultDiscriminator = [168, 123, 174, 219, 245, 182, 124, 87];
            const instructionData = createInstructionData(initCapitalVaultDiscriminator);
            
            const instruction = {
                programId: LENDING_PROGRAM_ID,
                keys: [
                    { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                    { pubkey: globalMarketPda, isSigner: false, isWritable: false },
                    { pubkey: capitalVaultPda, isSigner: false, isWritable: true },
                    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    { pubkey: new PublicKey('SysvarRent111111111111111111111111111111111'), isSigner: false, isWritable: false }
                ],
                data: instructionData
            };
            
            const transaction = new Transaction().add(instruction);
            const signature = await connection.sendTransaction(transaction, [adminKeypair]);
            await connection.confirmTransaction(signature);
            
            console.log('✅ Capital Vault initialized:', signature);
        } catch (error) {
            console.error('❌ Capital Vault initialization failed:', error.message);
        }
    } else {
        console.log('✅ Capital Vault already exists');
    }
    
    // 4. Initialize Lending Pool (Whiskey Program)
    if (!accountStatuses['Lending Pool Config']) {
        console.log('\\n🏗️ Step 4: Initializing Lending Pool...');
        try {
            // Lending Pool initialization discriminator - we need to find this from the IDL
            // For now, let's use a placeholder and get the actual discriminator
            console.log('⚠️ Need to implement Lending Pool initialization with correct discriminator');
            console.log('   This requires the exact instruction discriminator from the whiskey program IDL');
        } catch (error) {
            console.error('❌ Lending Pool initialization failed:', error.message);
        }
    } else {
        console.log('✅ Lending Pool already exists');
    }
    
    console.log('\\n✅ Initialization process complete!');
    console.log('\\n📋 FINAL SUMMARY - Copy these addresses to env.example:');
    console.log('# === NEW PROGRAM ADDRESSES ===');
    console.log('NEXT_PUBLIC_WHISKEY_PROGRAM_ID=' + WHISKEY_PROGRAM_ID.toString());
    console.log('NEXT_PUBLIC_LENDING_PROGRAM_ID=' + LENDING_PROGRAM_ID.toString());
    console.log('');
    console.log('# === WHISKEY PROGRAM PDAs ===');
    console.log('NEXT_PUBLIC_LENDING_POOL_CONFIG=' + lendingPoolConfigPda.toString());
    console.log('NEXT_PUBLIC_WHISKEY_VAULT=' + whiskeyVaultPda.toString());
    console.log('NEXT_PUBLIC_USDC_VAULT=' + usdcVaultPda.toString());
    console.log('NEXT_PUBLIC_INTERMEDIATE_SOL_VAULT=' + intermediateSolPda.toString());
    console.log('');
    console.log('# === LENDING PROGRAM PDAs ===');
    console.log('NEXT_PUBLIC_COLLECTION_REGISTRY=' + collectionRegistryPda.toString());
    console.log('NEXT_PUBLIC_GLOBAL_MARKET=' + globalMarketPda.toString());
    console.log('NEXT_PUBLIC_CAPITAL_VAULT=' + capitalVaultPda.toString());
}

main().catch(console.error);
