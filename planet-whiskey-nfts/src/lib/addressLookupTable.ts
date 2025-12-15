import {
  Connection,
  PublicKey,
  AddressLookupTableProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  Keypair,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// NOTE: For Next.js, env vars with NEXT_PUBLIC_ must be accessed statically
// (process.env.NEXT_PUBLIC_...) so the bundler can inline them. Dynamic
// indexing like process.env[envName] will always be undefined in the browser.

const WHISKEY_PROGRAM_ID = process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!;
const TREASURY_WALLET = process.env.NEXT_PUBLIC_TREASURY_WALLET!;
const WHISKEY_MINT = process.env.NEXT_PUBLIC_WHISKEY_MINT!;
const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT!;
const CAPITAL_VAULT_PDA = process.env.NEXT_PUBLIC_CAPITAL_VAULT_PDA!;

// Common addresses used in minting transactions
export const MINTING_COMMON_ADDRESSES = [
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'), // MPL Token Metadata Program
  new PublicKey('11111111111111111111111111111111'), // System Program
  new PublicKey('SysvarRent111111111111111111111111111111111'), // Rent Sysvar
  new PublicKey(WHISKEY_PROGRAM_ID), // Whiskey Program
  new PublicKey(TREASURY_WALLET), // Treasury Wallet
  new PublicKey(WHISKEY_MINT), // WHISKEY Token Mint
  new PublicKey(USDC_MINT), // USDC Token Mint
  new PublicKey(CAPITAL_VAULT_PDA), // Capital Vault (must match on-chain constant)
];

export interface AddressLookupTableInfo {
  address: PublicKey;
  account: AddressLookupTableAccount;
}

/**
 * Creates a new Address Lookup Table for minting transactions
 */
export async function createMintingLookupTable(
  connection: Connection,
  payer: Keypair
): Promise<{ instruction: TransactionInstruction; address: PublicKey }> {
  const slot = await connection.getSlot();
  
  const [createLookupTableInstruction, lookupTableAddress] = 
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: slot,
    });

  console.log('📋 Created lookup table address:', lookupTableAddress.toBase58());
  
  return {
    instruction: createLookupTableInstruction,
    address: lookupTableAddress
  };
}

/**
 * Extends an existing Address Lookup Table with common minting addresses
 */
export function extendMintingLookupTable(
  lookupTableAddress: PublicKey,
  authority: PublicKey,
  payer: PublicKey,
  additionalAddresses: PublicKey[] = []
): TransactionInstruction {
  const allAddresses = [...MINTING_COMMON_ADDRESSES, ...additionalAddresses];
  
  return AddressLookupTableProgram.extendLookupTable({
    payer: payer,
    authority: authority,
    lookupTable: lookupTableAddress,
    addresses: allAddresses,
  });
}

/**
 * Fetches an Address Lookup Table account from the blockchain
 */
export async function fetchLookupTable(
  connection: Connection,
  lookupTableAddress: PublicKey
): Promise<AddressLookupTableAccount | null> {
  try {
    const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress);
    return lookupTableAccount.value;
  } catch (error) {
    console.error('Error fetching lookup table:', error);
    return null;
  }
}

/**
 * Creates a versioned transaction using address lookup tables
 */
export async function createVersionedTransaction(
  connection: Connection,
  instructions: TransactionInstruction[],
  payer: PublicKey,
  lookupTableAccounts: AddressLookupTableAccount[] = []
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash();
  
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: instructions,
  }).compileToV0Message(lookupTableAccounts);

  return new VersionedTransaction(messageV0);
}

/**
 * Checks if a lookup table is ready to use (addresses have been added and activated)
 */
export async function isLookupTableReady(
  connection: Connection,
  lookupTableAddress: PublicKey
): Promise<boolean> {
  try {
    const lookupTableAccount = await fetchLookupTable(connection, lookupTableAddress);
    if (!lookupTableAccount) return false;
    
    // Check if the table has addresses and is not deactivated
    return lookupTableAccount.state.addresses.length > 0 && 
           lookupTableAccount.state.deactivationSlot === undefined;
  } catch (error) {
    console.error('Error checking lookup table readiness:', error);
    return false;
  }
}

/**
 * Gets the stored lookup table address from environment or creates a new one
 */
export function getMintingLookupTableAddress(): PublicKey | null {
  const address = process.env.NEXT_PUBLIC_MINTING_LOOKUP_TABLE_ADDRESS;
  if (address) {
    try {
      return new PublicKey(address);
    } catch (error) {
      console.error('Invalid lookup table address in environment:', error);
    }
  }
  return null;
}

/**
 * Utility to log lookup table contents for debugging
 */
export async function debugLookupTable(
  connection: Connection,
  lookupTableAddress: PublicKey
): Promise<void> {
  const lookupTableAccount = await fetchLookupTable(connection, lookupTableAddress);
  
  if (!lookupTableAccount) {
    console.log('❌ Lookup table not found');
    return;
  }
  
  console.log('📋 Lookup Table Debug Info:');
  console.log('Address:', lookupTableAccount.key.toBase58());
  console.log('Authority:', lookupTableAccount.state.authority?.toBase58());
  console.log('Deactivation Slot:', lookupTableAccount.state.deactivationSlot);
  console.log('Last Extended Slot:', lookupTableAccount.state.lastExtendedSlot);
  console.log('Total Addresses:', lookupTableAccount.state.addresses.length);
  
  console.log('Stored Addresses:');
  lookupTableAccount.state.addresses.forEach((address, index) => {
    console.log(`  ${index}: ${address.toBase58()}`);
  });
}
