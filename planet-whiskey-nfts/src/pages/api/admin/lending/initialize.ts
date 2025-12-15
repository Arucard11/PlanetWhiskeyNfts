import { NextApiRequest, NextApiResponse } from 'next';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import lendingIdl from '../../../../lib/idl/lendingprogram.json';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const LENDING_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const ADMIN_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const TREASURY_WALLET = new PublicKey('F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X');
const LIQUIDATION_AUTHORITY = new PublicKey('8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    
    // Load admin keypair from environment or use a secure method
    // For now, we'll require the admin to sign via wallet
    // This endpoint should be called from the frontend with wallet connection
    
    const { adminKeypairBase64 } = req.body;
    
    if (!adminKeypairBase64) {
      return res.status(400).json({ 
        error: 'Admin keypair required. This should be called from the admin panel with wallet connected.' 
      });
    }

    // Decode keypair (in production, use a more secure method)
    const adminKeypair = Keypair.fromSecretKey(
      Buffer.from(adminKeypairBase64, 'base64')
    );

    if (!adminKeypair.publicKey.equals(ADMIN_WALLET)) {
      return res.status(403).json({ error: 'Unauthorized: Not the admin wallet' });
    }

    // Setup Anchor provider
    const wallet = new anchor.Wallet(adminKeypair);
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Create program instance
    const program = new anchor.Program(lendingIdl as anchor.Idl, provider) as any;

    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_market')],
      LENDING_PROGRAM_ID
    );

    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection_registry_v2')],
      LENDING_PROGRAM_ID
    );

    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('capital_vault_usdc')],
      LENDING_PROGRAM_ID
    );

    const results: any = {};

    // Step 1: Initialize Collection Registry V2
    try {
      const regInfo = await connection.getAccountInfo(collectionRegistryPda);
      if (!regInfo) {
        const tx1 = await program.methods
          .initializeCollectionRegistryV2()
          .accounts({
            collectionRegistry: collectionRegistryPda,
            authority: adminKeypair.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        results.collectionRegistry = { success: true, tx: tx1 };
      } else {
        results.collectionRegistry = { success: true, message: 'Already exists' };
      }
    } catch (error: any) {
      results.collectionRegistry = { 
        success: false, 
        error: error.message 
      };
    }

    // Step 2: Initialize Global Market
    try {
      const marketInfo = await connection.getAccountInfo(globalMarketPda);
      if (!marketInfo) {
        const tx2 = await program.methods
          .initializeGlobalMarket(
            new anchor.BN(5000), // maxStakedNfts
            new anchor.BN(100000000), // perNftValueUsd (100 USD in micro-dollars)
            LIQUIDATION_AUTHORITY
          )
          .accounts({
            globalMarket: globalMarketPda,
            collectionRegistry: collectionRegistryPda,
            owner: adminKeypair.publicKey,
            capitalVaultUsdc: capitalVaultPda,
            treasuryWallet: TREASURY_WALLET,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        results.globalMarket = { success: true, tx: tx2 };
      } else {
        results.globalMarket = { success: true, message: 'Already exists' };
      }
    } catch (error: any) {
      results.globalMarket = { 
        success: false, 
        error: error.message 
      };
    }

    // Step 3: Initialize Capital Vault
    try {
      const vaultInfo = await connection.getAccountInfo(capitalVaultPda);
      if (!vaultInfo) {
        const tx3 = await program.methods
          .initializeCapitalVault()
          .accounts({
            admin: adminKeypair.publicKey,
            globalMarket: globalMarketPda,
            capitalVault: capitalVaultPda,
            usdcMint: USDC_MINT,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .rpc();
        results.capitalVault = { success: true, tx: tx3 };
      } else {
        results.capitalVault = { success: true, message: 'Already exists' };
      }
    } catch (error: any) {
      results.capitalVault = { 
        success: false, 
        error: error.message 
      };
    }

    return res.status(200).json({
      success: true,
      results,
      pdas: {
        globalMarket: globalMarketPda.toString(),
        collectionRegistry: collectionRegistryPda.toString(),
        capitalVault: capitalVaultPda.toString(),
      }
    });

  } catch (error: any) {
    console.error('Initialization error:', error);
    return res.status(500).json({
      error: 'Initialization failed',
      details: error.message
    });
  }
}







