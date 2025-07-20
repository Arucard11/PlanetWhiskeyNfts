import { AnchorProvider, Program, type Idl, setProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

// Ensure this is the correct import for your version
// For newer @metaplex-foundation/js:
// import { Metaplex, keypairIdentity, bundlrStorage } from "@metaplex-foundation/js";
// For older mpl-token-metadata directly (if that's what you use for constants):
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata'; // Verify this constant's source and type

import idlJson from './idl/whiskeyprogram.json';
import { Whiskeyprogram } from './idl/solana_program';
import { Marketplaceprogram } from './idl/marketplaceprogram'; // Use consistent naming
import marketplaceIdl from './idl/marketplaceprogram.json'; // Use consistent naming


if (!process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID) {
  throw new Error('NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID is not set in the environment.');
}
const marketplaceProgramId = new PublicKey(process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID);


// TODO: Consider how to securely handle the admin keypair for server-side operations.
// Loading from env var directly is okay for local dev, but not recommended for production.
const ADMIN_PRIVATE_KEY_STRING = process.env.ADMIN_WALLET_PRIVATE_KEY;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'; // Fallback to Devnet
// export const PROGRAM_ID = new PublicKey("FBaH26DJD6evcq2JHx9eR5dVjqYWZ3PPxBUwJuF1fMPQ"); // OLD Original ID
// export const PROGRAM_ID = new PublicKey("8a6q5zqTSnt931AoVh56zkaCq3ED8J2WVX5PBTLxr8gb"); // OLD New ID
export const PROGRAM_ID = new PublicKey("8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L"); // ACTUAL DEPLOYED ID

const ADMIN_WALLET_PATH = "~/.config/solana/admin-keypair.json";

if (!SOLANA_RPC_URL) {
  // This check is now somewhat redundant due to the fallback, but good for explicit erroring if needed.
  throw new Error('SOLANA_RPC_URL is not set in .env.local');
}

export let adminKeypair: Keypair | undefined;
if (ADMIN_PRIVATE_KEY_STRING) {
  try {
    adminKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(ADMIN_PRIVATE_KEY_STRING)));
  } catch (error) {
    console.error('Failed to parse ADMIN_WALLET_PRIVATE_KEY:', error);
  }
} else {
  // Fallback to reading from file path
  try {
    // Only try to read file in Node.js environment (not in browser)
    if (typeof window === 'undefined') {
      const fs = require('fs');
      const os = require('os');
      const expandedPath = ADMIN_WALLET_PATH.replace('~', os.homedir());
      if (fs.existsSync(expandedPath)) {
        const keypairData = JSON.parse(fs.readFileSync(expandedPath, 'utf8'));
        adminKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
        console.log('Admin keypair loaded from file path:', expandedPath);
      } else {
        console.warn(`ADMIN_WALLET_PRIVATE_KEY not set and keypair file not found at: ${expandedPath}`);
      }
    } else {
      console.warn('ADMIN_WALLET_PRIVATE_KEY not set. Admin operations will not be possible.');
    }
  } catch (error) {
    console.error('Failed to load admin keypair from file:', error);
  }
}

export function getSolanaConnection() {
  return new Connection(SOLANA_RPC_URL!, 'confirmed');
}

export function getAnchorProvider(walletKeypair?: Keypair) {
  const connection = getSolanaConnection();
  const keypairToUse = walletKeypair || adminKeypair;

  if (!keypairToUse) {
    throw new Error('Cannot create AnchorProvider: No keypair provided and admin keypair is not available.');
  }

  const provider = new AnchorProvider(
    connection,
    // This is a placeholder wallet that AnchorProvider requires.
    // For server-side operations where you sign with a Keypair, this Wallet implementation is sufficient.
    // For client-side, you'd use the WalletAdapter.
    { 
      publicKey: keypairToUse.publicKey,
      signTransaction: async (tx) => { 
        if (tx instanceof Transaction) {
          tx.partialSign(keypairToUse);
        }
        // For VersionedTransaction, signing is usually done differently, often outside this simple wallet structure
        // or by converting to a legacy transaction if appropriate and supported by the libs in use.
        // If VersionedTransactions are expected and need signing, this part needs more robust handling.
        return tx; 
      },
      signAllTransactions: async (txs) => {
        txs.forEach(tx => {
          if (tx instanceof Transaction) {
            tx.partialSign(keypairToUse);
          }
          // See comment in signTransaction for VersionedTransaction handling
        });
        return txs;
      }
    },
    AnchorProvider.defaultOptions()
  );
  return provider;
}

export function getSolanaProgram(provider?: AnchorProvider) {
  if (!provider) {
    provider = getAnchorProvider();
  }
  setProvider(provider);
  const program = new Program(idlJson as any, provider);
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
    const program = new Program(patchedIdl, provider || getAnchorProvider());
    console.log("DEBUG: Marketplace program initialized successfully with program ID:", programId.toBase58());
    return program as unknown as Program<Marketplaceprogram>;
}

export function getAdminSolanaProgram() {
  const provider = getAnchorProvider(adminKeypair);
  // The program ID will be derived from the IDL's address field
  // Ensure idlJson.address is correctly set in your whiskeyprogram.json
  return new Program<Whiskeyprogram>(idlJson as any, provider);
} 