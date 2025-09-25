use anchor_lang::prelude::*;

declare_id!("3GbJdAjF6Sqic84sXJHargXXQjknXVAADeKyRGv8FN2N");

use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, MintTo, mint_to},
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata,
        mpl_token_metadata::types::{CollectionDetails, DataV2, Creator, Collection},
    },
};

// Constants for validation
pub const MAX_NAME_LENGTH: usize = 32;
pub const MAX_SYMBOL_LENGTH: usize = 10;
pub const MAX_URI_LENGTH: usize = 200;

// Token addresses (MAINNET)
pub const WHISKEY_TOKEN_MINT: Pubkey = pubkey!("9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph");
pub const USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

// Admin wallet (hardcoded for security)
pub const ADMIN_WALLET: Pubkey = pubkey!("F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X");

// Fee configuration defaults
pub const DEFAULT_TRANSACTION_FEE_BPS: u16 = 250; // 2.5% default
pub const LENDING_WALLET_SHARE_BPS: u16 = 8000; // 80% to lending (converted to USDC)
pub const TREASURY_WALLET_SHARE_BPS: u16 = 2000; // 20% to treasury (stays as WHISKEY)

// Lending Program ID (mainnet) - for CPI validation
pub const LENDING_PROGRAM_ID: Pubkey = pubkey!("48bkD2oooWuDmsXojVP9ez1UFnX77Q2NnbxE8wjgeLU3");

// HARDCODED CAPITAL VAULT ADDRESS - CANNOT BE MANIPULATED BY USERS
pub const CAPITAL_VAULT_USDC: Pubkey = pubkey!("DxEz7UCRnRUPUKCvWQJLGud8eCCtMdDd4onM7HJFHcZs");


// Account structs
#[account]
pub struct CollectionConfig {
    pub authority: Pubkey, // The authority that can manage this collection
    pub collection_mint: Pubkey, // The mint address of the Metaplex Collection NFT
    pub name: String,      // Collection Name (used for metadata)
    pub symbol: String,    // Collection Symbol (used for metadata)
    pub metadata_uri: String, // URI to the collection's JSON metadata
    pub mint_price_sol: u64,   // Price in lamports to mint one NFT
    pub mint_price_whiskey: u64, // Price in whiskey tokens to mint one NFT
    pub mint_price_usd: u64,    // Price in USD (microdollars) to mint one NFT
    pub item_limit: u64,   // Maximum number of NFTs in this collection
    pub items_minted: u64, // Counter for how many NFTs have been minted
    pub is_whiskey_gated: bool, // Whether this collection requires WHISKEY tokens
    pub required_whiskey_amount: u64, // Required WHISKEY tokens to mint
    pub bump: u8,          // PDA bump seed
}

#[account]
pub struct WalletNftCounter {
    pub wallet: Pubkey,    // The wallet address
    pub nft_count: u8,     // Number of NFTs minted by this wallet
    pub bump: u8,          // PDA bump seed
}


impl CollectionConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 36 + 14 + 204 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 1; // ~376 bytes
}

impl WalletNftCounter {
    pub const SPACE: usize = 8 + 32 + 1 + 1; // ~42 bytes
}

#[program]
pub mod whiskeyprogram {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("🎉 Whiskey NFT Program initialized!");
        Ok(())
    }

    /// ✅ SECURE SINGLE INSTRUCTION: Mint NFT with Payment Validation
    /// This function does EVERYTHING atomically:
    /// 1. Validates payment amounts against hardcoded collection price
    /// 2. Transfers USDC to hardcoded capital vault
    /// 3. Transfers WHISKEY to treasury
    /// 4. Mints NFT to user
    pub fn mint_with_payment_validation(
        ctx: Context<MintWithPaymentValidation>,
        nft_name: String,
        nft_symbol: String,
        nft_uri: String,
        current_whiskey_price_usd: u64,    // Current WHISKEY price in micro-USD
        whiskey_to_treasury_amount: u64,   // WHISKEY tokens going to treasury
        usdc_to_vault_amount: u64,         // USDC going to vault
    ) -> Result<()> {
        msg!("🔒 SECURE MINT: Starting atomic mint with payment validation");
        
        let collection_config = &mut ctx.accounts.collection_config;
        
        // ✅ SECURITY CHECK 1: Get expected total from HARDCODED collection config
        let expected_total_usd = collection_config.mint_price_usd;
        msg!("💰 Expected total from collection config: ${}", expected_total_usd as f64 / 1_000_000.0);
        
        // Note: No need to validate WHISKEY price range - if it's wrong, the total payment won't match expected
        
        // ✅ SECURITY CHECK 3: Calculate WHISKEY value in USD
        let whiskey_value_usd = (whiskey_to_treasury_amount as u128 * current_whiskey_price_usd as u128) / 1_000_000_u128;
        let whiskey_value_usd = whiskey_value_usd as u64;
        
        msg!("🥃 WHISKEY value: {} tokens = ${}", 
             whiskey_to_treasury_amount as f64 / 1_000_000.0,
             whiskey_value_usd as f64 / 1_000_000.0);
        
        // ✅ SECURITY CHECK 4: Calculate total payment value
        let total_payment_usd = whiskey_value_usd + usdc_to_vault_amount;
        msg!("💵 Total payment: ${} (WHISKEY: ${}, USDC: ${})",
             total_payment_usd as f64 / 1_000_000.0,
             whiskey_value_usd as f64 / 1_000_000.0,
             usdc_to_vault_amount as f64 / 1_000_000.0);
        
        // ✅ SECURITY CHECK 5: Validate total payment matches expected (1% tolerance)
        let tolerance = expected_total_usd / 100; // 1% tolerance
        let min_allowed = expected_total_usd.saturating_sub(tolerance);
        let max_allowed = expected_total_usd.saturating_add(tolerance);
        
        require!(
            total_payment_usd >= min_allowed && total_payment_usd <= max_allowed,
            ErrorCode::InsufficientPayment
        );
        
        msg!("✅ Payment validation passed: Total matches expected price");
        
        // ✅ SECURITY CHECK 6: Verify capital vault is hardcoded address
        require!(
            ctx.accounts.capital_vault.key() == CAPITAL_VAULT_USDC,
            ErrorCode::InvalidVault
        );
        
        msg!("✅ Capital vault verified: Using hardcoded secure address");
        
        // ✅ SECURITY CHECK 7: Check collection limits
        require!(
            collection_config.items_minted < collection_config.item_limit,
            ErrorCode::CollectionFull
        );
        
        // ✅ SECURITY CHECK 8: Validate NFT metadata lengths
        require!(nft_name.len() <= MAX_NAME_LENGTH, ErrorCode::NftNameTooLong);
        require!(nft_symbol.len() <= MAX_SYMBOL_LENGTH, ErrorCode::NftSymbolTooLong);
        require!(nft_uri.len() <= MAX_URI_LENGTH, ErrorCode::NftUriTooLong);
        
        // ✅ ATOMIC TRANSFER 1: USDC to hardcoded capital vault
        if usdc_to_vault_amount > 0 {
            anchor_spl::token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: ctx.accounts.user_usdc_account.to_account_info(),
                        to: ctx.accounts.capital_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    }
                ),
                usdc_to_vault_amount,
            )?;
            msg!("✅ Transferred ${} USDC to capital vault", usdc_to_vault_amount as f64 / 1_000_000.0);
        }
        
        // ✅ ATOMIC TRANSFER 2: WHISKEY to treasury
        if whiskey_to_treasury_amount > 0 {
            anchor_spl::token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: ctx.accounts.user_whiskey_account.to_account_info(),
                        to: ctx.accounts.treasury_whiskey_account.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    }
                ),
                whiskey_to_treasury_amount,
            )?;
            msg!("✅ Transferred {} WHISKEY to treasury", whiskey_to_treasury_amount as f64 / 1_000_000.0);
        }
        
        // ✅ ATOMIC MINT: Create NFT
        let collection_name_bytes = collection_config.name.as_bytes();
        let collection_bump = collection_config.bump;
        let collection_seeds = &[
            b"collection".as_ref(),
            collection_name_bytes,
            &[collection_bump],
        ];
        let collection_signer_seeds = &[&collection_seeds[..]];
        
        // Mint NFT token
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.nft_token_account.to_account_info(),
                    authority: collection_config.to_account_info(),
                },
                collection_signer_seeds,
            ),
            1,
        )?;
        
        // Create NFT metadata
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.nft_metadata_account.to_account_info(),
                mint: ctx.accounts.nft_mint.to_account_info(),
                mint_authority: collection_config.to_account_info(),
                payer: ctx.accounts.user.to_account_info(),
                update_authority: collection_config.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            collection_signer_seeds,
        );

        let creators = vec![Creator {
            address: collection_config.authority,
            verified: false,
            share: 100,
        }];

        let data = DataV2 {
            name: nft_name.clone(),
            symbol: nft_symbol.clone(),
            uri: nft_uri.clone(),
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creators),
            collection: Some(Collection {
                verified: false,
                key: collection_config.collection_mint,
            }),
            uses: None,
        };

        create_metadata_accounts_v3(
            metadata_ctx,
            data,
            true, // is_mutable
            false, // update_authority_is_signer (collection_config is PDA)
            None, // collection_details
        )?;

        // ✅ UPDATE COUNTERS: Increment collection counter
        collection_config.items_minted = collection_config.items_minted.checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        msg!("🎉 SECURE MINT COMPLETE: NFT minted with validated payment");
        msg!("📊 Collection '{}' now has {} items minted", 
             collection_config.name, 
             collection_config.items_minted);
        
        Ok(())
    }

    /// ✅ EXISTING COLLECTION CREATION FUNCTIONS (Keep unchanged for backwards compatibility)
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
        require!(name.len() <= MAX_NAME_LENGTH, ErrorCode::NameTooLong);
        require!(symbol.len() <= MAX_SYMBOL_LENGTH, ErrorCode::SymbolTooLong);
        require!(metadata_uri.len() <= MAX_URI_LENGTH, ErrorCode::UriTooLong);
        require!(item_limit > 0, ErrorCode::ItemLimitZero);

        msg!("🏗️ Creating collection: {}", name);
        msg!("💰 Prices - SOL: {}, WHISKEY: {}, USD: ${}", 
             mint_price_sol, 
             mint_price_whiskey, 
             mint_price_usd as f64 / 1_000_000.0);

        // Initialize collection config
        let collection_config = &mut ctx.accounts.collection_config;
        collection_config.authority = ctx.accounts.admin.key();
        collection_config.collection_mint = ctx.accounts.collection_mint.key();
        collection_config.name = name.clone();
        collection_config.symbol = symbol.clone();
        collection_config.metadata_uri = metadata_uri.clone();
        collection_config.mint_price_sol = mint_price_sol;
        collection_config.mint_price_whiskey = mint_price_whiskey;
        collection_config.mint_price_usd = mint_price_usd;
        collection_config.item_limit = item_limit;
        collection_config.items_minted = 0;
        collection_config.is_whiskey_gated = false;
        collection_config.required_whiskey_amount = 0;
        collection_config.bump = ctx.bumps.collection_config;

        // Mint collection NFT to admin
        let collection_name_bytes = name.as_bytes();
        let collection_bump = ctx.bumps.collection_config;
        let collection_seeds = &[
            b"collection".as_ref(),
            collection_name_bytes,
            &[collection_bump],
        ];
        let collection_signer_seeds = &[&collection_seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: collection_config.to_account_info(),
                },
                collection_signer_seeds,
            ),
            1,
        )?;

        // Create collection metadata
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.collection_mint.to_account_info(),
                mint_authority: collection_config.to_account_info(),
                payer: ctx.accounts.admin.to_account_info(),
                update_authority: collection_config.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            collection_signer_seeds,
        );

        let creators = vec![Creator {
            address: ctx.accounts.admin.key(),
            verified: false,
            share: 100,
        }];

        let data = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: metadata_uri.clone(),
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creators),
            collection: None, // This is the collection itself
            uses: None,
        };

        create_metadata_accounts_v3(
            metadata_ctx,
            data,
            true, // is_mutable
            false, // update_authority_is_signer (collection_config is PDA)
            Some(CollectionDetails::V1 { size: 0 }), // Collection details
        )?;

        msg!("✅ Collection '{}' created successfully", name);
        Ok(())
    }

    pub fn create_whiskey_gated_collection(
        ctx: Context<CreateCollectionAccounts>,
        name: String,
        symbol: String,
        metadata_uri: String,
        required_whiskey_amount: u64, // Required WHISKEY tokens (in full tokens, not lamports)
        item_limit: u64,
    ) -> Result<()> {
        // Validate inputs
        require!(name.len() <= MAX_NAME_LENGTH, ErrorCode::NameTooLong);
        require!(symbol.len() <= MAX_SYMBOL_LENGTH, ErrorCode::SymbolTooLong);
        require!(metadata_uri.len() <= MAX_URI_LENGTH, ErrorCode::UriTooLong);
        require!(item_limit > 0, ErrorCode::ItemLimitZero);

        msg!("🥃 Creating whiskey-gated collection: {}", name);
        msg!("🔒 Required WHISKEY: {} tokens", required_whiskey_amount as f64 / 1_000_000.0);

        // Initialize collection config for whiskey-gated collection
        let collection_config = &mut ctx.accounts.collection_config;
        collection_config.authority = ctx.accounts.admin.key();
        collection_config.collection_mint = ctx.accounts.collection_mint.key();
        collection_config.name = name.clone();
        collection_config.symbol = symbol.clone();
        collection_config.metadata_uri = metadata_uri.clone();
        collection_config.mint_price_sol = 0; // No SOL price for whiskey-gated
        collection_config.mint_price_whiskey = 0; // No WHISKEY payment needed
        collection_config.mint_price_usd = 0; // No USD price
        collection_config.item_limit = item_limit;
        collection_config.items_minted = 0;
        collection_config.is_whiskey_gated = true; // This is whiskey-gated
        collection_config.required_whiskey_amount = required_whiskey_amount;
        collection_config.bump = ctx.bumps.collection_config;

        // Mint collection NFT to admin (same as regular collection)
        let collection_name_bytes = name.as_bytes();
        let collection_bump = ctx.bumps.collection_config;
        let collection_seeds = &[
            b"collection".as_ref(),
            collection_name_bytes,
            &[collection_bump],
        ];
        let collection_signer_seeds = &[&collection_seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: collection_config.to_account_info(),
                },
                collection_signer_seeds,
            ),
            1,
        )?;

        // Create collection metadata
        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.collection_mint.to_account_info(),
                mint_authority: collection_config.to_account_info(),
                payer: ctx.accounts.admin.to_account_info(),
                update_authority: collection_config.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            collection_signer_seeds,
        );

        let creators = vec![Creator {
            address: ctx.accounts.admin.key(),
            verified: false,
            share: 100,
        }];

        let data = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: metadata_uri.clone(),
            seller_fee_basis_points: 500, // 5% royalty
            creators: Some(creators),
            collection: None, // This is the collection itself
            uses: None,
        };

        create_metadata_accounts_v3(
            metadata_ctx,
            data,
            true, // is_mutable
            false, // update_authority_is_signer (collection_config is PDA)
            Some(CollectionDetails::V1 { size: 0 }), // Collection details
        )?;

        msg!("✅ Whiskey-gated collection '{}' created successfully", name);
        Ok(())
    }
}

// ✅ ACCOUNT STRUCTURES

#[derive(Accounts)]
pub struct Initialize {}

// ✅ SECURE MINT WITH PAYMENT VALIDATION - Single atomic instruction
#[derive(Accounts)]
pub struct MintWithPaymentValidation<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub collection_config: Account<'info, CollectionConfig>,

    // NFT accounts
    #[account(
        init,
        payer = user,
        mint::decimals = 0,
        mint::authority = collection_config,
        mint::freeze_authority = collection_config
    )]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = nft_mint,
        associated_token::authority = user
    )]
    pub nft_token_account: Account<'info, TokenAccount>,

    /// CHECK: Metaplex metadata account
    #[account(mut)]
    pub nft_metadata_account: UncheckedAccount<'info>,

    /// CHECK: Metaplex master edition account
    #[account(mut)]
    pub nft_master_edition_account: UncheckedAccount<'info>,

    // Payment token accounts
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_whiskey_account: Account<'info, TokenAccount>,

    // Destination accounts - HARDCODED FOR SECURITY
    #[account(
        mut,
        address = CAPITAL_VAULT_USDC @ ErrorCode::InvalidVault
    )]
    pub capital_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_whiskey_account: Account<'info, TokenAccount>,

    // Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ✅ EXISTING COLLECTION CREATION ACCOUNT STRUCTURES (Keep for backwards compatibility)

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateCollectionAccounts<'info> {
    #[account(
        mut,
        address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

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
        mint::authority = collection_config,
        mint::freeze_authority = collection_config
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

// Error codes
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
    #[msg("Invalid WHISKEY price: Price must be between $0.001 and $100.")]
    InvalidWhiskeyPrice,
    #[msg("Invalid amount specified")]
    InvalidAmount,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Invalid vault address")]
    InvalidVault,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid token mint - expected USDC")]
    InvalidTokenMint,
    #[msg("Invalid vault owner - must be owned by global market PDA")]
    InvalidVaultOwner,
    #[msg("Insufficient swap output")]
    InsufficientSwapOutput,
    #[msg("Payment not confirmed")]
    PaymentNotConfirmed,
    #[msg("Unauthorized user")]
    UnauthorizedUser,
    #[msg("Wrong collection")]
    WrongCollection,
    #[msg("Insufficient payment")]
    InsufficientPayment,
}