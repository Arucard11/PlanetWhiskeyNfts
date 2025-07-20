use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, CreateMasterEditionV3,
        CreateMetadataAccountsV3, Metadata,
    },
    token::{mint_to, transfer, Mint, MintTo, Token, TokenAccount, Transfer},
};

declare_id!("8uPZVD859ZxgeptYWM4oKrzjMksBD9h6hYCxQbiQjS5L"); // Temporary valid ID

// Whiskey token mint addresses
// REAL PRODUCTION ADDRESS: 9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph
// TEST TOKEN ADDRESS (for development): Hjy8sNxUneizfMaWKXmdaTrKxw8C6AchBNHu2jfXFkfu
pub const WHISKEY_TOKEN_MINT: Pubkey = pubkey!("Hjy8sNxUneizfMaWKXmdaTrKxw8C6AchBNHu2jfXFkfu"); // Test token

#[account]
pub struct CollectionConfig {
    pub authority: Pubkey, // The authority that can manage this collection (e.g., update price)
    pub collection_mint: Pubkey, // The mint address of the Metaplex Collection NFT
    pub name: String,      // Collection Name (used for metadata)
    pub symbol: String,    // Collection Symbol (used for metadata)
    pub metadata_uri: String, // URI to the collection's JSON metadata (on Arweave/IPFS)
    pub mint_price_sol: u64,   // Price in lamports to mint one NFT from this collection
    pub mint_price_whiskey: u64, // Price in whiskey tokens to mint one NFT from this collection
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

// Maximum length for strings to prevent excessive account size
const MAX_NAME_LENGTH: usize = 32;
const MAX_SYMBOL_LENGTH: usize = 10;
const MAX_URI_LENGTH: usize = 200;
const MAX_NFTS_PER_WALLET_PER_COLLECTION: u8 = 5;

impl CollectionConfig {
    // Calculate space based on max string lengths + other fixed-size fields
    // 8 (discriminator) + 32 (authority) + 32 (collection_mint) +
    // (4 + MAX_NAME_LENGTH) + (4 + MAX_SYMBOL_LENGTH) + (4 + MAX_URI_LENGTH) +
    // 8 (mint_price_sol) + 8 (mint_price_whiskey) + 8 (item_limit) + 8 (items_minted) + 1 (bump)
    const SPACE: usize = 8 + 32 + 32 + (4 + MAX_NAME_LENGTH) + (4 + MAX_SYMBOL_LENGTH) + (4 + MAX_URI_LENGTH) + 8 + 8 + 8 + 8 + 1;
}

impl WalletNftCounter {
    // 8 (discriminator) + 32 (wallet) + 1 (nft_count) + 1 (bump)
    const SPACE: usize = 8 + 32 + 1 + 1;
}

#[account]
pub struct ProgramAdminConfig {
    pub super_admin_key: Pubkey, // The master admin key for the program
    pub bump: u8,
}

impl ProgramAdminConfig {
    // 8 (discriminator) + 32 (super_admin_key) + 1 (bump)
    const SPACE: usize = 8 + 32 + 1;
}

// Payment method enum removed - only whiskey tokens are accepted

#[program]
pub mod whiskeyprogram {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
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
        config.super_admin_key = ctx.accounts.payer.key(); // The payer becomes the super admin
        config.bump = ctx.bumps.program_admin_config;
        msg!("Super admin initialized with key: {}", config.super_admin_key);
        Ok(())
    }

    #[derive(Accounts)]
    #[instruction(name: String, symbol: String, metadata_uri: String)]
    pub struct CreateCollectionAccounts<'info> {
        #[account(mut)]
        pub payer: Signer<'info>, // This is your backend's wallet, which must match super_admin_key

        #[account(
            seeds = [b"program_super_admin"], // Use the same seeds as in InitializeSuperAdmin
            bump = program_admin_config.bump
        )]
        pub program_admin_config: Account<'info, ProgramAdminConfig>,

        #[account(
            init_if_needed,
            payer = payer,
            space = CollectionConfig::SPACE,
            seeds = [b"collection".as_ref(), name.as_bytes()],
            bump
        )]
        pub collection_config: Account<'info, CollectionConfig>,
        #[account(
            init,
            payer = payer,
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
            payer = payer,
            associated_token::mint = collection_mint,
            associated_token::authority = payer
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
        item_limit: u64,
    ) -> Result<()> {
        msg!("CREATE_COLLECTION_HANDLER_ENTRY_POINT_LOG");

        msg!("Debugging account keys from ctx.accounts:");
        msg!("  payer: {}", ctx.accounts.payer.key());
        msg!("  program_admin_config: {}", ctx.accounts.program_admin_config.key());
        msg!("  collection_config: {}", ctx.accounts.collection_config.key());
        msg!("  collection_mint (passed in): {}", ctx.accounts.collection_mint.key());
        msg!("  metadata_account (passed in): {}", ctx.accounts.metadata_account.key());
        msg!("  master_edition_account (passed in): {}", ctx.accounts.master_edition_account.key());
        msg!("  token_account (passed in): {}", ctx.accounts.token_account.key());
        msg!("  token_program: {}", ctx.accounts.token_program.key());
        msg!("  associated_token_program: {}", ctx.accounts.associated_token_program.key());
        msg!("  token_metadata_program: {}", ctx.accounts.token_metadata_program.key());
        msg!("  system_program: {}", ctx.accounts.system_program.key());
        msg!("  rent: {}", ctx.accounts.rent.key());
        
        // Log received arguments
        msg!("Program received name: '{}'", name);
        msg!("Program received symbol: '{}'", symbol);
        msg!("Program received metadata_uri: '{}'", metadata_uri);
        msg!("Program received mint_price_sol: {}", mint_price_sol);
        msg!("Program received mint_price_whiskey: {}", mint_price_whiskey);
        msg!("Program received item_limit: {}", item_limit);
        msg!("Program derived collection_config key: {}", ctx.accounts.collection_config.key());

        // AUTHORIZATION CHECK
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.program_admin_config.super_admin_key,
            ErrorCode::UnauthorizedSuperAdmin
        );
        msg!("Payer is authorized super admin.");
        
        // 1. Validate inputs
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

        msg!("Inputs validated.");
        msg!("Name: {}", name);
        msg!("Symbol: {}", symbol);
        msg!("Metadata URI: {}", metadata_uri);
        msg!("Mint Price (SOL): {}", mint_price_sol);
        msg!("Mint Price (Whiskey): {}", mint_price_whiskey);
        msg!("Item Limit: {}", item_limit);

        // Mint 1 token to the payer's ATA for the collection_mint
        // This makes the collection_mint an actual NFT with supply 1
        msg!("Minting 1 token to payer's ATA...");
        let cpi_accounts_mint_to = MintTo {
            mint: ctx.accounts.collection_mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.collection_config.to_account_info(), // Changed: PDA signs
        };
        let cpi_program_mint_to = ctx.accounts.token_program.to_account_info();
        
        // Correctly prepare signer seeds using the 'name' function argument and bump from ctx
        let name_arg_bytes = name.as_bytes(); // Use the function argument 'name'
        let seeds = &[
            b"collection".as_ref(),
            name_arg_bytes,
            &[ctx.bumps.collection_config], // Use the bump from the Accounts context
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx_mint_to = CpiContext::new_with_signer(
            cpi_program_mint_to,
            cpi_accounts_mint_to,
            signer_seeds, // PDA signs for minting
        );
        mint_to(cpi_ctx_mint_to, 1)?; // Mint 1 token
        msg!("Token minted to payer's ATA.");

        // CPI to token_metadata_program to create metadata_account
        msg!("Creating metadata account...");
        let cpi_accounts_metadata = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata_account.to_account_info(),
            mint: ctx.accounts.collection_mint.to_account_info(),
            mint_authority: ctx.accounts.collection_config.to_account_info(), // Changed: PDA is mint_authority
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.collection_config.to_account_info(), // Changed: PDA is update_authority
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program_metadata = ctx.accounts.token_metadata_program.to_account_info();
        let cpi_ctx_metadata = CpiContext::new_with_signer(
            cpi_program_metadata,
            cpi_accounts_metadata,
            signer_seeds, // PDA signs
        );

        let data_v2 = anchor_spl::metadata::mpl_token_metadata::types::DataV2 {
            name: name.clone(), // Use the cloned name from args
            symbol: symbol.clone(), // Use the cloned symbol from args
            uri: metadata_uri.clone(), // Use the cloned metadata_uri from args
            seller_fee_basis_points: 0,
            creators: Some(vec![
                anchor_spl::metadata::mpl_token_metadata::types::Creator {
                    address: ctx.accounts.collection_config.key(), // PDA is a creator
                    verified: true, // PDA is verified by its own signature
                    share: 100,
                },
            ]),
            collection: None,
            uses: None,
        };

        create_metadata_accounts_v3(
            cpi_ctx_metadata,
            data_v2,
            false, // is_mutable
            true,  // update_authority_is_signer (PDA is the signer)
            None,  // collection_details
        )?;
        msg!("Metadata account created.");

        // CPI to token_metadata_program to create master_edition_account
        msg!("Creating master edition account...");
        let cpi_accounts_master_edition = CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition_account.to_account_info(),
            mint: ctx.accounts.collection_mint.to_account_info(),
            update_authority: ctx.accounts.collection_config.to_account_info(), // Changed: PDA is update_authority
            mint_authority: ctx.accounts.collection_config.to_account_info(), // Changed: PDA is mint_authority
            payer: ctx.accounts.payer.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };
        let cpi_program_master_edition = ctx.accounts.token_metadata_program.to_account_info();
        let cpi_ctx_master_edition = CpiContext::new_with_signer(
            cpi_program_master_edition,
            cpi_accounts_master_edition,
            signer_seeds, // PDA signs
        );

        create_master_edition_v3(
            cpi_ctx_master_edition,
            Some(0), // max_supply: 0 for a master edition
        )?;
        msg!("Master edition account created.");

        // Initialize the CollectionConfig PDA data
        let collection_config = &mut ctx.accounts.collection_config;
        collection_config.authority = ctx.accounts.payer.key(); // Keep original super_admin as authority over config
        collection_config.collection_mint = ctx.accounts.collection_mint.key();
        collection_config.name = name; // Store the original name from args
        collection_config.symbol = symbol; // Store the original symbol from args
        collection_config.metadata_uri = metadata_uri; // Store the original metadata_uri from args
        collection_config.mint_price_sol = mint_price_sol;
        collection_config.mint_price_whiskey = mint_price_whiskey;
        collection_config.item_limit = item_limit;
        collection_config.items_minted = 0;
        collection_config.bump = ctx.bumps.collection_config;

        msg!("CollectionConfig PDA initialized.");
        msg!("Authority: {}", collection_config.authority);
        msg!("Collection Mint: {}", collection_config.collection_mint);
        msg!("Name: {}", collection_config.name);
        msg!("Symbol: {}", collection_config.symbol);
        msg!("Metadata URI: {}", collection_config.metadata_uri);
        msg!("Bump: {}", collection_config.bump);

        Ok(())
    }

    // Add the new MintNft instruction and its Accounts struct here
    #[derive(Accounts)]
    #[instruction(nft_name: String, nft_symbol: String, nft_uri: String)]
    pub struct MintNft<'info> {
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
        pub collection_mint_account: Account<'info, Mint>, // Renamed to avoid conflict if we have collection_mint elsewhere

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

        // For whiskey token payments - these are required since we only accept whiskey tokens
        /// CHECK: Whiskey token mint account
        #[account(address = WHISKEY_TOKEN_MINT)]
        pub whiskey_token_mint: Account<'info, Mint>,

        // Payer's whiskey token account - create if needed
        #[account(
            init_if_needed,
            payer = payer,
            associated_token::mint = whiskey_token_mint,
            associated_token::authority = payer
        )]
        pub payer_whiskey_token_account: Account<'info, TokenAccount>,

        // Authority's whiskey token account for receiving payment - create if needed
        #[account(
            init_if_needed,
            payer = payer,
            associated_token::mint = whiskey_token_mint,
            associated_token::authority = collection_authority_receiver
        )]
        pub authority_whiskey_token_account: Account<'info, TokenAccount>,

        // System Programs
        pub token_program: Program<'info, Token>,
        pub associated_token_program: Program<'info, AssociatedToken>,
        pub token_metadata_program: Program<'info, Metadata>, // Metaplex Token Metadata Program
        pub system_program: Program<'info, System>,
        pub rent: Sysvar<'info, Rent>,
    }

    pub fn mint_nft(ctx: Context<MintNft>, nft_name: String, nft_symbol: String, nft_uri: String) -> Result<()> {
        msg!("MINT_NFT_HANDLER_ENTRY_POINT_LOG");
        let collection_config = &mut ctx.accounts.collection_config;
        let wallet_counter = &mut ctx.accounts.wallet_nft_counter;

        // 1. Check wallet NFT limit PER COLLECTION
        if wallet_counter.nft_count >= MAX_NFTS_PER_WALLET_PER_COLLECTION {
            return Err(ErrorCode::WalletNftLimitExceeded.into());
        }

        // 2. Check collection item limit
        if collection_config.items_minted >= collection_config.item_limit {
            return Err(ErrorCode::CollectionFull.into());
        }

        // 3. Initialize wallet counter if needed
        if wallet_counter.wallet == Pubkey::default() {
            wallet_counter.wallet = ctx.accounts.payer.key();
            wallet_counter.nft_count = 0;
            wallet_counter.bump = ctx.bumps.wallet_nft_counter;
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
        
        // 5. Handle payment - only whiskey tokens are accepted
        if collection_config.mint_price_whiskey > 0 {
            // Transfer whiskey tokens from payer to authority
            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_whiskey_token_account.to_account_info(),
                        to: ctx.accounts.authority_whiskey_token_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                collection_config.mint_price_whiskey,
            )?;
            msg!("Transferred {} whiskey tokens from payer to collection authority.", collection_config.mint_price_whiskey);
        }

        // Signer seeds for the CollectionConfig PDA
        let collection_name_bytes = collection_config.name.as_bytes();
        let seeds = &[
            b"collection".as_ref(),
            collection_name_bytes,
            &[collection_config.bump],
        ];
        let signer_seeds = &[&seeds[..]];

        // 4. Mint the new NFT to the payer's ATA
        msg!("Minting new NFT to payer's ATA...");
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    to: ctx.accounts.nft_token_account.to_account_info(),
                    authority: collection_config.to_account_info(), // PDA is authority
                },
                signer_seeds,
            ),
            1, // Mint 1 token
        )?;
        msg!("New NFT minted to payer's ATA.");

        // 5. Create Metadata for the new NFT
        msg!("Creating metadata for new NFT...");
        let creators = vec![
            anchor_spl::metadata::mpl_token_metadata::types::Creator {
                address: collection_config.key(), // Collection PDA is a creator
                verified: true, // Verified by its own signature as authority
                share: 0, // Collection PDA doesn't take a share of secondary sales by default
            },
            anchor_spl::metadata::mpl_token_metadata::types::Creator {
                address: ctx.accounts.payer.key(), // Minter can also be a creator
                verified: false, // Minter is not verified by default in this CPI
                share: 100, // Minter gets 100% of this specific creator share
            },
            // Optionally add collection_config.authority as a creator too
            // anchor_spl::metadata::mpl_token_metadata::types::Creator {
            //     address: collection_config.authority,
            //     verified: false, 
            //     share: 0, 
            // },
        ];

        let nft_data_v2 = anchor_spl::metadata::mpl_token_metadata::types::DataV2 {
            name: nft_name,
            symbol: nft_symbol,
            uri: nft_uri,
            seller_fee_basis_points: 0, // Example: 0 royalties from this program's perspective
            creators: Some(creators),
            collection: Some(anchor_spl::metadata::mpl_token_metadata::types::Collection {
                verified: false, // This will be verified in a separate instruction by the collection authority typically
                key: ctx.accounts.collection_mint_account.key(),
            }),
            uses: None,
        };

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.nft_metadata_account.to_account_info(),
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    mint_authority: collection_config.to_account_info(),      // PDA is mint_authority
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: collection_config.to_account_info(),  // PDA is update_authority
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            nft_data_v2,
            true, // is_mutable: metadata can be updated later by update_authority (PDA)
            true, // update_authority_is_signer: PDA is signer
            None, // collection_details (For Master Edition, this is None)
        )?;
        msg!("New NFT metadata created.");

        // 6. Create Master Edition for the new NFT
        msg!("Creating master edition for new NFT...");
        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.nft_master_edition_account.to_account_info(),
                    mint: ctx.accounts.nft_mint.to_account_info(),
                    update_authority: collection_config.to_account_info(), // PDA is update_authority
                    mint_authority: collection_config.to_account_info(),   // PDA is mint_authority
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.nft_metadata_account.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer_seeds,
            ),
            Some(0), // max_supply: 0 for a Master Edition NFT (non-fungible)
        )?;
        msg!("New NFT master edition created.");

        // 7. Increment items_minted in CollectionConfig
        collection_config.items_minted += 1;
        msg!("Incremented items_minted. New count: {}", collection_config.items_minted);

        // 8. Increment wallet NFT counter
        wallet_counter.nft_count += 1;
        msg!("Incremented wallet NFT count. New count for wallet {}: {}", wallet_counter.wallet, wallet_counter.nft_count);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

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
}
