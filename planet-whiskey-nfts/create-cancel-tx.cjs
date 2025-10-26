const { Connection, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');
const { Program, AnchorProvider, BN } = require('@coral-xyz/anchor');
const fs = require('fs');

// Load the marketplace program IDL
const marketplaceIdl = JSON.parse(fs.readFileSync('./src/lib/idl/marketplaceprogram.json', 'utf8'));

async function createCancelTransaction() {
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    
    // Transaction details from the user
    const nftMint = new PublicKey("5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5");
    const seller = new PublicKey("CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n");
    const listingPda = new PublicKey("B2rPo6u8ggHrX3dThBGGVSwJrTLZAQDfdi1VM2tDLPnq");
    const escrowAccount = new PublicKey("DvpcK1zgLcF8rV7Td3GhR7k6TPwy1ujMXEzZFtVcBSuN");
    const marketplaceProgramId = new PublicKey("BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT");
    
    console.log(`🔍 Creating cancel transaction for NFT: ${nftMint.toString()}`);
    console.log(`👤 Seller: ${seller.toString()}`);
    console.log(`📋 Listing PDA: ${listingPda.toString()}`);
    console.log(`🏦 Escrow Account: ${escrowAccount.toString()}`);
    
    try {
        // Create cancel listing instruction
        const program = new Program(marketplaceIdl, marketplaceProgramId, new AnchorProvider(connection, { publicKey: seller }, {}));
        
        const cancelInstruction = await program.methods
            .cancelListing()
            .accounts({
                seller: seller,
                listing: listingPda,
                sellerNftTokenAccount: getAssociatedTokenAddressSync(nftMint, seller),
                escrowTokenAccount: escrowAccount,
                nftToListMint: nftMint,
                systemProgram: SystemProgram.programId,
                tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            })
            .instruction();
        
        console.log(`🔧 Created cancel listing instruction`);
        
        // Create transaction
        const transaction = new Transaction();
        transaction.add(cancelInstruction);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = seller;
        
        console.log(`📝 Transaction created`);
        console.log(`🔑 Transaction needs to be signed by: ${seller.toString()}`);
        console.log(`📋 Transaction instructions: ${transaction.instructions.length}`);
        
        // Serialize transaction for manual signing
        const serialized = transaction.serialize({ requireAllSignatures: false });
        console.log(`📦 Serialized transaction size: ${serialized.length} bytes`);
        
        console.log(`\n🚀 To retrieve the NFT:`);
        console.log(`1. Sign this transaction with the seller wallet: ${seller.toString()}`);
        console.log(`2. Send the signed transaction to the network`);
        console.log(`3. The NFT will be returned to the seller's wallet`);
        
        // Also create a manual database entry
        console.log(`\n📝 Manual database entry to create:`);
        console.log(`POST /api/marketplace/list`);
        console.log(`Headers: x-wallet-address: ${seller.toString()}`);
        console.log(`Body:`);
        console.log(JSON.stringify({
            nftMintAddress: nftMint.toString(),
            price: 1000000,
            collectionMintAddress: "5U4fRbS1NCdTaFxfaJ7LB8hJ5uijuSTMsezPNsnBCnCT", // Master Distiller Rewards collection
            signature: "2ALGN1UsN3nquke7gCWm..." // Partial signature from your transaction
        }, null, 2));
        
    } catch (error) {
        console.error(`❌ Error creating cancel transaction:`, error);
    }
}

createCancelTransaction();




