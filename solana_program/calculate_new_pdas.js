
const { PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey('CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1');

const [globalMarketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('global_market')],
    PROGRAM_ID
);

const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection_registry')],
    PROGRAM_ID
);

const [capitalVaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('capital_vault_usdc')],
    PROGRAM_ID
);

console.log('NEXT_PUBLIC_GLOBAL_MARKET=' + globalMarketPda.toString());
console.log('NEXT_PUBLIC_COLLECTION_REGISTRY=' + collectionRegistryPda.toString());
console.log('NEXT_PUBLIC_CAPITAL_VAULT_PDA=' + capitalVaultPda.toString());







