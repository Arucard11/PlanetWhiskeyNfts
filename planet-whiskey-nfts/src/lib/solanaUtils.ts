import { AnchorProvider, Program, type Idl, setProvider } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
// Ensure this is the correct import for your version
// For newer @metaplex-foundation/js:
// import { Metaplex, keypairIdentity, bundlrStorage } from "@metaplex-foundation/js";
// For older mpl-token-metadata directly (if that's what you use for constants):
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata'; // Verify this constant's source and type

import idlJson from './idl/whiskeyprogram.json';
import { Whiskeyprogram } from './idl/solana_program';

// TODO: Consider how to securely handle the admin keypair for server-side operations.
// Loading from env var directly is okay for local dev, but not recommended for production.
const ADMIN_PRIVATE_KEY_STRING = process.env.ADMIN_WALLET_PRIVATE_KEY;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;
// export const PROGRAM_ID = new PublicKey("FBaH26DJD6evcq2JHx9eR5dVjqYWZ3PPxBUwJuF1fMPQ"); // OLD Original ID
// export const PROGRAM_ID = new PublicKey("8a6q5zqTSnt931AoVh56zkaCq3ED8J2WVX5PBTLxr8gb"); // OLD New ID
export const PROGRAM_ID = new PublicKey("8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L"); // ACTUAL DEPLOYED ID

const ADMIN_WALLET_PATH = "~/.config/solana/admin-keypair.json";

if (!SOLANA_RPC_URL) {
  throw new Error('SOLANA_RPC_URL is not set in .env.local');
}

let adminKeypair: Keypair | undefined;
if (ADMIN_PRIVATE_KEY_STRING) {
  try {
    adminKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(ADMIN_PRIVATE_KEY_STRING)));
  } catch (error) {
    console.error('Failed to parse ADMIN_WALLET_PRIVATE_KEY:', error);
    // Decide if this should be a fatal error or if some operations can proceed without admin
  }
} else {
  console.warn('ADMIN_WALLET_PRIVATE_KEY is not set. Admin operations will not be possible.');
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
  const anchorProvider = provider || getAnchorProvider(); // Uses admin keypair by default if no provider given
  // The program ID will be derived from the IDL's address field
  return new Program<Whiskeyprogram>(idlJson as any, anchorProvider);
}

// Optional: A specific function to get program instance with admin wallet
export function getAdminSolanaProgram() {
  // The program ID will be derived from the IDL's address field
  // Ensure idlJson.address is correctly set in your whiskeyprogram.json
  return new Program<Whiskeyprogram>(idlJson as any, getAnchorProvider());
}

export { adminKeypair }; // Export for any other direct use if needed 

export async function createCollectionOnChain(
  provider: AnchorProvider,
  program: Program<Whiskeyprogram>,
  // ... existing code ...
) {
  // ... existing code ...
} 