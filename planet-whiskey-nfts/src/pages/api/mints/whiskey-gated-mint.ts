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
        let whiskeyBalance = 0;
        
        try {
            const whiskeyAccountInfo = await connection.getTokenAccountBalance(userWhiskeyAccountForBalance);
            whiskeyBalance = parseFloat((whiskeyAccountInfo.value.uiAmount || 0).toString());
            
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

        // For whiskey-gated collections, we'll use a simplified approach
        // Just validate the requirements and return success - let the frontend handle the actual minting
        console.log('✅ Whiskey-gated mint validation passed');
        console.log('User has sufficient WHISKEY balance and has not minted before');

        res.status(200).json({
            success: true,
            message: 'Whiskey-gated mint validation successful',
            validated: true,
            userWhiskeyBalance: whiskeyBalance,
            requiredWhiskeyAmount: requiredWhiskeyAmount
        });

    } catch (error) {
        console.error('Error creating whiskey-gated mint transaction:', error);
        res.status(500).json({
            error: 'Failed to create whiskey-gated mint transaction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
