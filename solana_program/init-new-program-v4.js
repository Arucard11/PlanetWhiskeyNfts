const { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const { createHash } = require('crypto');
const fs = require('fs');

// Configuration
const PROGRAM_ID = new PublicKey("GwcDshTs5zfQYDercugobRSinsB1s5HvEizwEJy9pMwQ");
const connection = new Connection("https://api.mainnet-beta.solana.com", 'confirmed');

// Load admin keypair
function loadKeypair(filePath) {
    const secretKeyString = fs.readFileSync(filePath, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
}

// Calculate instruction discriminator
function getDiscriminator(instructionName) {
    return createHash('sha256')
        .update(`global:${instructionName}`)
        .digest()
        .slice(0, 8);
}

async function main() {
    console.log("🚀 Initializing new whiskey program accounts...");
    console.log(`Program ID: ${PROGRAM_ID.toString()}`);
    
    // Load admin keypair
    const adminKeypair = loadKeypair('./mainnet-admin-keypair.json');
    console.log(`Admin wallet: ${adminKeypair.publicKey.toString()}`);
    
    // Calculate PDAs
    const [lendingPoolConfigPda, lendingPoolConfigBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_pool")],
        PROGRAM_ID
    );
    
    const [whiskeyVaultPda, whiskeyVaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_pool"), Buffer.from("whiskey_vault_v2")],
        PROGRAM_ID
    );
    
    const [usdcVaultPda, usdcVaultBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("lending_pool"), Buffer.from("usdc_vault_v2")],
        PROGRAM_ID
    );
    
    console.log("\n📋 Calculated PDAs:");
    console.log(`Lending Pool Config: ${lendingPoolConfigPda.toString()} (bump: ${lendingPoolConfigBump})`);
    console.log(`WHISKEY Vault: ${whiskeyVaultPda.toString()} (bump: ${whiskeyVaultBump})`);
    console.log(`USDC Vault: ${usdcVaultPda.toString()} (bump: ${usdcVaultBump})`);
    
    // Check if accounts already exist
    const lendingPoolConfigAccount = await connection.getAccountInfo(lendingPoolConfigPda);
    if (lendingPoolConfigAccount) {
        console.log("✅ Lending pool config already exists, skipping initialization");
        return;
    }
    
    // Create initialize_lending_pool instruction
    const discriminator = getDiscriminator("initialize_lending_pool");
    console.log(`\n🔧 Using discriminator: ${Array.from(discriminator).map(b => b.toString(16).padStart(2, '0')).join('')}`);
    
    const instruction = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
            { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true }, // admin
            { pubkey: lendingPoolConfigPda, isSigner: false, isWritable: true }, // lending_pool_config
            { pubkey: whiskeyVaultPda, isSigner: false, isWritable: true }, // whiskey_vault
            { pubkey: usdcVaultPda, isSigner: false, isWritable: true }, // usdc_vault
            { pubkey: new PublicKey("9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph"), isSigner: false, isWritable: false }, // whiskey_token_mint
            { pubkey: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), isSigner: false, isWritable: false }, // usdc_mint
            { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false }, // token_program
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
            { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false }, // rent
        ],
        data: discriminator,
    });
    
    // Create and send transaction
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = adminKeypair.publicKey;
    
    console.log("\n📤 Sending initialization transaction...");
    try {
        const signature = await connection.sendTransaction(transaction, [adminKeypair], {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });
        
        console.log(`Transaction signature: ${signature}`);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) {
            console.error("❌ Transaction failed:", confirmation.value.err);
        } else {
            console.log("✅ Transaction confirmed successfully!");
            
            // Verify accounts were created
            const lendingPoolConfigCheck = await connection.getAccountInfo(lendingPoolConfigPda);
            const whiskeyVaultCheck = await connection.getAccountInfo(whiskeyVaultPda);
            const usdcVaultCheck = await connection.getAccountInfo(usdcVaultPda);
            
            console.log("\n🔍 Account verification:");
            console.log(`Lending Pool Config: ${lendingPoolConfigCheck ? '✅ EXISTS' : '❌ NOT FOUND'}`);
            console.log(`WHISKEY Vault: ${whiskeyVaultCheck ? '✅ EXISTS' : '❌ NOT FOUND'}`);
            console.log(`USDC Vault: ${usdcVaultCheck ? '✅ EXISTS' : '❌ NOT FOUND'}`);
        }
    } catch (error) {
        console.error("❌ Failed to send transaction:", error);
    }
}

main().catch(console.error);
