const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

async function main() {
    console.log('🚀 Simple Lending Program Initialization...');
    
    // Load environment
    require('dotenv').config({ path: './devnet-complete-environment.env' });
    
    // Connection setup
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load admin keypair
    const adminKeypairData = JSON.parse(fs.readFileSync('/home/arucard/.config/solana/admin-keypair.json', 'utf8'));
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
    
    console.log('📋 Admin wallet:', adminKeypair.publicKey.toString());
    
    // Program IDs
    const LENDING_PROGRAM_ID = new PublicKey('DDy97mgfJ6pkGzF4KdaVVXpKkVFFBgn4EGdZ7EbrH5rB');
    const USDC_MINT = new PublicKey('4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP');
    const TREASURY_WALLET = new PublicKey('2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk');
    
    console.log('🏦 Program ID:', LENDING_PROGRAM_ID.toString());
    
    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_market')],
        LENDING_PROGRAM_ID
    );
    
    const [collectionRegistryV2Pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_registry_v2')], 
        LENDING_PROGRAM_ID
    );
    
    const [capitalVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('capital_vault_usdc')],
        LENDING_PROGRAM_ID
    );
    
    console.log('📍 PDAs calculated:');
    console.log('├─ Global Market:', globalMarketPda.toString());
    console.log('├─ Collection Registry V2:', collectionRegistryV2Pda.toString());
    console.log('└─ Capital Vault:', capitalVaultPda.toString());
    
    // Load the program IDL
    let idl;
    try {
        idl = JSON.parse(fs.readFileSync('./target/idl/lendingprogram.json', 'utf8'));
        console.log('✅ IDL loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load IDL:', error.message);
        return;
    }
    
    // Create provider
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    
    // Create program instance
    let program;
    try {
        program = new anchor.Program(idl, provider);
        console.log('✅ Program instance created');
    } catch (error) {
        console.error('❌ Failed to create program:', error.message);
        console.log('IDL accounts section:', JSON.stringify(idl.accounts, null, 2));
        return;
    }
    
    // Check if accounts exist
    try {
        const globalMarketAccount = await connection.getAccountInfo(globalMarketPda);
        const registryAccount = await connection.getAccountInfo(collectionRegistryV2Pda);
        const vaultAccount = await connection.getAccountInfo(capitalVaultPda);
        
        console.log('\\n📊 Account Status:');
        console.log('├─ Global Market:', globalMarketAccount ? '✅ EXISTS' : '❌ MISSING');
        console.log('├─ Collection Registry V2:', registryAccount ? '✅ EXISTS' : '❌ MISSING');
        console.log('└─ Capital Vault:', vaultAccount ? '✅ EXISTS' : '❌ MISSING');
        
        if (!globalMarketAccount || !registryAccount || !vaultAccount) {
            console.log('\\n🔧 Accounts need to be initialized. Run initialization commands manually.');
        } else {
            console.log('\\n🎉 All accounts are initialized!');
        }
        
    } catch (error) {
        console.error('❌ Error checking accounts:', error.message);
    }
}

main().catch(console.error);
