#!/usr/bin/env node

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction,
    sendAndConfirmTransaction
} from "@solana/web3.js";
import { 
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getAccount,
    getMint,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { readFileSync } from "fs";

// Load keypairs
function loadKeypair(filePath) {
    const keypairData = JSON.parse(readFileSync(filePath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Token mint addresses
const USDC_MINT = new PublicKey("4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP");
const WHISKEY_TOKEN_MINT = new PublicKey("6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu");
const ADMIN_WALLET = new PublicKey("2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk");

async function mintTokens() {
    console.log("🪙 Minting USDC and WHISKEY Tokens...");
    console.log("=" .repeat(60));
    
    // Connection setup
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load admin keypair (mint authority)
    const adminKeypair = loadKeypair("/home/arucard/.config/solana/admin-keypair.json");
    
    console.log(`\n📋 Configuration:`);
    console.log(`Admin wallet: ${adminKeypair.publicKey.toString()}`);
    console.log(`USDC Mint: ${USDC_MINT.toString()}`);
    console.log(`WHISKEY Mint: ${WHISKEY_TOKEN_MINT.toString()}`);
    console.log(`Target wallet: ${ADMIN_WALLET.toString()}`);
    
    try {
        // Check admin wallet balance
        const adminBalance = await connection.getBalance(adminKeypair.publicKey);
        console.log(`\n💳 Admin wallet balance: ${(adminBalance / 1e9).toFixed(4)} SOL`);
        
        if (adminBalance < 0.1 * 1e9) {
            console.log("⚠️  Low SOL balance. Consider airdropping more SOL for transaction fees.");
        }

        // Amounts to mint (with decimals)
        const usdcAmount = 1_000_000 * 1e6; // 1M USDC (6 decimals)
        const whiskeyAmount = 1_000_000 * 1e6; // 1M WHISKEY (6 decimals)

        console.log(`\n🎯 Minting amounts:`);
        console.log(`USDC: ${(usdcAmount / 1e6).toLocaleString()} tokens`);
        console.log(`WHISKEY: ${(whiskeyAmount / 1e6).toLocaleString()} tokens`);

        // Get or create USDC token account for admin wallet
        console.log(`\n🔍 Getting/creating USDC token account...`);
        const adminUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            adminKeypair,
            USDC_MINT,
            ADMIN_WALLET,
            false
        );
        console.log(`✅ USDC token account: ${adminUsdcAccount.address.toString()}`);

        // Get or create WHISKEY token account for admin wallet
        console.log(`\n🔍 Getting/creating WHISKEY token account...`);
        const adminWhiskeyAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            adminKeypair,
            WHISKEY_TOKEN_MINT,
            ADMIN_WALLET,
            false
        );
        console.log(`✅ WHISKEY token account: ${adminWhiskeyAccount.address.toString()}`);

        // Check current balances
        const currentUsdcBalance = await getAccount(connection, adminUsdcAccount.address);
        const currentWhiskeyBalance = await getAccount(connection, adminWhiskeyAccount.address);
        
        console.log(`\n📊 Current balances:`);
        console.log(`USDC: ${(Number(currentUsdcBalance.amount) / 1e6).toLocaleString()} tokens`);
        console.log(`WHISKEY: ${(Number(currentWhiskeyBalance.amount) / 1e6).toLocaleString()} tokens`);

        // Mint USDC tokens
        console.log(`\n🪙 Minting USDC tokens...`);
        const usdcMintTx = await mintTo(
            connection,
            adminKeypair,
            USDC_MINT,
            adminUsdcAccount.address,
            adminKeypair, // mint authority
            usdcAmount
        );
        console.log(`✅ USDC mint transaction: ${usdcMintTx}`);

        // Mint WHISKEY tokens
        console.log(`\n🥃 Minting WHISKEY tokens...`);
        const whiskeyMintTx = await mintTo(
            connection,
            adminKeypair,
            WHISKEY_TOKEN_MINT,
            adminWhiskeyAccount.address,
            adminKeypair, // mint authority
            whiskeyAmount
        );
        console.log(`✅ WHISKEY mint transaction: ${whiskeyMintTx}`);

        // Verify final balances
        const finalUsdcBalance = await getAccount(connection, adminUsdcAccount.address);
        const finalWhiskeyBalance = await getAccount(connection, adminWhiskeyAccount.address);
        
        console.log(`\n🎉 Final balances:`);
        console.log(`USDC: ${(Number(finalUsdcBalance.amount) / 1e6).toLocaleString()} tokens`);
        console.log(`WHISKEY: ${(Number(finalWhiskeyBalance.amount) / 1e6).toLocaleString()} tokens`);

        console.log(`\n✅ Token minting completed successfully!`);
        console.log(`🔗 View transactions on Solana Explorer:`);
        console.log(`   USDC: https://explorer.solana.com/tx/${usdcMintTx}?cluster=devnet`);
        console.log(`   WHISKEY: https://explorer.solana.com/tx/${whiskeyMintTx}?cluster=devnet`);

    } catch (error) {
        console.error("❌ Error minting tokens:", error);
        
        // Provide helpful error context
        if (error.message.includes("0x1")) {
            console.error("💡 This might be a mint authority issue. Make sure the admin keypair is the mint authority for both tokens.");
        }
        if (error.message.includes("0x0")) {
            console.error("💡 This might be an insufficient SOL balance issue.");
        }
        
        process.exit(1);
    }
}

// Check if we need to create the tokens first
async function checkTokenMints() {
    console.log("\n🔍 Checking token mint accounts...");
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    try {
        const usdcMint = await getMint(connection, USDC_MINT);
        console.log(`✅ USDC mint exists - Decimals: ${usdcMint.decimals}, Supply: ${usdcMint.supply}`);
    } catch (error) {
        console.log(`❌ USDC mint not found: ${error.message}`);
    }
    
    try {
        const whiskeyMint = await getMint(connection, WHISKEY_TOKEN_MINT);
        console.log(`✅ WHISKEY mint exists - Decimals: ${whiskeyMint.decimals}, Supply: ${whiskeyMint.supply}`);
    } catch (error) {
        console.log(`❌ WHISKEY mint not found: ${error.message}`);
    }
}

async function main() {
    await checkTokenMints();
    await mintTokens();
}

main().catch(console.error);
