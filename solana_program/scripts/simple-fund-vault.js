#!/usr/bin/env node

import { 
    Connection, 
    PublicKey, 
    Keypair, 
    Transaction,
    TransactionInstruction,
    SystemProgram
} from "@solana/web3.js";
import { 
    getOrCreateAssociatedTokenAccount,
    transfer,
    getAccount,
    createTransferInstruction
} from "@solana/spl-token";
import { readFileSync } from "fs";

// Load keypairs
function loadKeypair(filePath) {
    const keypairData = JSON.parse(readFileSync(filePath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

// Program IDs and addresses
const USDC_MINT = new PublicKey("4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP");
const CAPITAL_VAULT = new PublicKey("FzGtqNEZdQLvW3jxKVgx4C6gXHLd2RSAXxnbYy8RypSt");
const ADMIN_WALLET = new PublicKey("2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk");

async function fundCapitalVault() {
    console.log("💰 Funding Capital Vault with USDC...");
    console.log("=" .repeat(60));
    
    // Connection setup
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load admin keypair
    const adminKeypair = loadKeypair("/home/arucard/.config/solana/admin-keypair.json");
    
    console.log(`\n📋 Configuration:`);
    console.log(`Admin wallet: ${adminKeypair.publicKey.toString()}`);
    console.log(`USDC Mint: ${USDC_MINT.toString()}`);
    console.log(`Capital Vault: ${CAPITAL_VAULT.toString()}`);
    
    try {
        // Check admin wallet balance
        const adminBalance = await connection.getBalance(adminKeypair.publicKey);
        console.log(`\n💳 Admin wallet balance: ${(adminBalance / 1e9).toFixed(4)} SOL`);
        
        if (adminBalance < 0.1 * 1e9) {
            console.log("⚠️  Admin wallet has low SOL balance. Please fund it first.");
            return;
        }
        
        // Get or create admin's USDC token account
        console.log("\n🪙 Setting up admin USDC token account...");
        const adminUsdcAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            adminKeypair,
            USDC_MINT,
            adminKeypair.publicKey
        );
        
        console.log(`Admin USDC account: ${adminUsdcAccount.address.toString()}`);
        
        // Check current USDC balance
        const adminUsdcBalance = await getAccount(connection, adminUsdcAccount.address);
        console.log(`Current admin USDC balance: ${adminUsdcBalance.amount.toString()} (${Number(adminUsdcBalance.amount) / 1e6} USDC)`);
        
        // For devnet, we'll try to airdrop USDC first
        if (adminUsdcBalance.amount === 0n) {
            console.log("\n🪙 Requesting USDC airdrop from devnet...");
            try {
                // Try to airdrop USDC (this might not work on all devnet faucets)
                const airdropResponse = await fetch("https://faucet.solana.com/request", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        address: adminKeypair.publicKey.toString(),
                        token: USDC_MINT.toString()
                    })
                });
                
                if (airdropResponse.ok) {
                    console.log("✅ USDC airdrop requested successfully");
                    // Wait a bit for the airdrop to process
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    console.log("⚠️  USDC airdrop failed, trying alternative method...");
                }
            } catch (error) {
                console.log("⚠️  USDC airdrop not available, trying alternative method...");
            }
        }
        
        // Check balance again after potential airdrop
        const updatedBalance = await getAccount(connection, adminUsdcAccount.address);
        console.log(`Updated admin USDC balance: ${updatedBalance.amount.toString()} (${Number(updatedBalance.amount) / 1e6} USDC)`);
        
        if (updatedBalance.amount === 0n) {
            console.log("\n❌ No USDC available. For devnet testing, you may need to:");
            console.log("1. Get USDC from a devnet faucet");
            console.log("2. Or use a different USDC mint that you have access to");
            console.log("3. Or modify the script to mint USDC if you have mint authority");
            return;
        }
        
        // Check capital vault current balance
        console.log("\n🏦 Checking capital vault balance...");
        try {
            const vaultBalance = await getAccount(connection, CAPITAL_VAULT);
            console.log(`Current capital vault balance: ${vaultBalance.amount.toString()} (${Number(vaultBalance.amount) / 1e6} USDC)`);
        } catch (error) {
            console.log("ℹ️  Capital vault token account doesn't exist yet or is empty");
        }
        
        // Transfer available USDC to capital vault (or a portion of it)
        const availableAmount = updatedBalance.amount;
        const transferAmount = availableAmount > 0n ? availableAmount : 0n;
        
        if (transferAmount === 0n) {
            console.log("❌ No USDC to transfer");
            return;
        }
        
        console.log(`\n💸 Transferring ${Number(transferAmount) / 1e6} USDC to capital vault...`);
        
        const transferSignature = await transfer(
            connection,
            adminKeypair,
            adminUsdcAccount.address,
            CAPITAL_VAULT,
            adminKeypair,
            transferAmount
        );
        
        console.log(`✅ Transfer successful!`);
        console.log(`Transaction signature: ${transferSignature}`);
        
        // Verify the transfer
        console.log("\n🔍 Verifying transfer...");
        const vaultBalance = await getAccount(connection, CAPITAL_VAULT);
        console.log(`New capital vault balance: ${vaultBalance.amount.toString()} (${Number(vaultBalance.amount) / 1e6} USDC)`);
        
        console.log("\n" + "=" .repeat(60));
        console.log("🎉 CAPITAL VAULT FUNDING SUCCESSFUL!");
        console.log("=" .repeat(60));
        console.log(`💰 Capital Vault now has: ${Number(vaultBalance.amount) / 1e6} USDC`);
        console.log("✅ Ready for lending operations!");
        
    } catch (error) {
        console.error("\n❌ Funding failed:", error);
        if (error.logs) console.error("Program logs:", error.logs);
        throw error;
    }
}

fundCapitalVault().catch(console.error);
