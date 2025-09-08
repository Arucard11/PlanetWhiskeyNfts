use anchor_lang::prelude::*;
use anchor_spl::{
    token::{Mint, Token, TokenAccount, Transfer, MintTo, mint_to, transfer},
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata,
        mpl_token_metadata::types::{CollectionDetails, DataV2, Creator, Collection},
    },
};

// For REAL Jupiter integration via CPI
use anchor_lang::solana_program::{
    // instruction::{Instruction, AccountMeta}, // COMMENTED OUT - not used in devnet mode
    // program::invoke_signed, // COMMENTED OUT - not used in devnet mode
    pubkey::Pubkey,
};

// Jupiter program interface for REAL CPI calls


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

// DEVNET MODE: Stub function for Jupiter swap (COMMENTED OUT FOR DEVNET TESTING)
fn execute_real_jupiter_swap<'info>(
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

declare_id!("68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD");

// Constants
pub const MAX_NAME_LENGTH: usize = 32;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MAX_URI_LENGTH: usize = 200;

// Token addresses
pub const WHISKEY_TOKEN_MINT: Pubkey = pubkey!("FuXejqzRAWWkoAcNrDU8L2i6cXXmB5NwqAVp2daN456j"); // New WHISKEY token

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

// Test USDC mint for devnet (no Jupiter swaps)
pub const USDC_MINT: Pubkey = pubkey!("5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR");

// Jupiter program ID (same for devnet and mainnet)
pub const JUPITER_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

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
    pub const SPACE: usize = 8 + 32 + 32 + 36 + 14 + 204 + 8 + 8 + 8 + 8 + 8 + 1; // ~358 bytes (added mint_price_usd)
}

impl WalletNftCounter {
    pub const SPACE: usize = 8 + 32 + 1 + 1; // ~42 bytes
}

impl LendingPoolConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1; // ~129 bytes
}

#[account]
pub struct ProgramAdminConfig {
    pub super_admin_key: Pubkey, // The master admin key for the program
    pub bump: u8,
}

impl ProgramAdminConfig {
    pub const SPACE: usize = 8 + 32 + 1; // 41 bytes
}

#[program]
pub mod whiskeyprogram {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    #[derive(Accounts)]
    pub struct InitializeSuperAdmin<'info> {
        #[account(mut)]
        pub payer: Signer<'info>, // The one initially setting the super admin
        #[account(
            init,
            payer = payer,
            space = ProgramAdminConfig::SPACE,
            seeds = [b"program_super_admin"], // Unique seed for this PDA
            bump
        )]
        pub program_admin_config: Account<'info, ProgramAdminConfig>,
        pub system_program: Program<'info, System>,
    }

    pub fn initialize_super_admin(ctx: Context<InitializeSuperAdmin>) -> Result<()> {
        let config = &mut ctx.accounts.program_admin_config;
        config.super_admin_key = ctx.accounts.payer.key(); // Set the payer as the super admin
        config.bump = ctx.bumps.program_admin_config;
        msg!("Super admin initialized: {}", config.super_admin_key);
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

        // 1. Validate mint price - ensure WHISKEY amount matches expected USD price
        validate_mint_price(
            &ctx.accounts.collection_config,
            whiskey_amount,
            current_whiskey_rate,
        )?;

        // 2. Validate collection limits
        if ctx.accounts.collection_config.items_minted >= ctx.accounts.collection_config.item_limit {
            return Err(ErrorCode::CollectionFull.into());
        }

        // 2. Check wallet NFT limit per collection (max 5 per wallet per collection)
        if ctx.accounts.wallet_nft_counter.nft_count >= 5 {
            return Err(ErrorCode::WalletNftLimitExceeded.into());
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
        
        // 5. Handle payment with on-chain Jupiter swap
        if whiskey_amount > 0 {
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

                // COMMENTED OUT FOR DEVNET TESTING - RESTORE FOR MAINNET
                /* Execute ATOMIC Jupiter swap: WHISKEY → USDC
                let lending_pool_bump = ctx.accounts.lending_pool_config.bump;
                let lending_pool_seeds = &[
                    LENDING_POOL_SEED,
                    &[lending_pool_bump],
                ];
                let lending_pool_signer = &[&lending_pool_seeds[..]];

                msg!("🔄 Executing ATOMIC Jupiter swap: {} WHISKEY → USDC", lending_amount);

                // Calculate minimum USDC output (with 1% slippage tolerance)
                // In production, you'd get this from Jupiter's quote API
                let estimated_usdc_out = (lending_amount * 95) / 100; // Conservative estimate
                let minimum_usdc_out = (estimated_usdc_out * 99) / 100; // 1% slippage

                // Route plan for direct WHISKEY → USDC swap
                // In production, this comes from Jupiter's quote API
                let route_plan = vec![]; // Empty for direct swap (if available)

                // Execute the REAL Jupiter CPI swap
                execute_real_jupiter_swap(
                    &ctx.accounts,
                    lending_amount,
                    minimum_usdc_out,
                    100, // 1% slippage in basis points
                    route_plan,
                    lending_pool_signer,
                )?;

                // Update lending pool statistics
                ctx.accounts.lending_pool_config.total_whiskey_received += lending_amount;
                ctx.accounts.lending_pool_config.total_usdc_swapped += minimum_usdc_out;
                ctx.accounts.lending_pool_config.last_swap_timestamp = Clock::get()?.unix_timestamp;

                msg!("✅ ATOMIC Jupiter swap completed: {} WHISKEY → ~{} USDC", lending_amount, minimum_usdc_out);
                */

                // DEVNET MODE: Update lending pool statistics without swap
                ctx.accounts.lending_pool_config.total_whiskey_received += lending_amount;
                // Note: total_usdc_swapped stays 0 in devnet mode
                ctx.accounts.lending_pool_config.last_swap_timestamp = Clock::get()?.unix_timestamp;

                msg!("✅ DEVNET MODE: Lending pool updated without Jupiter swap");
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
        bump,
        constraint = whiskey_usdc_vault.key() == lending_pool_config.usdc_vault @ ErrorCode::InvalidVault
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
        #[account(address = collection_config.collection_mint)]
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
        #[account(mut, address = collection_config.authority)]
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
        #[account(
        mut,
        seeds = [LENDING_POOL_SEED, b"whiskey_vault_v2"],
        bump
    )]
    pub lending_pool_whiskey_vault: Account<'info, TokenAccount>,

    // Lending pool USDC vault (PDA-controlled)
    #[account(
        mut,
        seeds = [LENDING_POOL_SEED, b"usdc_vault_v2"],
        bump
    )]
    pub lending_pool_usdc_vault: Account<'info, TokenAccount>,

    // Treasury wallet's WHISKEY token account (where ALL fees go)
    #[account(
        mut,
        associated_token::mint = whiskey_token_mint,
        associated_token::authority = treasury_wallet
    )]
    pub treasury_whiskey_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury wallet (admin's actual wallet for profit withdrawal)
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

            /// CHECK: USDC mint for Jupiter swap (COMMENTED OUT FOR DEVNET)
        // #[account(address = USDC_MINT)]
        // pub usdc_mint: UncheckedAccount<'info>,

    /// CHECK: Jupiter program for REAL CPI swaps - COMMENTED OUT FOR DEVNET
    // #[account(address = JUPITER_PROGRAM_ID)]
    // pub jupiter_program: UncheckedAccount<'info>,

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
    #[msg("Unauthorized: Caller is not the super admin.")]
    UnauthorizedSuperAdmin,
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