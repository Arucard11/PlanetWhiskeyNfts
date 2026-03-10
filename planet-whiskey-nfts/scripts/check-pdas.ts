import path from 'path';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import dotenv from 'dotenv';

// Load environment (defaults to .env.local if present)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_WHISKEY_PROGRAM_ID',
  'NEXT_PUBLIC_WHISKEY_MINT',
  'NEXT_PUBLIC_USDC_MINT',
  'NEXT_PUBLIC_TREASURY_WALLET',
  'NEXT_PUBLIC_CAPITAL_VAULT_PDA',
];

function reqEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function toPk(value: string, label: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch (error) {
    throw new Error(`Invalid public key for ${label}: ${error}`);
  }
}

// CLI args
const getArg = (flag: string): string | undefined => {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
};

const collectionName = getArg('--collection');
const collectionMintArg = getArg('--collection-mint');
const walletArg = getArg('--wallet');

async function main() {
  // Validate env upfront
  REQUIRED_ENV_VARS.forEach(reqEnv);

  const rpcUrl = reqEnv('NEXT_PUBLIC_SOLANA_RPC_URL');
  const connection = new Connection(rpcUrl, 'confirmed');

  const whiskeyProgramId = toPk(reqEnv('NEXT_PUBLIC_WHISKEY_PROGRAM_ID'), 'whiskey program id');
  const whiskeyMint = toPk(reqEnv('NEXT_PUBLIC_WHISKEY_MINT'), 'whiskey mint');
  const usdcMint = toPk(reqEnv('NEXT_PUBLIC_USDC_MINT'), 'usdc mint');
  const treasuryWallet = toPk(reqEnv('NEXT_PUBLIC_TREASURY_WALLET'), 'treasury wallet');
  const capitalVaultEnv = toPk(reqEnv('NEXT_PUBLIC_CAPITAL_VAULT_PDA'), 'capital vault pda');

  // On-chain hardcoded capital vault constant from Rust program
  const capitalVaultConst = new PublicKey('AV57aXNBM4atTo4EyuX6C1mRQLpFK671RfCoPxPS1wZK');

  console.log('=== Address sanity checks ===');
  console.log('Whiskey Program ID:', whiskeyProgramId.toBase58());
  console.log('Capital Vault (env):', capitalVaultEnv.toBase58());
  console.log('Capital Vault (on-chain constant):', capitalVaultConst.toBase58());
  console.log('Capital vault matches constant:', capitalVaultEnv.equals(capitalVaultConst) ? '✅' : '❌');
  console.log('');

  // Treasury WHISKEY ATA
  const treasuryWhiskeyAta = getAssociatedTokenAddressSync(whiskeyMint, treasuryWallet);
  console.log('Treasury wallet:', treasuryWallet.toBase58());
  console.log('Treasury WHISKEY ATA:', treasuryWhiskeyAta.toBase58());

  // Capital vault account info
  const capitalVaultInfo = await connection.getAccountInfo(capitalVaultEnv);
  console.log('');
  if (capitalVaultInfo) {
    console.log('Capital vault account exists: ✅');
    console.log('Owner program:', capitalVaultInfo.owner.toBase58());
    console.log('Data length:', capitalVaultInfo.data.length);
  } else {
    console.log('Capital vault account exists: ❌ (no account data)');
  }

  // Optional: collection config PDA (requires collection name)
  if (collectionName) {
    const [collectionConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), Buffer.from(collectionName)],
      whiskeyProgramId
    );
    console.log('');
    console.log('Collection name:', collectionName);
    console.log('CollectionConfig PDA:', collectionConfigPda.toBase58());

    const collectionInfo = await connection.getAccountInfo(collectionConfigPda);
    console.log('CollectionConfig account exists:', collectionInfo ? '✅' : '❌');
  } else {
    console.log('');
    console.log('CollectionConfig PDA: skipped (pass --collection "<name>")');
  }

  // Optional: wallet counter PDA (requires collection mint + wallet)
  if (walletArg && collectionMintArg) {
    const walletPk = toPk(walletArg, 'wallet');
    const collectionMintPk = toPk(collectionMintArg, 'collection mint');
    const [walletCounterPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('wallet_counter'),
        walletPk.toBuffer(),
        collectionMintPk.toBuffer(),
      ],
      whiskeyProgramId
    );
    console.log('');
    console.log('Wallet counter seeds:');
    console.log('  wallet:', walletPk.toBase58());
    console.log('  collection mint:', collectionMintPk.toBase58());
    console.log('Wallet counter PDA:', walletCounterPda.toBase58());

    const walletCounterInfo = await connection.getAccountInfo(walletCounterPda);
    console.log('Wallet counter account exists:', walletCounterInfo ? '✅' : '❌');
  } else {
    console.log('');
    console.log('Wallet counter PDA: skipped (pass --wallet <pubkey> --collection-mint <pubkey>)');
  }

  // Sanity: show mint addresses
  console.log('');
  console.log('WHISKEY mint:', whiskeyMint.toBase58());
  console.log('USDC mint:', usdcMint.toBase58());
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});







