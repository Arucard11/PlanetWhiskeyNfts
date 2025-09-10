const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const fs = require('fs');

async function main() {
    console.log('🚀 Final Complete Lending Program Initialization...');
    
    // Connection setup
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Load admin keypair
    const adminKeypairData = JSON.parse(fs.readFileSync('/home/arucard/.config/solana/admin-keypair.json', 'utf8'));
    const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
    
    console.log('📋 Admin wallet:', adminKeypair.publicKey.toString());
    
    // Program IDs and constants
    const LENDING_PROGRAM_ID = new PublicKey('DDy97mgfJ6pkGzF4KdaVVXpKkVFFBgn4EGdZ7EbrH5rB');
    const USDC_MINT = new PublicKey('4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP');
    const TREASURY_WALLET = new PublicKey('2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk');
    
    // Calculate PDAs
    const [globalMarketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_market')],
        LENDING_PROGRAM_ID
    );
    
    const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('collection_registry')], // OLD REGISTRY!
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
    
    console.log('📍 PDAs:');
    console.log('├─ Global Market:', globalMarketPda.toString());
    console.log('├─ Collection Registry (OLD):', collectionRegistryPda.toString());
    console.log('├─ Collection Registry V2:', collectionRegistryV2Pda.toString());
    console.log('└─ Capital Vault:', capitalVaultPda.toString());
    
    // Load IDL and create program
    const idl = JSON.parse(fs.readFileSync('./target/idl/lendingprogram.json', 'utf8'));
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(adminKeypair), { commitment: 'confirmed' });
    const program = new anchor.Program(idl, provider);
    
    try {
        // 1. Initialize Global Market (this will create both global market AND old collection registry)
        console.log('\\n🏗️  Step 1: Initializing Global Market + Old Collection Registry...');
        
        try {
            const tx1 = await program.methods
                .initializeGlobalMarket(
                    10000, // max_staked_nfts
                    new anchor.BN(1000000) // per_nft_value_usd (1 USD in micro-dollars)
                )
                .accounts({
                    globalMarket: globalMarketPda,
                    collectionRegistry: collectionRegistryPda, // OLD REGISTRY
                    owner: adminKeypair.publicKey,
                    capitalVaultUsdc: capitalVaultPda,
                    treasuryWallet: TREASURY_WALLET,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([adminKeypair])
                .rpc();
            
            console.log('✅ Global Market + Old Registry initialized! Signature:', tx1);
        } catch (error) {
            if (error.message.includes('already in use')) {
                console.log('⚠️  Global Market already exists');
            } else {
                console.log('❌ Global Market error:', error.message);
            }
        }
        
        // 2. Initialize Capital Vault
        console.log('\\n🏗️  Step 2: Initializing Capital Vault...');
        
        try {
            const tx2 = await program.methods
                .initializeCapitalVault()
                .accounts({
                    admin: adminKeypair.publicKey,
                    globalMarket: globalMarketPda,
                    capitalVault: capitalVaultPda,
                    usdcMint: USDC_MINT,
                    tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                    systemProgram: anchor.web3.SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([adminKeypair])
                .rpc();
            
            console.log('✅ Capital Vault initialized! Signature:', tx2);
        } catch (error) {
            if (error.message.includes('already in use')) {
                console.log('⚠️  Capital Vault already exists');
            } else {
                console.log('❌ Capital Vault error:', error.message);
            }
        }
        
        // 3. Check Collection Registry V2 (already exists from previous run)
        console.log('\\n🏗️  Step 3: Checking Collection Registry V2...');
        const registryV2Account = await connection.getAccountInfo(collectionRegistryV2Pda);
        if (registryV2Account) {
            console.log('✅ Collection Registry V2 already exists');
        } else {
            console.log('⚠️  Collection Registry V2 missing - need to initialize');
        }
        
        // 4. Verify all accounts exist
        console.log('\\n📊 Final Account Status:');
        const globalMarketAccount = await connection.getAccountInfo(globalMarketPda);
        const registryAccount = await connection.getAccountInfo(collectionRegistryPda);
        const vaultAccount = await connection.getAccountInfo(capitalVaultPda);
        
        console.log('├─ Global Market:', globalMarketAccount ? '✅ EXISTS' : '❌ MISSING');
        console.log('├─ Collection Registry (OLD):', registryAccount ? '✅ EXISTS' : '❌ MISSING');
        console.log('├─ Collection Registry V2:', registryV2Account ? '✅ EXISTS' : '❌ MISSING');
        console.log('└─ Capital Vault:', vaultAccount ? '✅ EXISTS' : '❌ MISSING');
        
        console.log('\\n🎉 Initialization Complete!');
        console.log('\\n📝 Summary:');
        console.log('├─ Program ID:', LENDING_PROGRAM_ID.toString());
        console.log('├─ Global Market:', globalMarketPda.toString());
        console.log('├─ Collection Registry (OLD):', collectionRegistryPda.toString());
        console.log('├─ Collection Registry V2:', collectionRegistryV2Pda.toString());
        console.log('├─ Capital Vault:', capitalVaultPda.toString());
        console.log('└─ Approved Collection: EaopfANR4pf2w2m8CqPLtTvbvrs3wVy99WSZAXD462dL');
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        if (error.logs) {
            console.log('📋 Transaction logs:');
            error.logs.forEach(log => console.log('  ', log));
        }
    }
}

main().catch(console.error);
