#!/usr/bin/env node

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction, 
    TransactionInstruction,
    SystemProgram
} from "@solana/web3.js";
import { readFileSync } from "fs";

// Load keypairs
function loadKeypair(filePath) {
    const keypairData = JSON.parse(readFileSync(filePath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Program IDs
const LENDING_PROGRAM_ID = new PublicKey("4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6");
const WHISKEY_PROGRAM_ID = new PublicKey("Y5ZTxmgfR51njNPjHRm9WYzbmvoG4uptaQnHupdKbFM");
const WHISKEY_TOKEN_MINT = new PublicKey("6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu");
const USDC_MINT = new PublicKey("4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP");

// Instruction discriminators (from IDLs)
const INITIALIZE_GLOBAL_MARKET_DISCRIMINATOR = [67, 173, 52, 201, 74, 169, 150, 163];
const INITIALIZE_CAPITAL_VAULT_DISCRIMINATOR = [168, 123, 174, 219, 245, 182, 124, 87];
const INITIALIZE_COLLECTION_REGISTRY_V2_DISCRIMINATOR = [36, 5, 148, 143, 175, 68, 134, 223];
const INITIALIZE_LENDING_POOL_DISCRIMINATOR = [236, 76, 136, 68, 196, 14, 9, 177];

function createGlobalMarketInstructionData(maxStakedNfts, perNftValueUsd, liquidationAuthority) {
    const buffer = Buffer.alloc(8 + 4 + 8 + 32); // discriminator + u32 + u64 + pubkey
    
    // Write discriminator
    Buffer.from(INITIALIZE_GLOBAL_MARKET_DISCRIMINATOR).copy(buffer, 0);
    
    // Write maxStakedNfts as u32 (little endian)
    buffer.writeUInt32LE(maxStakedNfts, 8);
    
    // Write perNftValueUsd as u64 (little endian) - split into two u32s
    const perNftValueLow = perNftValueUsd & 0xFFFFFFFF;
    const perNftValueHigh = Math.floor(perNftValueUsd / 0x100000000);
    buffer.writeUInt32LE(perNftValueLow, 12);
    buffer.writeUInt32LE(perNftValueHigh, 16);
    
    // Write liquidationAuthority pubkey (32 bytes)
    liquidationAuthority.toBuffer().copy(buffer, 20);
    
    return buffer;
}

function createSimpleInstructionData(discriminator) {
    return Buffer.from(discriminator);
}

async function initializeGlobalMarket(connection, adminKeypair, liquidationKeypair) {
    console.log("\n🌍 Initializing Global Market...");
    
    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_market")],
        LENDING_PROGRAM_ID
    );
    
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("collection_registry")],
        LENDING_PROGRAM_ID
    );
    
    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("capital_vault_usdc")],
        LENDING_PROGRAM_ID
    );
    
    console.log(`Global Market PDA: ${globalMarketPda.toString()}`);
    console.log(`Collection Registry PDA: ${collectionRegistryPda.toString()}`);
    console.log(`Capital Vault PDA: ${capitalVaultPda.toString()}`);
    
    // Check if already exists
    const existingAccount = await connection.getAccountInfo(globalMarketPda);
    if (existingAccount) {
        console.log("ℹ️  Global Market already exists!");
        return { globalMarketPda, collectionRegistryPda, capitalVaultPda };
    }
    
    try {
        console.log("🚀 Creating Global Market...");
        
        const instructionData = createGlobalMarketInstructionData(
            10000, // maxStakedNfts
            50000000, // perNftValueUsd (50 USD with 6 decimals)
            liquidationKeypair.publicKey
        );
        
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: globalMarketPda, isSigner: false, isWritable: true },
                { pubkey: collectionRegistryPda, isSigner: false, isWritable: true },
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: capitalVaultPda, isSigner: false, isWritable: false },
                { pubkey: adminKeypair.publicKey, isSigner: false, isWritable: false }, // treasury_wallet
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: LENDING_PROGRAM_ID,
            data: instructionData,
        });
        
        const transaction = new Transaction().add(instruction);
        const signature = await connection.sendTransaction(transaction, [adminKeypair]);
        await connection.confirmTransaction(signature);
        
        console.log(`✅ Global Market initialized successfully!`);
        console.log(`Transaction signature: ${signature}`);
        
        return { globalMarketPda, collectionRegistryPda, capitalVaultPda };
        
    } catch (error) {
        console.error("❌ Failed to initialize Global Market:", error);
        if (error.logs) console.error("Program logs:", error.logs);
        throw error;
    }
}

async function initializeCapitalVault(connection, adminKeypair, capitalVaultPda, globalMarketPda) {
    console.log("\n💰 Initializing Capital Vault...");
    
    // Check if already exists
    const existingAccount = await connection.getAccountInfo(capitalVaultPda);
    if (existingAccount) {
        console.log("ℹ️  Capital Vault already exists!");
        return capitalVaultPda;
    }
    
    try {
        console.log("🚀 Creating Capital Vault...");
        
        const instructionData = createSimpleInstructionData(INITIALIZE_CAPITAL_VAULT_DISCRIMINATOR);
        
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: globalMarketPda, isSigner: false, isWritable: false },
                { pubkey: capitalVaultPda, isSigner: false, isWritable: true },
                { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
            ],
            programId: LENDING_PROGRAM_ID,
            data: instructionData,
        });
        
        const transaction = new Transaction().add(instruction);
        const signature = await connection.sendTransaction(transaction, [adminKeypair]);
        await connection.confirmTransaction(signature);
        
        console.log(`✅ Capital Vault initialized successfully!`);
        console.log(`Transaction signature: ${signature}`);
        
        return capitalVaultPda;
        
    } catch (error) {
        console.error("❌ Failed to initialize Capital Vault:", error);
        if (error.logs) console.error("Program logs:", error.logs);
        throw error;
    }
}

async function initializeCollectionRegistryV2(connection, adminKeypair) {
    console.log("\n📚 Initializing Collection Registry V2...");
    
    // Calculate PDA
    const [collectionRegistryV2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from("collection_registry_v2")],
        LENDING_PROGRAM_ID
    );
    
    console.log(`Collection Registry V2 PDA: ${collectionRegistryV2Pda.toString()}`);
    
    // Check if already exists
    const existingAccount = await connection.getAccountInfo(collectionRegistryV2Pda);
    if (existingAccount) {
        console.log("ℹ️  Collection Registry V2 already exists!");
        return collectionRegistryV2Pda;
    }
    
    try {
        console.log("🚀 Creating Collection Registry V2...");
        
        const instructionData = createSimpleInstructionData(INITIALIZE_COLLECTION_REGISTRY_V2_DISCRIMINATOR);
        
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: collectionRegistryV2Pda, isSigner: false, isWritable: true },
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: LENDING_PROGRAM_ID,
            data: instructionData,
        });
        
        const transaction = new Transaction().add(instruction);
        const signature = await connection.sendTransaction(transaction, [adminKeypair]);
        await connection.confirmTransaction(signature);
        
        console.log(`✅ Collection Registry V2 initialized successfully!`);
        console.log(`Transaction signature: ${signature}`);
        
        return collectionRegistryV2Pda;
        
    } catch (error) {
        console.error("❌ Failed to initialize Collection Registry V2:", error);
        if (error.logs) console.error("Program logs:", error.logs);
        throw error;
    }
}

async function initializeLendingPool(connection, adminKeypair) {
    console.log("\n🏦 Initializing Lending Pool...");
    
    // Calculate PDAs
    const [lendingPoolConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_pool")],
        WHISKEY_PROGRAM_ID
    );
    
    const [whiskeyVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_pool"), Buffer.from("whiskey_vault_v2")],
        WHISKEY_PROGRAM_ID
    );
    
    const [usdcVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
        WHISKEY_PROGRAM_ID
    );
    
    console.log(`Lending Pool Config PDA: ${lendingPoolConfigPda.toString()}`);
    console.log(`WHISKEY Vault PDA: ${whiskeyVaultPda.toString()}`);
    console.log(`USDC Vault PDA: ${usdcVaultPda.toString()}`);
    
    // Check if already exists
    const existingAccount = await connection.getAccountInfo(lendingPoolConfigPda);
    if (existingAccount) {
        console.log("ℹ️  Lending Pool already exists!");
        return { lendingPoolConfigPda, whiskeyVaultPda, usdcVaultPda };
    }
    
    try {
        console.log("🚀 Creating Lending Pool...");
        
        const instructionData = createSimpleInstructionData(INITIALIZE_LENDING_POOL_DISCRIMINATOR);
        
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                { pubkey: lendingPoolConfigPda, isSigner: false, isWritable: true },
                { pubkey: whiskeyVaultPda, isSigner: false, isWritable: true },
                { pubkey: usdcVaultPda, isSigner: false, isWritable: true },
                { pubkey: WHISKEY_TOKEN_MINT, isSigner: false, isWritable: false },
                { pubkey: USDC_MINT, isSigner: false, isWritable: false },
                { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
            ],
            programId: WHISKEY_PROGRAM_ID,
            data: instructionData,
        });
        
        const transaction = new Transaction().add(instruction);
        const signature = await connection.sendTransaction(transaction, [adminKeypair]);
        await connection.confirmTransaction(signature);
        
        console.log(`✅ Lending Pool initialized successfully!`);
        console.log(`Transaction signature: ${signature}`);
        
        return { lendingPoolConfigPda, whiskeyVaultPda, usdcVaultPda };
        
    } catch (error) {
        console.error("❌ Failed to initialize Lending Pool:", error);
        if (error.logs) console.error("Program logs:", error.logs);
        throw error;
    }
}

async function fundLiquidationAuthority(connection, adminKeypair, liquidationKeypair) {
    console.log("\n💰 Funding Liquidation Authority...");
    
    // Check current balances
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    const liquidationBalance = await connection.getBalance(liquidationKeypair.publicKey);
    
    console.log(`Admin wallet: ${(adminBalance / 1e9).toFixed(4)} SOL`);
    console.log(`Liquidation authority: ${(liquidationBalance / 1e9).toFixed(4)} SOL`);
    
    // Fund liquidation authority with 1 SOL if needed
    const fundingAmount = 1.0 * 1e9; // 1 SOL in lamports
    
    if (liquidationBalance < 0.5 * 1e9) { // Less than 0.5 SOL
        console.log(`🚀 Transferring 1 SOL to liquidation authority...`);
        
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: adminKeypair.publicKey,
            toPubkey: liquidationKeypair.publicKey,
            lamports: fundingAmount,
        });
        
        const transaction = new Transaction().add(transferInstruction);
        const signature = await connection.sendTransaction(transaction, [adminKeypair]);
        await connection.confirmTransaction(signature);
        
        console.log(`✅ Successfully funded liquidation authority!`);
        console.log(`Transaction signature: ${signature}`);
        
        // Check new balance
        const newLiquidationBalance = await connection.getBalance(liquidationKeypair.publicKey);
        console.log(`New liquidation authority balance: ${(newLiquidationBalance / 1e9).toFixed(4)} SOL`);
        
    } else {
        console.log(`ℹ️  Liquidation authority already has sufficient SOL (${(liquidationBalance / 1e9).toFixed(4)} SOL)`);
    }
}

async function main() {
    console.log("🚀 Complete System Initialization Starting...");
    console.log("=" .repeat(60));
    
    // Connection setup
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load keypairs
    const adminKeypair = loadKeypair("/home/arucard/.config/solana/admin-keypair.json");
    const liquidationKeypair = loadKeypair("liquidation-keypair.json");
    
    console.log(`\n📋 Configuration:`);
    console.log(`Admin wallet: ${adminKeypair.publicKey.toString()}`);
    console.log(`Liquidation authority: ${liquidationKeypair.publicKey.toString()}`);
    console.log(`Lending Program ID: ${LENDING_PROGRAM_ID.toString()}`);
    console.log(`Whiskey Program ID: ${WHISKEY_PROGRAM_ID.toString()}`);
    
    try {
        // Step 1: Initialize Global Market (creates collection_registry v1 too)
        const { globalMarketPda, collectionRegistryPda, capitalVaultPda } = await initializeGlobalMarket(
            connection, 
            adminKeypair, 
            liquidationKeypair
        );
        
        // Step 2: Initialize Capital Vault
        await initializeCapitalVault(connection, adminKeypair, capitalVaultPda, globalMarketPda);
        
        // Step 3: Initialize Collection Registry V2 (required by frontend)
        const collectionRegistryV2Pda = await initializeCollectionRegistryV2(connection, adminKeypair);
        
        // Step 4: Initialize Lending Pool (required for whiskey program minting)
        const { lendingPoolConfigPda, whiskeyVaultPda, usdcVaultPda } = await initializeLendingPool(
            connection, 
            adminKeypair
        );
        
        // Step 5: Fund Liquidation Authority
        await fundLiquidationAuthority(connection, adminKeypair, liquidationKeypair);
        
        console.log("\n" + "=" .repeat(60));
        console.log("🎉 COMPLETE SYSTEM INITIALIZATION SUCCESSFUL!");
        console.log("=" .repeat(60));
        
        console.log("\n📋 All Initialized Accounts:");
        console.log(`Global Market:           ${globalMarketPda.toString()}`);
        console.log(`Capital Vault:           ${capitalVaultPda.toString()}`);
        console.log(`Collection Registry V1:  ${collectionRegistryPda.toString()}`);
        console.log(`Collection Registry V2:  ${collectionRegistryV2Pda.toString()}`);
        console.log(`Lending Pool Config:     ${lendingPoolConfigPda.toString()}`);
        console.log(`WHISKEY Vault:           ${whiskeyVaultPda.toString()}`);
        console.log(`USDC Vault:              ${usdcVaultPda.toString()}`);
        console.log(`Liquidation Authority:   ${liquidationKeypair.publicKey.toString()}`);
        
        console.log("\n✅ System is now ready for:");
        console.log("  • NFT Minting (including whiskey-gated collections)");
        console.log("  • NFT Lending & Borrowing");
        console.log("  • NFT Marketplace Trading");
        console.log("  • Loan Liquidations");
        
        console.log("\n💡 Next steps:");
        console.log("  • Fund Capital Vault with USDC for lending operations");
        console.log("  • Create NFT collections via admin panel");
        console.log("  • Test whiskey-gated NFT minting");
        
    } catch (error) {
        console.error("\n❌ System initialization failed:", error);
        process.exit(1);
    }
}

main().catch(console.error);
