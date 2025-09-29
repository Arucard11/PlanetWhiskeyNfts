import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Transaction, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction
} from '@solana/spl-token';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
import { getSolanaConnection } from '../../../lib/solanaUtils';

const WHISKEY_MINT = process.env.NEXT_PUBLIC_WHISKEY_MINT!;
const WHISKEY_PROGRAM_ID = new PublicKey("3GbJdAjF6Sqic84sXJHargXXQjknXVAADeKyRGv8FN2N");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            walletAddress,
            collectionName,
            collectionMintAddress,
            nftName,
            nftSymbol,
            nftUri,
            requiredWhiskeyAmount
        } = req.body;

        if (!walletAddress || !collectionName || !collectionMintAddress || !nftName || !nftSymbol || !nftUri || !requiredWhiskeyAmount) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['walletAddress', 'collectionName', 'collectionMintAddress', 'nftName', 'nftSymbol', 'nftUri', 'requiredWhiskeyAmount']
            });
        }

        console.log('🥃 Starting whiskey-gated NFT mint for:', walletAddress);
        console.log('Collection:', collectionName);
        console.log('Required WHISKEY:', requiredWhiskeyAmount);

        const connection = getSolanaConnection();
        const userPublicKey = new PublicKey(walletAddress);

        // Check if wallet has already minted from this collection (whiskey-gated limit: 1 per wallet)
        console.log('🔍 Checking if wallet has already minted from this collection...');
        try {
            const { default: dbConnect } = await import('../../../lib/mongodb');
            const { default: WalletNftPurchase } = await import('../../../models/WalletNftPurchase');
            
            await dbConnect();
            
            // Check by exact collection mint address for accurate validation
            const existingMintCount = await WalletNftPurchase.countDocuments({
                walletAddress: walletAddress,
                collectionMintAddress: collectionMintAddress
            });
            
            if (existingMintCount > 0) {
                console.log(`❌ Wallet has already minted ${existingMintCount} NFT(s) from this whiskey-gated collection`);
                return res.status(400).json({
                    error: 'Wallet has already minted from this collection. Only 1 NFT per wallet allowed for whiskey-gated collections.'
                });
            }
            
            console.log('✅ Wallet has not minted from this collection yet');
            
        } catch (dbError) {
            console.error('⚠️ Database check failed, proceeding with mint:', dbError);
            // Continue with mint if DB check fails - don't block legitimate mints
        }

        // Check user's WHISKEY balance
        const userWhiskeyAccountForBalance = getAssociatedTokenAddressSync(new PublicKey(WHISKEY_MINT), userPublicKey);
        
        try {
            const whiskeyAccountInfo = await connection.getTokenAccountBalance(userWhiskeyAccountForBalance);
            const whiskeyBalance = parseFloat((whiskeyAccountInfo.value.uiAmount || 0).toString());
            
            console.log('User WHISKEY balance:', whiskeyBalance);
            console.log('Required WHISKEY:', requiredWhiskeyAmount);

            if (whiskeyBalance < requiredWhiskeyAmount) {
                return res.status(400).json({
                    error: 'Insufficient WHISKEY balance',
                    required: requiredWhiskeyAmount,
                    current: whiskeyBalance
                });
            }
        } catch (error) {
            console.error('Error checking WHISKEY balance:', error);
            return res.status(400).json({
                error: 'User does not have a WHISKEY token account or insufficient balance'
            });
        }

        // Load the program
        const idl = await import('../../../lib/idl/whiskeyprogram.json');
        
        // Create a dummy wallet for the provider (we'll handle signing client-side)
        const dummyKeypair = Keypair.generate();
        const dummyWallet = new Wallet(dummyKeypair);
        const provider = new AnchorProvider(connection, dummyWallet, {
            commitment: 'confirmed',
            preflightCommitment: 'confirmed'
        });
        
        const program = new Program(idl as any, provider);

        // Generate NFT mint keypair
        const nftMint = Keypair.generate();
        
        // Get collection config PDA
        const [collectionConfigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("collection"), Buffer.from(collectionName)],
            WHISKEY_PROGRAM_ID
        );

        // Get token account for NFT
        const nftTokenAccount = getAssociatedTokenAddressSync(nftMint.publicKey, userPublicKey);
        
        // Get metadata PDA
        const [nftMetadataAccount] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                nftMint.publicKey.toBuffer(),
            ],
            MPL_TOKEN_METADATA_PROGRAM_ID
        );
        
        // Get master edition PDA  
        const [nftMasterEditionAccount] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("metadata"),
                MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                nftMint.publicKey.toBuffer(),
                Buffer.from("edition"),
            ],
            MPL_TOKEN_METADATA_PROGRAM_ID
        );

        console.log('🔑 Creating whiskey-gated mint transaction...');
        console.log('NFT Mint:', nftMint.publicKey.toString());
        console.log('Collection Config PDA:', collectionConfigPda.toString());

        // For whiskey-gated NFTs, use the existing mint function with 0 payment amounts
        // The program will validate that the collection has mint_price_usd = 0
        
        // Get required accounts for minting
        const userUsdcAccount = getAssociatedTokenAddressSync(
            new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC mint
            userPublicKey
        );
        const userWhiskeyAccount = getAssociatedTokenAddressSync(
            new PublicKey(WHISKEY_MINT), 
            userPublicKey
        );
        
        // Treasury accounts
        const treasuryWallet = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET!);
        const treasuryWhiskeyAccount = getAssociatedTokenAddressSync(
            new PublicKey(WHISKEY_MINT), 
            treasuryWallet
        );
        
        // Hardcoded capital vault
        const capitalVault = new PublicKey("DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs");

        // Create mint instruction with 0 payment amounts (free for whiskey-gated)
        const mintInstruction = await program.methods
            .mintWithPaymentValidation(
                nftName,
                nftSymbol,
                nftUri,
                new BN(1000000), // currentWhiskeyPriceUsd (dummy value, not used since amounts are 0)
                new BN(0), // whiskeyToTreasuryAmount (0 for free mint)
                new BN(0)  // usdcToVaultAmount (0 for free mint)
            )
            .accounts({
                user: userPublicKey,
                collectionConfig: collectionConfigPda,
                nftMint: nftMint.publicKey,
                nftTokenAccount: nftTokenAccount,
                nftMetadataAccount: nftMetadataAccount,
                nftMasterEditionAccount: nftMasterEditionAccount,
                userUsdcAccount: userUsdcAccount,
                userWhiskeyAccount: userWhiskeyAccount,
                capitalVault: capitalVault,
                treasuryWhiskeyAccount: treasuryWhiskeyAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction();

        // Create transaction
        const transaction = new Transaction();
        
        // Add ATA creation instructions if needed
        try {
            const usdcAccountInfo = await connection.getAccountInfo(userUsdcAccount);
            if (!usdcAccountInfo) {
                const createUsdcAtaIx = createAssociatedTokenAccountInstruction(
                    userPublicKey, // payer
                    userUsdcAccount, // ata
                    userPublicKey, // owner
                    new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") // USDC mint
                );
                transaction.add(createUsdcAtaIx);
            }
        } catch (error) {
            // Account doesn't exist, add creation instruction
            const createUsdcAtaIx = createAssociatedTokenAccountInstruction(
                userPublicKey, // payer
                userUsdcAccount, // ata
                userPublicKey, // owner
                new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") // USDC mint
            );
            transaction.add(createUsdcAtaIx);
        }
        
        transaction.add(mintInstruction);

        // Set recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;

        // Sign with the NFT mint keypair (server-generated)
        transaction.partialSign(nftMint);

        // Serialize transaction for client-side signing
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        console.log('✅ Whiskey-gated mint transaction created');

        res.status(200).json({
            success: true,
            transaction: Buffer.from(serializedTransaction).toString('base64'),
            nftMint: nftMint.publicKey.toString(),
            message: 'Whiskey-gated mint transaction ready for signing'
        });

    } catch (error) {
        console.error('Error creating whiskey-gated mint transaction:', error);
        res.status(500).json({
            error: 'Failed to create whiskey-gated mint transaction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
