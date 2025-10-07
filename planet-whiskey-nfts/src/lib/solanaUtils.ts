/**
 * Solana Utilities - Environment Variable Driven
 * 
 * This file ensures all program IDs and addresses come from environment variables
 * to prevent mismatches between deployed programs and frontend code.
 * 
 * Required Environment Variables:
 * - NEXT_PUBLIC_SOLANA_RPC_URL
 * - NEXT_PUBLIC_WHISKEY_PROGRAM_ID  
 * - NEXT_PUBLIC_LENDING_PROGRAM_ID
 * - NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID
 */

import { AnchorProvider, Program, type Idl, setProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

// Ensure this is the correct import for your version
// For newer @metaplex-foundation/js:
// import { Metaplex, keypairIdentity, bundlrStorage } from "@metaplex-foundation/js";
// For older mpl-token-metadata directly (if that's what you use for constants):

import idlJson from './idl/whiskeyprogram.json';
import { Whiskeyprogram } from './idl/whiskeyprogram';
import { Marketplaceprogram } from './idl/marketplaceprogram'; // Use consistent naming
import marketplaceIdl from './idl/marketplaceprogram.json'; // Use consistent naming


// Marketplace program ID validation moved to top-level validation


// REMOVED: Server-side admin wallet operations - All admin operations now require client-side wallet signing
// Admin wallet address is hardcoded in Rust programs: F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X

// Environment variable validation - no fallbacks to prevent mismatches
if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
  throw new Error('NEXT_PUBLIC_SOLANA_RPC_URL is not set in .env.local');
}
if (!process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID) {
  throw new Error('NEXT_PUBLIC_WHISKEY_PROGRAM_ID is not set in .env.local');
}
if (!process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID) {
  throw new Error('NEXT_PUBLIC_LENDING_PROGRAM_ID is not set in .env.local');
}
if (!process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID) {
  throw new Error('NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID is not set in .env.local');
}

const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID);

export function getSolanaConnection() {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

export function getAnchorProvider(walletKeypair?: Keypair) {
  const connection = getSolanaConnection();
  
  if (!walletKeypair) {
    throw new Error('Cannot create AnchorProvider: No keypair provided. Admin operations require client-side wallet signing.');
  }

  const provider = new AnchorProvider(
    connection,
    // This is a placeholder wallet that AnchorProvider requires.
    // For server-side operations where you sign with a Keypair, this Wallet implementation is sufficient.
    // For client-side, you'd use the WalletAdapter.
    { 
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => { 
        if (tx instanceof Transaction) {
          tx.partialSign(walletKeypair);
        }
        return tx; 
      },
      signAllTransactions: async (txs) => {
        txs.forEach(tx => {
          if (tx instanceof Transaction) {
            tx.partialSign(walletKeypair);
          }
        });
        return txs;
      }
    },
    AnchorProvider.defaultOptions()
  );
  return provider;
}

export function getSolanaProgram(provider: AnchorProvider) {
  setProvider(provider);
  // Always use the environment variable program ID to ensure consistency
  const programId = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!);
  
  // Create a working IDL by ensuring correct program ID
  const workingIdl = {
    ...idlJson,
    address: programId.toString(), // Ensure IDL has correct program ID
    // Keep accounts section for proper account decoding
  };
  
  const program = new Program(workingIdl as any, provider);
  return program as unknown as Program<Whiskeyprogram>;
}

// New function for getting the marketplace program
export function getMarketplaceProgram(provider?: AnchorProvider) {
    // Create a camelCase version of the IDL to match the TypeScript interface
    const patchedIdl: any = JSON.parse(JSON.stringify(marketplaceIdl)); // Deep copy to ensure we have a mutable object
    
    // Convert snake_case instruction names to camelCase
    if (patchedIdl.instructions) {
        patchedIdl.instructions = patchedIdl.instructions.map((instruction: any) => {
            const camelCaseInstruction = { ...instruction };
            // Convert instruction names
            if (instruction.name === 'buy_nft') camelCaseInstruction.name = 'buyNft';
            if (instruction.name === 'list_nft') camelCaseInstruction.name = 'listNft';
            if (instruction.name === 'cancel_listing') camelCaseInstruction.name = 'cancelListing';
            
            // Keep account names in snake_case to match the deployed program
            // Only convert instruction names to camelCase for TypeScript interface
            return camelCaseInstruction;
        });
    }
    
    console.log("DEBUG: Initializing marketplace program...");
    console.log("DEBUG: IDL Address:", patchedIdl.address);
    console.log("DEBUG: ENV Program ID:", process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID);
    console.log("DEBUG: Instructions:", patchedIdl.instructions?.map((i: any) => i.name));

    const listingAccount = patchedIdl.accounts?.find((a: any) => a.name === 'MarketplaceListing' || a.name === 'marketplaceListing');
    
    if (listingAccount) {
        console.log("DEBUG: Found 'MarketplaceListing' account. Current size:", listingAccount.size);
        if (!listingAccount.size) {
            // Size = 8 (discriminator) + 32 (seller) + 32 (nft_mint) + 8 (price) + 1 (bump)
            listingAccount.size = 81; 
            console.log("SUCCESS: Patched marketplace IDL with size for 'MarketplaceListing' account.");
        } else {
            console.log("INFO: 'MarketplaceListing' account already has size property.");
        }
    } else {
        console.error("CRITICAL: Could not find 'MarketplaceListing' in the IDL. Transaction will fail.");
    }

    // Use the environment variable program ID instead of the IDL address
    const programId = new PublicKey(process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID!);
    // Override the IDL address with the environment variable
    patchedIdl.address = programId.toBase58();
    
    // If no provider is given, create a read-only provider without requiring a wallet
    let finalProvider = provider;
    if (!provider) {
        const connection = getSolanaConnection();
        // Create a dummy wallet for the provider that won't be used for signing
        const dummyKeypair = Keypair.generate();
        finalProvider = new AnchorProvider(
            connection,
            {
                publicKey: dummyKeypair.publicKey,
                signTransaction: async (tx) => { throw new Error('This provider is read-only'); },
                signAllTransactions: async (txs) => { throw new Error('This provider is read-only'); }
            },
            AnchorProvider.defaultOptions()
        );
    }
    
    const program = new Program(patchedIdl, finalProvider);
    console.log("DEBUG: Marketplace program initialized successfully with program ID:", programId.toBase58());
    return program as unknown as Program<Marketplaceprogram>;
}

// REMOVED: getAdminSolanaProgram - All admin operations now require client-side wallet signing

// New function for getting the lending program
export function getLendingProgram(provider: AnchorProvider) {
  setProvider(provider);
  
  // Import the lending IDL
  const lendingIdlRaw = require('./idl/lendingprogram.json');
  
  // Create a camelCase version of the IDL to match the TypeScript interface
  const patchedIdl: any = JSON.parse(JSON.stringify(lendingIdlRaw)); // Deep copy
  
  // Convert snake_case instruction names to camelCase
  if (patchedIdl.instructions) {
    patchedIdl.instructions = patchedIdl.instructions.map((instruction: any) => {
      const camelCaseInstruction = { ...instruction };
      // Convert instruction names
      if (instruction.name === 'deposit_nft') camelCaseInstruction.name = 'depositNft';
      
      // Convert account names to camelCase for TypeScript interface
      if (camelCaseInstruction.accounts) {
        camelCaseInstruction.accounts = camelCaseInstruction.accounts.map((account: any) => {
          const camelCaseAccount = { ...account };
          // Convert account names from snake_case to camelCase
          if (account.name === 'global_market') camelCaseAccount.name = 'globalMarket';
          if (account.name === 'borrower_account') camelCaseAccount.name = 'borrowerAccount';
          if (account.name === 'nft_mint') camelCaseAccount.name = 'nftMint';
          if (account.name === 'user_nft_account') camelCaseAccount.name = 'userNftAccount';
          if (account.name === 'nft_escrow') camelCaseAccount.name = 'nftEscrow';
          if (account.name === 'nft_metadata') camelCaseAccount.name = 'nftMetadata';
          if (account.name === 'token_metadata_program') camelCaseAccount.name = 'tokenMetadataProgram';
          if (account.name === 'token_program') camelCaseAccount.name = 'tokenProgram';
          if (account.name === 'associated_token_program') camelCaseAccount.name = 'associatedTokenProgram';
          if (account.name === 'system_program') camelCaseAccount.name = 'systemProgram';
          return camelCaseAccount;
        });
      }
      
      return camelCaseInstruction;
    });
  }
  
  console.log("DEBUG: Initializing lending program...");
  console.log("DEBUG: IDL Address:", patchedIdl.address);
  console.log("DEBUG: Instructions:", patchedIdl.instructions?.map((i: any) => i.name));

  // Use the lending program ID from environment variables
  const programId = new PublicKey(process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!);
  // Override the IDL address with the program ID
  patchedIdl.address = programId.toBase58();
  
  const program = new Program(patchedIdl, provider);
  console.log("DEBUG: Lending program initialized successfully with program ID:", programId.toBase58());
  return program as unknown as Program<any>;
} 