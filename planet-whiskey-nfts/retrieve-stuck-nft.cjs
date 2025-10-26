const { Connection, PublicKey, Transaction, SystemProgram, TransactionInstruction } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync, createTransferInstruction } = require('@solana/spl-token');
const { Program, AnchorProvider, BN } = require('@coral-xyz/anchor');
const fs = require('fs');

// Load the marketplace program IDL
const marketplaceIdl = JSON.parse(fs.readFileSync('./src/lib/idl/marketplaceprogram.json', 'utf8'));

async function retrieveStuckNft() {
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    
    // Transaction details from the user
    const nftMint = new PublicKey("5RgAntxESeEbGqA5TbNeRwjEWVhb6iCVA9VbeANEfeZ5");
    const seller = new PublicKey("CbjG3a2CKEkjPUsku3V65q5Ff19hoPbyL49eSMsypt1n");
    const listingPda = new PublicKey("B2rPo6u8ggHrX3dThBGGVSwJrTLZAQDfdi1VM2tDLPnq");
    const escrowAccount = new PublicKey("DvpcK1zgLcF8rV7Td3GhR7k6TPwy1ujMXEzZFtVcBSuN");
    const marketplaceProgramId = new PublicKey("BNRyCuYAv1bH6hKL4Q7sHSiN5UvZUpCw9G5aj3iGgkaT");
    
    console.log(`🔍 Retrieving stuck NFT: ${nftMint.toString()}`);
    console.log(`👤 Seller: ${seller.toString()}`);
    console.log(`📋 Listing PDA: ${listingPda.toString()}`);
    console.log(`🏦 Escrow Account: ${escrowAccount.toString()}`);
    
    try {
        // Check if the listing PDA exists
        const listingAccountInfo = await connection.getAccountInfo(listingPda);
        if (!listingAccountInfo) {
            console.log(`❌ Listing PDA does not exist - NFT may have been cancelled already`);
            return;
        }
        
        console.log(`✅ Listing PDA exists`);
        
        // Check escrow account
        const escrowAccountInfo = await connection.getAccountInfo(escrowAccount);
        if (!escrowAccountInfo) {
            console.log(`❌ Escrow account does not exist`);
            return;
        }
        
        console.log(`✅ Escrow account exists`);
        
        // Check NFT balance in escrow
        // The escrow account is the token account itself, not the owner
        const escrowNftInfo = await connection.getAccountInfo(escrowAccount);
        
        if (!escrowNftInfo) {
            console.log(`❌ Escrow token account does not exist`);
            return;
        }
        
        // Parse token account data to get balance
        const tokenAccountData = escrowNftInfo.data;
        const balance = tokenAccountData.readUInt64LE(64);
        
        console.log(`💰 NFT balance in escrow: ${balance}`);
        
        if (balance === 0) {
            console.log(`❌ No NFT in escrow - may have been transferred already`);
            return;
        }
        
        console.log(`✅ NFT is in escrow and can be retrieved`);
        
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
        
        // Also check database
        console.log(`\n🔍 Checking database for this listing...`);
        try {
            const response = await fetch('http://localhost:3000/api/marketplace/listings', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const listings = await response.json();
                const matchingListing = listings.find(l => l.nftMintAddress === nftMint.toString());
                
                if (matchingListing) {
                    console.log(`✅ Found listing in database:`, matchingListing);
                } else {
                    console.log(`❌ No listing found in database for NFT: ${nftMint.toString()}`);
                }
            } else {
                console.log(`❌ Failed to fetch listings from database: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Error checking database: ${error.message}`);
        }
        
    } catch (error) {
        console.error(`❌ Error retrieving NFT:`, error);
    }
}

retrieveStuckNft();
