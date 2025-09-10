const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { AnchorProvider, Wallet, Program } = require('@coral-xyz/anchor');
const fs = require('fs');

// Load deployment info
function loadDeploymentInfo() {
    try {
        const envPath = './devnet-complete-environment.env';
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        });
        
        return envVars;
    } catch (error) {
        console.error('❌ Error loading deployment info:', error.message);
        process.exit(1);
    }
}

// Load admin keypair
function loadAdminKeypair() {
    try {
        const keypairPath = process.env.HOME + '/.config/solana/admin-keypair.json';
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        return Keypair.fromSecretKey(new Uint8Array(keypairData));
    } catch (error) {
        console.error('❌ Error loading admin keypair:', error.message);
        process.exit(1);
    }
}

async function main() {
    console.log('🚀 Initializing New Lending Program...\n');
    
    // Load configuration
    const deploymentInfo = loadDeploymentInfo();
    const adminKeypair = loadAdminKeypair();
    
    // Setup connection and provider
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const wallet = new Wallet(adminKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    
    // Program info
    const LENDING_PROGRAM_ID = new PublicKey('9bW8x4e6u6fSd3X3T2mdx9mYAq7YbL5EsJLcfeagiMCT');
    const WHISKEY_TOKEN_MINT = new PublicKey(deploymentInfo.NEXT_PUBLIC_WHISKEY_TOKEN_MINT);
    const USDC_MINT = new PublicKey(deploymentInfo.NEXT_PUBLIC_USDC_TOKEN_MINT);
    const TREASURY_WALLET = new PublicKey(deploymentInfo.NEXT_PUBLIC_TREASURY_WALLET);
    
    // Load program IDL
    const idl = JSON.parse(fs.readFileSync('./target/idl/lendingprogram.json', 'utf8'));
    const program = new Program(idl, LENDING_PROGRAM_ID, provider);
    
    console.log('📋 Configuration:');
    console.log('├─ Program ID:', LENDING_PROGRAM_ID.toString());
    console.log('├─ Admin Wallet:', adminKeypair.publicKey.toString());
    console.log('├─ Treasury Wallet:', TREASURY_WALLET.toString());
    console.log('├─ WHISKEY Mint:', WHISKEY_TOKEN_MINT.toString());
    console.log('└─ USDC Mint:', USDC_MINT.toString());
    console.log();
    
    try {
        // Derive PDAs
        const [globalMarketPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('global_market')],
            LENDING_PROGRAM_ID
        );
        
        const [collectionRegistryPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('collection_registry')],
            LENDING_PROGRAM_ID
        );
        
        const [capitalVaultPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('capital_vault_usdc')],
            LENDING_PROGRAM_ID
        );
        
        console.log('🔑 Derived PDAs:');
        console.log('├─ Global Market:', globalMarketPda.toString());
        console.log('├─ Collection Registry:', collectionRegistryPda.toString());
        console.log('└─ Capital Vault:', capitalVaultPda.toString());
        console.log();
        
        // 1. Initialize Global Market
        console.log('🏗️  Step 1: Initializing Global Market...');
        try {
            const tx1 = await program.methods
                .initializeGlobalMarket(
                    5000,     // max_staked_nfts
                    1000000   // per_nft_value_usd (in micro-dollars, $1.00)
                )
                .accounts({
                    globalMarket: globalMarketPda,
                    collectionRegistry: collectionRegistryPda,
                    owner: adminKeypair.publicKey,
                    capitalVaultUsdc: capitalVaultPda,
                    treasuryWallet: TREASURY_WALLET,
                    systemProgram: new PublicKey('11111111111111111111111111111111'),
                })
                .signers([adminKeypair])
                .rpc();
            
            console.log('✅ Global Market initialized! Signature:', tx1);
        } catch (error) {
            if (error.message.includes('already in use')) {
                console.log('⚠️  Global Market already exists');
            } else {
                throw error;
            }
        }
        
        // 2. Initialize Capital Vault
        console.log('🏗️  Step 2: Initializing Capital Vault...');
        try {
            const tx2 = await program.methods
                .initializeCapitalVault()
                .accounts({
                    admin: adminKeypair.publicKey,
                    globalMarket: globalMarketPda,
                    capitalVault: capitalVaultPda,
                    usdcMint: USDC_MINT,
                    tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                    systemProgram: new PublicKey('11111111111111111111111111111111'),
                    rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
                })
                .signers([adminKeypair])
                .rpc();
            
            console.log('✅ Capital Vault initialized! Signature:', tx2);
        } catch (error) {
            if (error.message.includes('already in use')) {
                console.log('⚠️  Capital Vault already exists');
            } else {
                throw error;
            }
        }
        
        // 3. Initialize Collection Registry V2
        console.log('🏗️  Step 3: Initializing Collection Registry V2...');
        
        const [collectionRegistryV2Pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('collection_registry_v2')],
            LENDING_PROGRAM_ID
        );
        
        try {
            const tx3 = await program.methods
                .initializeCollectionRegistryV2()
                .accounts({
                    collectionRegistry: collectionRegistryV2Pda,
                    authority: adminKeypair.publicKey,
                    systemProgram: new PublicKey('11111111111111111111111111111111'),
                })
                .signers([adminKeypair])
                .rpc();
            
            console.log('✅ Collection Registry V2 initialized! Signature:', tx3);
        } catch (error) {
            if (error.message.includes('already in use')) {
                console.log('⚠️  Collection Registry V2 already exists');
            } else {
                throw error;
            }
        }
        
        // 4. Add the approved collection
        console.log('🏗️  Step 4: Adding approved collection...');
        
        const approvedCollectionMint = new PublicKey('EaopfANR4pf2w2m8CqPLtTvbvrs3wVy99WSZAXD462dL');
        
        try {
            const tx4 = await program.methods
                .addCollection(
                    approvedCollectionMint,
                    new anchor.BN(1000000) // $1.00 in micro-dollars
                )
                .accounts({
                    collectionRegistry: collectionRegistryV2Pda,
                    admin: adminKeypair.publicKey,
                })
                .signers([adminKeypair])
                .rpc();
            
            console.log('✅ Collection added! Signature:', tx4);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('⚠️  Collection already exists in registry');
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 Lending Program Initialization Complete!');
        console.log('\n📝 Summary:');
        console.log('├─ Program ID: DDy97mgfJ6pkGzF4KdaVVXpKkVFFBgn4EGdZ7EbrH5rB');
        console.log('├─ Global Market:', globalMarketPda.toString());
        console.log('├─ Collection Registry V2:', collectionRegistryV2Pda.toString());
        console.log('├─ Capital Vault:', capitalVaultPda.toString());
        console.log('└─ Approved Collection: EaopfANR4pf2w2m8CqPLtTvbvrs3wVy99WSZAXD462dL');
        
    } catch (error) {
        console.error('❌ Error during initialization:', error);
        if (error.logs) {
            console.log('📋 Transaction logs:');
            error.logs.forEach(log => console.log('  ', log));
        }
    }
}

main().catch(console.error);
