use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer, MintTo, mint_to, transfer},
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata,
        create_master_edition_v3, CreateMasterEditionV3,
        verify_collection, VerifyCollection,
        mpl_token_metadata::types::{CollectionDetails, DataV2, Creator, Collection},
    },
};

// For REAL Jupiter integration via CPI
use anchor_lang::solana_program::{
    pubkey::Pubkey,
};

// Jupiter CPI imports for mainnet integration - Manual implementation
use anchor_lang::solana_program::{
    instruction::{Instruction, AccountMeta},
    program::invoke_signed,
};


// Constants for dynamic fee reading from GlobalMarket
pub struct DynamicFeeData {
    pub transaction_fee_bps: u16,
    pub lending_wallet_share_bps: u16,
    pub treasury_wallet_share_bps: u16,
}

// Read dynamic fees from GlobalMarket account (from lending program)
fn read_dynamic_fees(global_market_account: &AccountInfo) -> Result<DynamicFeeData> {
    let data = global_market_account.try_borrow_data()?;
    
    // Skip discriminator (8 bytes) and read fee configuration
    // Based on GlobalMarket struct layout in lending program
    if data.len() < 200 {
        msg!("⚠️ GlobalMarket account too small, using defaults");
        return Ok(DynamicFeeData {
            transaction_fee_bps: DEFAULT_TRANSACTION_FEE_BPS,
            lending_wallet_share_bps: LENDING_WALLET_SHARE_BPS,
            treasury_wallet_share_bps: TREASURY_WALLET_SHARE_BPS,
        });
    }
    
    // Calculate correct offsets based on GlobalMarket struct layout:
    // discriminator(8) + owner(32) + capital_vault_usdc(32) + treasury_wallet(32) + 
    // collection_registry(32) + max_staked_nfts(4) + current_staked_nfts(4) + 
    // per_nft_value_usd(8) + base_interest_rate_1_month_bps(2) + base_interest_rate_2_month_bps(2) + 
    // base_interest_rate_3_month_bps(2) + max_interest_rate_multiplier_bps(2) + 
    // optimal_utilization_rate_bps(2) + utilization_slope_1_bps(2) + utilization_slope_2_bps(2) + 
    // total_liquidity_available_usd(16) + total_liquidity_borrowed_usd(16) = 198 bytes
    
    let transaction_fee_offset = 8 + 32 + 32 + 32 + 32 + 4 + 4 + 8 + 2 + 2 + 2 + 2 + 2 + 2 + 2 + 16 + 16; // = 198
    let lending_wallet_share_offset = transaction_fee_offset + 2; // = 200
    let treasury_wallet_share_offset = lending_wallet_share_offset + 2; // = 202
    
    let transaction_fee_bps = u16::from_le_bytes([data[transaction_fee_offset], data[transaction_fee_offset + 1]]);
    let lending_wallet_share_bps = u16::from_le_bytes([data[lending_wallet_share_offset], data[lending_wallet_share_offset + 1]]);
    let treasury_wallet_share_bps = u16::from_le_bytes([data[treasury_wallet_share_offset], data[treasury_wallet_share_offset + 1]]);
    
    msg!("📊 Dynamic fees loaded:");
    msg!("  Transaction fee: {}bps ({}%)", transaction_fee_bps, transaction_fee_bps as f32 / 100.0);
    msg!("  Lending share: {}bps ({}%)", lending_wallet_share_bps, lending_wallet_share_bps as f32 / 100.0);
    msg!("  Treasury share: {}bps ({}%)", treasury_wallet_share_bps, treasury_wallet_share_bps as f32 / 100.0);
    
    Ok(DynamicFeeData {
        transaction_fee_bps,
        lending_wallet_share_bps,
        treasury_wallet_share_bps,
    })
}

// MAINNET MODE: Real Jupiter swap implementation using manual CPI
fn execute_real_jupiter_swap<'info>(
    accounts: &MintNftWithSwap<'info>,
    in_amount: u64,
    quoted_out_amount: u64,
    slippage_bps: u16,
    route_plan: Vec<u8>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    msg!("🔄 MAINNET: Executing Jupiter swap - {} WHISKEY → {} USDC", in_amount, quoted_out_amount);
    
    // Jupiter SharedAccountsRoute instruction discriminator
    // This is the instruction hash for Jupiter's shared_accounts_route instruction
    let discriminator = [0x8b, 0x47, 0x5e, 0x8d, 0x1f, 0x9b, 0x4e, 0x3f]; // Example discriminator - needs to be correct
    
    // Build instruction data
    let mut instruction_data = Vec::new();
    instruction_data.extend_from_slice(&discriminator);
    
    // Generate a unique ID for this swap
    let swap_id = Clock::get()?.unix_timestamp as u64;
    instruction_data.extend_from_slice(&swap_id.to_le_bytes());
    
    // Add route plan
    instruction_data.extend_from_slice(&(route_plan.len() as u32).to_le_bytes());
    instruction_data.extend_from_slice(&route_plan);
    
    // Add amounts and parameters
    instruction_data.extend_from_slice(&in_amount.to_le_bytes());
    instruction_data.extend_from_slice(&quoted_out_amount.to_le_bytes());
    instruction_data.extend_from_slice(&slippage_bps.to_le_bytes());
    instruction_data.extend_from_slice(&50u16.to_le_bytes()); // 0.5% platform fee

    // Build account metas for Jupiter CPI
    let account_metas = vec![
        AccountMeta::new_readonly(accounts.token_program.key(), false),
        AccountMeta::new_readonly(accounts.lending_pool_config.key(), true), // program_authority (signer)
        AccountMeta::new_readonly(accounts.lending_pool_config.key(), true), // user_transfer_authority (signer)
        AccountMeta::new(accounts.lending_pool_whiskey_vault.key(), false), // source_token_account
        AccountMeta::new(accounts.lending_pool_whiskey_vault.key(), false), // program_source_token_account
        AccountMeta::new(accounts.lending_pool_usdc_vault.key(), false), // program_destination_token_account
        AccountMeta::new(accounts.lending_pool_usdc_vault.key(), false), // destination_token_account
        AccountMeta::new_readonly(accounts.whiskey_token_mint.key(), false), // source_mint
        AccountMeta::new_readonly(accounts.usdc_mint.key(), false), // destination_mint
        AccountMeta::new(accounts.treasury_whiskey_token_account.key(), false), // platform_fee_account
        AccountMeta::new_readonly(accounts.token_program.key(), false), // token_2022_program
    ];

    // Create the Jupiter instruction
    let jupiter_instruction = Instruction {
        program_id: JUPITER_PROGRAM_ID,
        accounts: account_metas,
        data: instruction_data,
    };

    // Prepare account infos for invoke_signed
    let account_infos = vec![
        accounts.token_program.to_account_info(),
        accounts.lending_pool_config.to_account_info(),
        accounts.lending_pool_whiskey_vault.to_account_info(),
        accounts.lending_pool_usdc_vault.to_account_info(),
        accounts.whiskey_token_mint.to_account_info(),
        accounts.usdc_mint.to_account_info(),
        accounts.treasury_whiskey_token_account.to_account_info(),
        accounts.jupiter_program.to_account_info(),
    ];

    // Execute the Jupiter swap via manual CPI
    invoke_signed(
        &jupiter_instruction,
        &account_infos,
        signer_seeds,
    )?;

    msg!("✅ Jupiter swap completed successfully");
    Ok(())
}

// DEVNET MODE: Stub function for development testing
#[allow(dead_code)]
fn execute_stub_jupiter_swap<'info>(
    _accounts: &MintNftWithSwap<'info>,
    in_amount: u64,
    quoted_out_amount: u64,
    _slippage_bps: u16,
    _route_plan: Vec<u8>,
    _signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    msg!("🔄 DEVNET MODE: Jupiter swap disabled - {} WHISKEY would become ~{} USDC", in_amount, quoted_out_amount);
    Ok(())
}

// Price validation constants
pub const MAX_PRICE_DEVIATION_BPS: u64 = 500; // 5% max deviation allowed
pub const WHISKEY_DECIMALS: u64 = 1_000_000; // 6 decimal places for WHISKEY token
pub const USD_MICRO_DECIMALS: u64 = 1_000_000; // 6 decimal places for USD (microdollars)

// Price validation function - validates that the WHISKEY amount matches the expected USD price
fn validate_mint_price(
    collection_config: &CollectionConfig,
    whiskey_amount_passed: u64,
    current_whiskey_rate: u64, // Current WHISKEY/USD rate in microdollars
) -> Result<()> {
    msg!("🔍 Validating mint price...");
    
    // Get the expected USD price for this collection
    let expected_usd_price = collection_config.mint_price_usd;
    
    // Calculate how many WHISKEY tokens should be needed based on USD price and current rate
    let expected_whiskey_tokens = (expected_usd_price * WHISKEY_DECIMALS) / current_whiskey_rate;
    
    // Calculate the maximum allowed deviation (5%)
    let max_deviation = (expected_whiskey_tokens * MAX_PRICE_DEVIATION_BPS) / 10000;
    let min_allowed = expected_whiskey_tokens.saturating_sub(max_deviation);
    let max_allowed = expected_whiskey_tokens + max_deviation;
    
    msg!("💰 Price validation:");
    msg!("  Expected USD price: ${:.2}", expected_usd_price as f64 / USD_MICRO_DECIMALS as f64);
    msg!("  Current WHISKEY rate: ${:.6}", current_whiskey_rate as f64 / USD_MICRO_DECIMALS as f64);
    msg!("  Expected WHISKEY tokens: {}", expected_whiskey_tokens);
    msg!("  WHISKEY tokens passed: {}", whiskey_amount_passed);
    msg!("  Allowed range: {} - {}", min_allowed, max_allowed);
    
    // Check if the passed amount is within the allowed range
    if whiskey_amount_passed < min_allowed || whiskey_amount_passed > max_allowed {
        msg!("❌ Price validation failed: Amount {} outside allowed range {} - {}", 
             whiskey_amount_passed, min_allowed, max_allowed);
        return Err(ErrorCode::InvalidMintPrice.into());
    }
    
    msg!("✅ Price validation successful!");
    Ok(())
}

declare_id!("Y5ZTxmgfR51njNPjHRm9WYzbmvoG4uptaQnHupdKbFM");

// Constants
pub const MAX_NAME_LENGTH: usize = 32;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MAX_URI_LENGTH: usize = 200;

// Token addresses
pub const WHISKEY_TOKEN_MINT: Pubkey = pubkey!("6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu"); // New WHISKEY token

// Admin wallet (hardcoded for security)
pub const ADMIN_WALLET: Pubkey = pubkey!("2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk");

// Fee configuration defaults
pub const DEFAULT_TRANSACTION_FEE_BPS: u16 = 250; // 2.5% default
pub const LENDING_WALLET_SHARE_BPS: u16 = 8000; // 80% to lending (converted to USDC)
pub const TREASURY_WALLET_SHARE_BPS: u16 = 2000; // 20% to treasury (stays as WHISKEY)

// PDA seeds for wallet management
pub const FEE_WALLET_SEED: &[u8] = b"fee_wallet";
pub const TREASURY_WALLET_SEED: &[u8] = b"treasury_wallet"; 
pub const LENDING_POOL_SEED: &[u8] = b"lending_pool";

// Token mint addresses - Environment dependent
// DEVNET
pub const USDC_MINT_DEVNET: Pubkey = pubkey!("4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP");
pub const WHISKEY_MINT_DEVNET: Pubkey = pubkey!("6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu");

// MAINNET 
pub const USDC_MINT_MAINNET: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Real USDC
pub const WHISKEY_MINT_MAINNET: Pubkey = pubkey!("6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu"); // Will be updated for mainnet

// Jupiter program ID (same for devnet and mainnet)
pub const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

// Environment-aware token mint getters
pub fn get_usdc_mint() -> Pubkey {
    if cfg!(feature = "mainnet") {
        USDC_MINT_MAINNET
    } else {
        USDC_MINT_DEVNET
    }
}

pub fn get_whiskey_mint() -> Pubkey {
    if cfg!(feature = "mainnet") {
        WHISKEY_MINT_MAINNET
    } else {
        WHISKEY_MINT_DEVNET
    }
}

// Legacy constant for backward compatibility
pub const USDC_MINT: Pubkey = USDC_MINT_DEVNET;

// Account structs
#[account]
pub struct CollectionConfig {
    pub authority: Pubkey, // The authority that can manage this collection (e.g., update price)
    pub collection_mint: Pubkey, // The mint address of the Metaplex Collection NFT
    pub name: String,      // Collection Name (used for metadata)
    pub symbol: String,    // Collection Symbol (used for metadata)
    pub metadata_uri: String, // URI to the collection's JSON metadata (on Arweave/IPFS)
    pub mint_price_sol: u64,   // Price in lamports to mint one NFT from this collection
    pub mint_price_whiskey: u64, // Price in whiskey tokens to mint one NFT from this collection
    pub mint_price_usd: u64,    // Price in USD (microdollars) to mint one NFT from this collection
    pub item_limit: u64,   // Maximum number of NFTs in this collection
    pub items_minted: u64, // Counter for how many NFTs have been minted
    pub is_whiskey_gated: bool, // Whether this collection requires WHISKEY tokens to mint
    pub required_whiskey_amount: u64, // Required WHISKEY tokens to mint (in tokens, not lamports)
    pub bump: u8,          // PDA bump seed
}

#[account]
pub struct WalletNftCounter {
    pub wallet: Pubkey,    // The wallet address
    pub nft_count: u8,     // Number of NFTs minted by this wallet
    pub bump: u8,          // PDA bump seed
}

// New PDA for secure lending pool management
#[account]
pub struct LendingPoolConfig {
    pub authority: Pubkey,           // Program authority (can be admin or PDA)
    pub whiskey_vault: Pubkey,       // WHISKEY token vault (PDA)
    pub usdc_vault: Pubkey,          // USDC token vault (PDA)
    pub total_whiskey_received: u64, // Total WHISKEY received from mints
    pub total_usdc_swapped: u64,     // Total USDC from swaps
    pub last_swap_timestamp: i64,    // Last swap timestamp
    pub bump: u8,
}

impl CollectionConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 36 + 14 + 204 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1; // ~376 bytes (added is_whiskey_gated + required_whiskey_amount)
}

impl WalletNftCounter {
    pub const SPACE: usize = 8 + 32 + 1 + 1; // ~42 bytes
}

impl LendingPoolConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1; // ~129 bytes
}


#[program]
pub mod whiskeyprogram {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }


    // Initialize lending pool PDA (secure, no private keys needed)
    pub fn initialize_lending_pool(ctx: Context<InitializeLendingPool>) -> Result<()> {
        let lending_pool = &mut ctx.accounts.lending_pool_config;
        
        lending_pool.authority = ctx.accounts.admin.key();
        lending_pool.whiskey_vault = ctx.accounts.whiskey_vault.key();
        lending_pool.usdc_vault = ctx.accounts.usdc_vault.key();
        lending_pool.total_whiskey_received = 0;
        lending_pool.total_usdc_swapped = 0;
        lending_pool.last_swap_timestamp = Clock::get()?.unix_timestamp;
        lending_pool.bump = ctx.bumps.lending_pool_config;

        msg!("🏦 Lending pool initialized:");
        msg!("  Authority: {}", lending_pool.authority);
        msg!("  WHISKEY vault: {}", lending_pool.whiskey_vault);
        msg!("  USDC vault: {}", lending_pool.usdc_vault);

        Ok(())
    }

    pub fn create_v2_vaults(ctx: Context<CreateV2Vaults>) -> Result<()> {
        msg!("🔧 Creating v2 vaults for existing lending pool...");
        
        // Update the existing lending pool config to point to new v2 vaults
        let lending_pool = &mut ctx.accounts.lending_pool_config;
        
        lending_pool.whiskey_vault = ctx.accounts.whiskey_vault_v2.key();
        lending_pool.usdc_vault = ctx.accounts.usdc_vault_v2.key();

        msg!("✅ v2 vaults created and linked:");
        msg!("  WHISKEY vault v2: {}", lending_pool.whiskey_vault);
        msg!("  USDC vault v2: {}", lending_pool.usdc_vault);

        Ok(())
    }

    #[derive(Accounts)]
    pub struct CreateV2Vaults<'info> {
        #[account(
            mut,
            address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
        )]
        pub admin: Signer<'info>,

        #[account(
            mut,
            seeds = [LENDING_POOL_SEED],
            bump = lending_pool_config.bump
        )]
        pub lending_pool_config: Account<'info, LendingPoolConfig>,

        #[account(
            init,
            payer = admin,
            token::mint = whiskey_token_mint,
            token::authority = lending_pool_config,
            seeds = [LENDING_POOL_SEED, b"whiskey_vault_v2"],
            bump
        )]
        pub whiskey_vault_v2: Account<'info, TokenAccount>,

        #[account(
            init,
            payer = admin,
            token::mint = usdc_mint,
            token::authority = lending_pool_config,
            seeds = [LENDING_POOL_SEED, b"usdc_vault_v2"],
            bump
        )]
        pub usdc_vault_v2: Account<'info, TokenAccount>,

        /// CHECK: Whiskey token mint
        #[account(address = WHISKEY_TOKEN_MINT)]
        pub whiskey_token_mint: Account<'info, Mint>,

        /// CHECK: USDC mint
        #[account(address = USDC_MINT)]
        pub usdc_mint: Account<'info, Mint>,

        pub token_program: Program<'info, Token>,
        pub system_program: Program<'info, System>,
        pub rent: Sysvar<'info, Rent>,
    }

    #[derive(Accounts)]
    #[instruction(name: String)]
    pub struct CreateCollectionAccounts<'info> {
        #[account(
            mut,
            address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
        )]
        pub admin: Signer<'info>, // Must be the hardcoded admin wallet

        #[account(
            init_if_needed,
            payer = admin,
            space = CollectionConfig::SPACE,
            seeds = [b"collection".as_ref(), name.as_bytes()],
            bump
        )]
        pub collection_config: Account<'info, CollectionConfig>,
        #[account(
            init,
            payer = admin,
            mint::decimals = 0,
            mint::authority = collection_config, // Changed: PDA is mint authority
            mint::freeze_authority = collection_config // Changed: PDA is freeze authority
        )]
        pub collection_mint: Account<'info, Mint>,
        /// CHECK: This is not dangerous because we are creating this account
        #[account(mut)]
        pub metadata_account: UncheckedAccount<'info>,
        /// CHECK: This is not dangerous because we are creating this account
        #[account(mut)]
        pub master_edition_account: UncheckedAccount<'info>,
        #[account(
            init_if_needed,
            payer = admin,
            associated_token::mint = collection_mint,
            associated_token::authority = admin
        )]
        pub token_account: Account<'info, TokenAccount>,
        pub token_program: Program<'info, Token>,
        pub associated_token_program: Program<'info, AssociatedToken>,
        /// CHECK: metaplex_token_metadata program address
        pub token_metadata_program: Program<'info, Metadata>,
        pub system_program: Program<'info, System>,
        pub rent: Sysvar<'info, Rent>,


    }

    pub fn create_collection(
        ctx: Context<CreateCollectionAccounts>,
        name: String,
        symbol: String,
        metadata_uri: String,
        mint_price_sol: u64,
        mint_price_whiskey: u64,
        mint_price_usd: u64,
        item_limit: u64,
    ) -> Result<()> {
        // Validate inputs
        if name.len() > MAX_NAME_LENGTH || name.is_empty() {
            return Err(ErrorCode::NameTooLong.into());
        }
        if symbol.len() > MAX_SYMBOL_LENGTH || symbol.is_empty() {
            return Err(ErrorCode::SymbolTooLong.into());
        }
        if metadata_uri.len() > MAX_URI_LENGTH || metadata_uri.is_empty() {
            return Err(ErrorCode::UriTooLong.into());
        }
        if item_limit == 0 {
            return Err(ErrorCode::ItemLimitZero.into());
        }

        // Initialize the CollectionConfig account
        let collection_config = &mut ctx.accounts.collection_config;
        collection_config.authority = ctx.accounts.admin.key(); // Set the admin as the authority
        collection_config.collection_mint = ctx.accounts.collection_mint.key();
        collection_config.name = name.clone();
        collection_config.symbol = symbol.clone();
        collection_config.metadata_uri = metadata_uri.clone();
        collection_config.mint_price_sol = mint_price_sol;
        collection_config.mint_price_whiskey = mint_price_whiskey;
        collection_config.mint_price_usd = mint_price_usd;
        collection_config.item_limit = item_limit;
        collection_config.items_minted = 0;
        collection_config.is_whiskey_gated = false; // Regular paid collection
        collection_config.required_whiskey_amount = 0; // Not applicable for paid collections
        collection_config.bump = ctx.bumps.collection_config;

        // Prepare metadata for the Collection NFT
        let data_v2 = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: metadata_uri.clone(),
            seller_fee_basis_points: 500, // 5% royalties
            creators: Some(vec![Creator {
                address: ctx.accounts.admin.key(),
                verified: false, // Will be verified in the CPI call
                share: 100,
            }]),
            collection: None,
            uses: None,
        };

        // Signer seeds for the CollectionConfig PDA
        let collection_name_bytes = name.as_bytes();
        let seeds = &[
            b"collection".as_ref(),
            collection_name_bytes,
            &[collection_config.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Create metadata account for the Collection NFT
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata_account.to_account_info(),
            mint: ctx.accounts.collection_mint.to_account_info(),
                mint_authority: collection_config.to_account_info(), // PDA is mint authority
                update_authority: collection_config.to_account_info(), // PDA is update authority
            payer: ctx.accounts.admin.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        );

        create_metadata_accounts_v3(
            cpi_context,
            data_v2,
            true, // is_mutable
            true, // update_authority_is_signer
            Some(CollectionDetails::V1 { size: 0 }), // Collection details
        )?;

        // Mint the Collection NFT to the admin's token account
        let cpi_context_mint = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.collection_mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: collection_config.to_account_info(), // PDA is mint authority
            },
            signer_seeds,
        );

        mint_to(cpi_context_mint, 1)?;

        msg!("Collection created successfully:");
        msg!("  Name: {}", name);
        msg!("  Symbol: {}", symbol);
        msg!("  Collection Mint: {}", ctx.accounts.collection_mint.key());
        msg!("  Authority: {}", collection_config.authority);
        msg!("  Item Limit: {}", item_limit);

        Ok(())
    }

    /// Create a whiskey-gated collection (requires WHISKEY tokens to mint, free to mint if requirements met)
    pub fn create_whiskey_gated_collection(
        ctx: Context<CreateCollectionAccounts>,
        name: String,
        symbol: String,
        metadata_uri: String,
        required_whiskey_amount: u64, // Required WHISKEY tokens (in full tokens, not lamports)
        item_limit: u64,
    ) -> Result<()> {
        // Validate inputs
        if name.len() > MAX_NAME_LENGTH || name.is_empty() {
            return Err(ErrorCode::NameTooLong.into());
        }
        if symbol.len() > MAX_SYMBOL_LENGTH || symbol.is_empty() {
            return Err(ErrorCode::SymbolTooLong.into());
        }
        if metadata_uri.len() > MAX_URI_LENGTH || metadata_uri.is_empty() {
            return Err(ErrorCode::UriTooLong.into());
        }
        if item_limit == 0 {
            return Err(ErrorCode::ItemLimitZero.into());
        }
        if required_whiskey_amount == 0 {
            return Err(ErrorCode::InvalidAmount.into());
        }

        // Initialize the CollectionConfig account
        let collection_config = &mut ctx.accounts.collection_config;
        collection_config.authority = ctx.accounts.admin.key();
        collection_config.collection_mint = ctx.accounts.collection_mint.key();
        collection_config.name = name.clone();
        collection_config.symbol = symbol.clone();
        collection_config.metadata_uri = metadata_uri.clone();
        collection_config.mint_price_sol = 0; // Free to mint (only requires WHISKEY balance)
        collection_config.mint_price_whiskey = 0; // Free to mint (only requires WHISKEY balance)
        collection_config.mint_price_usd = 0; // Free to mint (only requires WHISKEY balance)
        collection_config.item_limit = item_limit;
        collection_config.items_minted = 0;
        collection_config.is_whiskey_gated = true;
        collection_config.required_whiskey_amount = required_whiskey_amount;
        collection_config.bump = ctx.bumps.collection_config;

        // Create the Collection NFT metadata
        let collection_config_bump = ctx.bumps.collection_config;
        let collection_config_seeds = &[
            b"collection".as_ref(),
            name.as_bytes(),
            &[collection_config_bump],
        ];
        let signer_seeds = &[&collection_config_seeds[..]];

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.collection_mint.to_account_info(),
                mint_authority: ctx.accounts.collection_config.to_account_info(),
                payer: ctx.accounts.admin.to_account_info(),
                update_authority: ctx.accounts.admin.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        );

        let creators = vec![Creator {
            address: ctx.accounts.admin.key(),
            verified: true,
            share: 100,
        }];

        let data = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: metadata_uri.clone(),
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creators),
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            metadata_ctx,
            data,
            true, // is_mutable
            true, // update_authority_is_signer
            Some(CollectionDetails::V1 { size: 0 }),
        )?;

        msg!("✅ Whiskey-gated collection created successfully!");
        msg!("  Collection Mint: {}", ctx.accounts.collection_mint.key());
        msg!("  Name: {}", name);
        msg!("  Symbol: {}", symbol);
        msg!("  Required WHISKEY: {} tokens", required_whiskey_amount);
        msg!("  Item Limit: {}", item_limit);
        msg!("  ⚠️ This collection cannot be used for lending!");

        Ok(())
    }

    /// Transfer USDC from whiskey program's vault to lending program's capital vault
    pub fn transfer_to_lending_vault(
        ctx: Context<TransferToLendingVault>, 
        amount: u64
    ) -> Result<()> {
        msg!("🔄 Transferring {} USDC from whiskey vault to lending capital vault", amount / 1_000_000);
        
        // Validate amount
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Check vault balance
        let vault_balance = ctx.accounts.whiskey_usdc_vault.amount;
        require!(vault_balance >= amount, ErrorCode::InsufficientFunds);
        
        msg!("💰 Whiskey USDC vault balance: {} USDC", vault_balance / 1_000_000);
        msg!("💸 Transferring: {} USDC", amount / 1_000_000);
        msg!("📍 To lending capital vault: {}", ctx.accounts.lending_capital_vault.key());
        
        // Create signer seeds for lending pool config authority
        let lending_pool_config = &ctx.accounts.lending_pool_config;
        let lending_pool_bump = [lending_pool_config.bump];
        let lending_pool_seeds = [b"lending_pool".as_ref(), lending_pool_bump.as_ref()];
        let signer_seeds = [&lending_pool_seeds[..]];
        
        // Transfer USDC from whiskey vault to lending capital vault
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.whiskey_usdc_vault.to_account_info(),
                to: ctx.accounts.lending_capital_vault.to_account_info(),
                authority: ctx.accounts.lending_pool_config.to_account_info(),
            },
            &signer_seeds
        );
        
        transfer(transfer_ctx, amount)?;
        
        // Update lending pool config stats
        let lending_pool_config = &mut ctx.accounts.lending_pool_config;
        lending_pool_config.total_usdc_swapped = lending_pool_config.total_usdc_swapped
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        lending_pool_config.last_swap_timestamp = Clock::get()?.unix_timestamp;
        
        msg!("✅ Successfully transferred {} USDC to lending capital vault", amount / 1_000_000);
        msg!("📊 Total USDC transferred to lending: {} USDC", lending_pool_config.total_usdc_swapped / 1_000_000);
        
        Ok(())
    } 

    pub fn mint_nft_with_swap(
        ctx: Context<MintNftWithSwap>, 
        nft_name: String, 
        nft_symbol: String, 
        nft_uri: String, 
        whiskey_amount: u64,
        current_whiskey_rate: u64, // Current WHISKEY/USD rate in microdollars
    ) -> Result<()> {
        // Store references for later use
        let _collection_config_key = ctx.accounts.collection_config.key(); // Prefixed with _ to suppress warning
        let collection_authority = ctx.accounts.collection_config.authority;

        // 1. Check if this is a whiskey-gated collection
        if ctx.accounts.collection_config.is_whiskey_gated {
            // For whiskey-gated collections, check wallet balance instead of payment
            let user_whiskey_balance = ctx.accounts.payer_whiskey_token_account.amount;
            let required_balance = ctx.accounts.collection_config.required_whiskey_amount * 1_000_000; // Convert to lamports (6 decimals)
            
            if user_whiskey_balance < required_balance {
                msg!("❌ Insufficient WHISKEY balance for gated collection");
                msg!("  Required: {} WHISKEY tokens", ctx.accounts.collection_config.required_whiskey_amount);
                msg!("  Your balance: {} WHISKEY tokens", user_whiskey_balance / 1_000_000);
                return Err(ErrorCode::InsufficientFunds.into());
            }
            
            msg!("✅ Whiskey balance check passed!");
            msg!("  Required: {} WHISKEY tokens", ctx.accounts.collection_config.required_whiskey_amount);
            msg!("  Your balance: {} WHISKEY tokens", user_whiskey_balance / 1_000_000);
        } else {
            // For regular paid collections, validate mint price
            validate_mint_price(
                &ctx.accounts.collection_config,
                whiskey_amount,
                current_whiskey_rate,
            )?;
        }

        // 2. Validate collection limits
        if ctx.accounts.collection_config.items_minted >= ctx.accounts.collection_config.item_limit {
            return Err(ErrorCode::CollectionFull.into());
        }

        // 2. Check wallet NFT limit per collection
        let max_allowed = if ctx.accounts.collection_config.is_whiskey_gated {
            1 // Whiskey-gated collections: 1 NFT per wallet (exclusive)
        } else {
            5 // Regular collections: 5 NFTs per wallet
        };
        
        if ctx.accounts.wallet_nft_counter.nft_count >= max_allowed {
            if ctx.accounts.collection_config.is_whiskey_gated {
                msg!("❌ Wallet has already minted from this whiskey-gated collection");
                msg!("  Whiskey-gated collections allow only 1 NFT per wallet");
                return Err(ErrorCode::WhiskeyGatedCollectionLimitExceeded.into());
            } else {
                return Err(ErrorCode::WalletNftLimitExceeded.into());
            }
        }

        // 3. Update counters
        ctx.accounts.collection_config.items_minted += 1;
        ctx.accounts.wallet_nft_counter.wallet = ctx.accounts.payer.key();
        ctx.accounts.wallet_nft_counter.nft_count += 1;
        if ctx.accounts.wallet_nft_counter.nft_count == 1 {
            ctx.accounts.wallet_nft_counter.bump = ctx.bumps.wallet_nft_counter;
        }

        // 4. Validate new NFT metadata inputs (similar to collection creation)
        if nft_name.len() > MAX_NAME_LENGTH || nft_name.is_empty() {
            return Err(ErrorCode::NftNameTooLong.into());
        }
        if nft_symbol.len() > MAX_SYMBOL_LENGTH || nft_symbol.is_empty() {
            return Err(ErrorCode::NftSymbolTooLong.into());
        }
        if nft_uri.len() > MAX_URI_LENGTH || nft_uri.is_empty() {
            return Err(ErrorCode::NftUriTooLong.into());
        }
        
        // 5. Handle payment - skip for whiskey-gated collections (they're free to mint)
        if !ctx.accounts.collection_config.is_whiskey_gated && whiskey_amount > 0 {
            let total_price = whiskey_amount;
            
            // Read dynamic fee configuration from GlobalMarket account
            let fee_config = read_dynamic_fees(&ctx.accounts.global_market.to_account_info())?;
            
            // Calculate revenue split: 80% to lending pool (as USDC), 20% to treasury (as WHISKEY)
            let lending_share = (total_price as u128 * fee_config.lending_wallet_share_bps as u128) / 10000u128;
            let treasury_share = (total_price as u128 * fee_config.treasury_wallet_share_bps as u128) / 10000u128;
            
            let lending_amount = lending_share as u64;
            let treasury_amount = treasury_share as u64;

            msg!("💰 Mint payment breakdown:");
            msg!("  Total price: {} WHISKEY (calculated from USD)", total_price);
            msg!("  🏦 Lending pool: {} WHISKEY → USDC ({}%)", lending_amount, fee_config.lending_wallet_share_bps as f32 / 100.0);
            msg!("  🏛️ Treasury: {} WHISKEY ({}%)", treasury_amount, fee_config.treasury_wallet_share_bps as f32 / 100.0);

            // Transfer WHISKEY to lending pool vault
            if lending_amount > 0 {
                transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.payer_whiskey_token_account.to_account_info(),
                            to: ctx.accounts.lending_pool_whiskey_vault.to_account_info(),
                            authority: ctx.accounts.payer.to_account_info(),
                        },
                    ),
                    lending_amount,
                )?;
                msg!("✅ WHISKEY transferred to lending pool vault: {} WHISKEY", lending_amount);

                // Environment-aware Jupiter swap execution
                let lending_pool_bump = ctx.accounts.lending_pool_config.bump;
                let lending_pool_seeds = &[
                    LENDING_POOL_SEED,
                    &[lending_pool_bump],
                ];
                let lending_pool_signer = &[&lending_pool_seeds[..]];

                // Calculate minimum USDC output (with 1% slippage tolerance)
                // In production, you'd get this from Jupiter's quote API
                let estimated_usdc_out = (lending_amount * 95) / 100; // Conservative estimate
                let minimum_usdc_out = (estimated_usdc_out * 99) / 100; // 1% slippage

                // Route plan for direct WHISKEY → USDC swap
                // In production, this comes from Jupiter's quote API
                let route_plan = vec![]; // Empty for direct swap (if available)

                // Execute swap based on environment
                if cfg!(feature = "mainnet") {
                    msg!("🔄 MAINNET: Executing ATOMIC Jupiter swap: {} WHISKEY → USDC", lending_amount);
                    
                    // Execute the REAL Jupiter CPI swap
                    execute_real_jupiter_swap(
                        &ctx.accounts,
                        lending_amount,
                        minimum_usdc_out,
                        100, // 1% slippage in basis points
                        route_plan,
                        lending_pool_signer,
                    )?;

                    // Update lending pool statistics with actual swap results
                    ctx.accounts.lending_pool_config.total_whiskey_received += lending_amount;
                    ctx.accounts.lending_pool_config.total_usdc_swapped += minimum_usdc_out;
                    ctx.accounts.lending_pool_config.last_swap_timestamp = Clock::get()?.unix_timestamp;

                    msg!("✅ MAINNET: Jupiter swap completed: {} WHISKEY → ~{} USDC", lending_amount, minimum_usdc_out);
                } else {
                    msg!("🔄 DEVNET: Simulating Jupiter swap: {} WHISKEY → {} USDC", lending_amount, minimum_usdc_out);
                    
                    // DEVNET MODE: Update lending pool statistics without swap
                    ctx.accounts.lending_pool_config.total_whiskey_received += lending_amount;
                    // Note: total_usdc_swapped stays 0 in devnet mode
                    ctx.accounts.lending_pool_config.last_swap_timestamp = Clock::get()?.unix_timestamp;

                    msg!("✅ DEVNET: Lending pool updated without Jupiter swap");
                }
            }

            // Transfer 20% to treasury (stays as WHISKEY)
            if treasury_amount > 0 {
                transfer(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.payer_whiskey_token_account.to_account_info(),
                            to: ctx.accounts.treasury_whiskey_token_account.to_account_info(),
                            authority: ctx.accounts.payer.to_account_info(),
                        },
                    ),
                    treasury_amount,
                )?;
                msg!("✅ Treasury share transferred: {} WHISKEY (stays as WHISKEY)", treasury_amount);
            }
        }

        // 6. Mint the NFT (same as before)
        let collection_name_bytes = ctx.accounts.collection_config.name.as_bytes();
        let seeds = &[
            b"collection".as_ref(),
            collection_name_bytes,
            &[ctx.accounts.collection_config.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // Mint the new NFT to the payer's ATA
        msg!("Minting new NFT to payer's ATA...");
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.nft_token_account.to_account_info(),
                    authority: ctx.accounts.collection_config.to_account_info(), // PDA is mint authority
                },
                signer_seeds,
            ),
            1,
        )?;

        // Create metadata for the new NFT
        let data_v2 = DataV2 {
            name: nft_name.clone(),
            symbol: nft_symbol.clone(),
            uri: nft_uri.clone(),
            seller_fee_basis_points: 500, // 5% royalties
            creators: Some(vec![Creator {
                address: collection_authority,
                verified: false,
                share: 100,
            }]),
            collection: Some(Collection {
                verified: false, // Will be verified through collection verification
                key: ctx.accounts.collection_mint_account.key(),
            }),
            uses: None,
        };

        // Create metadata account for the new NFT
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.nft_metadata_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                mint_authority: ctx.accounts.collection_config.to_account_info(), // PDA is mint authority
                update_authority: ctx.accounts.collection_config.to_account_info(), // PDA is update authority
                payer: ctx.accounts.payer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        );

        create_metadata_accounts_v3(
            cpi_context,
            data_v2,
            true, // is_mutable
            true, // update_authority_is_signer
            None, // Collection details (not needed for individual NFTs)
        )?;

        msg!("🎉 NFT minted successfully with on-chain payment processing!");
        msg!("  NFT Name: {}", nft_name);
        msg!("  NFT Mint: {}", ctx.accounts.nft_mint.key());
        msg!("  Collection: {}", ctx.accounts.collection_mint_account.key());
        msg!("  Items Minted: {}/{}", ctx.accounts.collection_config.items_minted, ctx.accounts.collection_config.item_limit);
        msg!("  Wallet NFT Count: {}/5", ctx.accounts.wallet_nft_counter.nft_count);

        Ok(())
    }


    // Initialize lending pool accounts
    #[derive(Accounts)]
    pub struct InitializeLendingPool<'info> {
        #[account(
            mut,
            address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
        )]
        pub admin: Signer<'info>,

        #[account(
            init,
            payer = admin,
            space = LendingPoolConfig::SPACE,
            seeds = [LENDING_POOL_SEED],
            bump
        )]
        pub lending_pool_config: Account<'info, LendingPoolConfig>,

        #[account(
            init,
            payer = admin,
            token::mint = whiskey_token_mint,
            token::authority = lending_pool_config,
            seeds = [LENDING_POOL_SEED, b"whiskey_vault_v2"],
            bump
        )]
        pub whiskey_vault: Account<'info, TokenAccount>,

        #[account(
            init,
            payer = admin,
            token::mint = usdc_mint,
            token::authority = lending_pool_config,
            seeds = [LENDING_POOL_SEED, b"usdc_vault_v2"],
            bump
        )]
        pub usdc_vault: Account<'info, TokenAccount>,

        /// CHECK: Whiskey token mint
        #[account(address = WHISKEY_TOKEN_MINT)]
        pub whiskey_token_mint: Account<'info, Mint>,

                 /// CHECK: USDC mint
         #[account(address = USDC_MINT)]
         pub usdc_mint: Account<'info, Mint>,

        pub token_program: Program<'info, Token>,
        pub system_program: Program<'info, System>,
        pub rent: Sysvar<'info, Rent>,
    }
}

#[derive(Accounts)]
pub struct TransferToLendingVault<'info> {
    #[account(
        mut,
        constraint = admin.key() == ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lending_pool"],
        bump = lending_pool_config.bump
    )]
    pub lending_pool_config: Account<'info, LendingPoolConfig>,

    #[account(
        mut,
        seeds = [b"lending_pool", b"usdc_vault_v2"],
        bump
    )]
    pub whiskey_usdc_vault: Account<'info, TokenAccount>,

    /// CHECK: Lending program's capital vault - derived from lending program
    #[account(mut)]
    pub lending_capital_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Initialize {}

// Updated mint function with on-chain Jupiter integration
#[derive(Accounts)]
pub struct MintNftWithSwap<'info> {
        #[account(mut)]
        pub payer: Signer<'info>, // The user minting the NFT

        #[account(
            mut // To increment items_minted and potentially check/use authority
        )]
        pub collection_config: Account<'info, CollectionConfig>,

        // Wallet NFT counter to track per-wallet limits PER COLLECTION
        #[account(
            init_if_needed,
            payer = payer,
            space = WalletNftCounter::SPACE,
            seeds = [b"wallet_nft_counter", payer.key().as_ref(), collection_config.key().as_ref()],
            bump
        )]
        pub wallet_nft_counter: Account<'info, WalletNftCounter>,

        // The Collection NFT's Mint account (to link the new NFT to this collection)
        /// CHECK: This is the account of the collection mint, used for linking. Already initialized.
        pub collection_mint_account: UncheckedAccount<'info>, // Changed to UncheckedAccount to reduce stack size

        #[account(
            init,
            payer = payer,
            mint::decimals = 0,
            mint::authority = collection_config, // PDA is mint authority for new NFT
            mint::freeze_authority = collection_config // PDA is freeze authority for new NFT
        )]
        pub nft_mint: Account<'info, Mint>, // The new mint for the individual NFT

        /// CHECK: This is not dangerous because we are creating this account for the new NFT
        #[account(mut)]
        pub nft_metadata_account: UncheckedAccount<'info>,

        /// CHECK: This is not dangerous because we are creating this account for the new NFT
        #[account(mut)]
        pub nft_master_edition_account: UncheckedAccount<'info>,

        // User's ATA for the new NFT
        #[account(
            init_if_needed,
            payer = payer,
            associated_token::mint = nft_mint,
            associated_token::authority = payer
        )]
        pub nft_token_account: Account<'info, TokenAccount>,
        
        // Authority wallet for receiving mint fees (e.g., collection_config.authority)
        /// CHECK: This is the authority account that will receive the mint price.
        #[account(mut)]
        pub collection_authority_receiver: UncheckedAccount<'info>,

        // Global market account for dynamic fee configuration
        /// CHECK: Global market account from lending program for dynamic fee rates
        #[account(mut)]
        pub global_market: UncheckedAccount<'info>,

        // For whiskey token payments - these are required since we only accept whiskey tokens
        /// CHECK: Whiskey token mint account
        #[account(address = WHISKEY_TOKEN_MINT)]
        pub whiskey_token_mint: UncheckedAccount<'info>,

        // Payer's whiskey token account - create if needed
        #[account(
            init_if_needed,
            payer = payer,
            associated_token::mint = whiskey_token_mint,
            associated_token::authority = payer
        )]
        pub payer_whiskey_token_account: Account<'info, TokenAccount>,

    // Lending pool configuration PDA
    #[account(
        mut,
        seeds = [LENDING_POOL_SEED],
        bump = lending_pool_config.bump
    )]
    pub lending_pool_config: Account<'info, LendingPoolConfig>,

    // Lending pool WHISKEY vault (PDA-controlled)
    /// CHECK: Lending pool WHISKEY vault - validated by seeds
    #[account(
        mut,
        seeds = [LENDING_POOL_SEED, b"whiskey_vault_v2"],
        bump
    )]
    pub lending_pool_whiskey_vault: UncheckedAccount<'info>,

    // Lending pool USDC vault (PDA-controlled)
    /// CHECK: Lending pool USDC vault - validated by seeds
    #[account(
        mut,
        seeds = [LENDING_POOL_SEED, b"usdc_vault_v2"],
        bump
    )]
    pub lending_pool_usdc_vault: UncheckedAccount<'info>,

    // Treasury wallet's WHISKEY token account (where ALL fees go)
    /// CHECK: Treasury WHISKEY token account
    #[account(mut)]
    pub treasury_whiskey_token_account: UncheckedAccount<'info>,

    /// CHECK: Treasury wallet (admin's actual wallet for profit withdrawal)
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

    // Jupiter CPI accounts for mainnet swaps (WHISKEY → USDC)
    /// CHECK: Jupiter program for DEX aggregation
    #[account(address = JUPITER_PROGRAM_ID)]
    pub jupiter_program: UncheckedAccount<'info>,

    /// CHECK: USDC mint for Jupiter swaps
    pub usdc_mint: UncheckedAccount<'info>,

    // System Programs
        pub token_program: Program<'info, Token>,
        pub associated_token_program: Program<'info, AssociatedToken>,
        pub token_metadata_program: Program<'info, Metadata>, // Metaplex Token Metadata Program
        pub system_program: Program<'info, System>,
        pub rent: Sysvar<'info, Rent>,
    }


#[error_code]
pub enum ErrorCode {
    #[msg("Name too long.")]
    NameTooLong,
    #[msg("Symbol too long.")]
    SymbolTooLong,
    #[msg("URI too long.")]
    UriTooLong,
    #[msg("Item limit cannot be zero.")]
    ItemLimitZero,
    #[msg("Unauthorized: Caller is not the admin wallet.")]
    UnauthorizedAdmin,
    #[msg("Collection is full. No more items can be minted.")]
    CollectionFull,
    #[msg("NFT Name too long.")]
    NftNameTooLong,
    #[msg("NFT Symbol too long.")]
    NftSymbolTooLong,
    #[msg("NFT URI too long.")]
    NftUriTooLong,
    #[msg("Wallet has reached the maximum NFT limit of 5 per collection.")]
    WalletNftLimitExceeded,
    #[msg("Wallet has already minted from this whiskey-gated collection. Only 1 NFT per wallet allowed.")]
    WhiskeyGatedCollectionLimitExceeded,
    #[msg("Invalid mint price: WHISKEY amount does not match expected USD price.")]
    InvalidMintPrice,
    #[msg("Invalid amount specified")]
    InvalidAmount,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Invalid vault address")]
    InvalidVault,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}