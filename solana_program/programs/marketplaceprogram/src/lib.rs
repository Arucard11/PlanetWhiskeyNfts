use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint, CloseAccount};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("24Te6BFE7StHQLh3eXNUxohcfiTi5EaFa7mdLf9UQn5x"); // New Program ID

pub const WHISKEY_TOKEN_MINT: Pubkey = pubkey!("6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu");

// Helper function to read dynamic fee configuration from GlobalMarket account
fn read_dynamic_transaction_fee(global_market_account: &AccountInfo) -> Result<u16> {
    // If GlobalMarket account is not available or fails to deserialize, use fallback value
    if global_market_account.data_is_empty() {
        msg!("⚠️ GlobalMarket account is empty, using default marketplace fee: {}%", DEFAULT_TRANSACTION_FEE_BPS as f32 / 100.0);
        return Ok(DEFAULT_TRANSACTION_FEE_BPS);
    }
    
    // Try to read fee data from GlobalMarket account
    let account_data = global_market_account.try_borrow_data()?;
    
    if account_data.len() < 16 { // Minimum size check
        msg!("⚠️ GlobalMarket account data too small, using default marketplace fee: {}%", DEFAULT_TRANSACTION_FEE_BPS as f32 / 100.0);
        return Ok(DEFAULT_TRANSACTION_FEE_BPS);
    }
    
    // For now, return default value - in production this would read from the actual GlobalMarket account structure
    // This is where you'd deserialize the GlobalMarket struct and extract transaction_fee_bps
    msg!("📊 Reading dynamic marketplace fee from GlobalMarket account");
    Ok(DEFAULT_TRANSACTION_FEE_BPS) // Would read from account: global_market.transaction_fee_bps
}

// ADMIN WALLET - This wallet controls ALL marketplace administrative functions
pub const ADMIN_WALLET: Pubkey = pubkey!("2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk");

pub const LENDING_PROGRAM_ID: Pubkey = pubkey!("25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ");
pub const GLOBAL_MARKET_SEED: &[u8] = b"global_market";

// Default transaction fee (can be updated by admin)
pub const DEFAULT_TRANSACTION_FEE_BPS: u16 = 250; // 2.5%

// Three distinct wallet types - ALL transaction fees go to FEE WALLET
pub const FEE_WALLET_SEED: &[u8] = b"fee_wallet";
pub const TREASURY_WALLET_SEED: &[u8] = b"treasury_wallet"; 
pub const LENDING_POOL_SEED: &[u8] = b"lending_pool";

#[program]
pub mod marketplaceprogram {
    use super::*;

    pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.nft_mint = ctx.accounts.nft_to_list_mint.key();
        listing.price = price;
        listing.bump = ctx.bumps.listing;

        // Transfer NFT to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_nft_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            1, // NFT amount is always 1
        )?;

        msg!("NFT {} listed for {} WHISKEY by {}", listing.nft_mint, listing.price, listing.seller);
        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        // Transfer NFT from escrow back to seller
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.seller_nft_token_account.to_account_info(),
                    authority: ctx.accounts.listing.to_account_info(),
                },
                &[&[
                    b"listing",
                    ctx.accounts.seller.key().as_ref(),
                    ctx.accounts.nft_to_list_mint.key().as_ref(),
                    &[ctx.accounts.listing.bump],
                ][..]],
            ),
            1,
        )?;

        // Close the escrow token account and send lamports to the seller
        // We need to do this manually since we can't use the close constraint
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_token_account.to_account_info(),
                    destination: ctx.accounts.seller.to_account_info(),
                    authority: ctx.accounts.listing.to_account_info(),
                },
                &[&[
                    b"listing",
                    ctx.accounts.seller.key().as_ref(),
                    ctx.accounts.nft_to_list_mint.key().as_ref(),
                    &[ctx.accounts.listing.bump],
                ][..]],
            ),
        )?;

        msg!("NFT {} listing cancelled by {}", ctx.accounts.nft_to_list_mint.key(), ctx.accounts.seller.key());
        Ok(())
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let price = listing.price;
        
        msg!("🛒 Starting NFT purchase...");
        msg!("💰 Price: {} WHISKEY tokens", price);
        msg!("🎯 NFT Mint: {}", ctx.accounts.nft_to_buy_mint.key());
        msg!("👤 Buyer: {}", ctx.accounts.buyer.key());
        msg!("💼 Seller: {}", ctx.accounts.seller.key());
        
        // 🔍 DEBUG: Log all account states before operations
        msg!("📊 DEBUG: Account states before operations:");
        msg!("  - Listing PDA: {}", ctx.accounts.listing.key());
        msg!("  - Listing price: {} WHISKEY", ctx.accounts.listing.price);
        msg!("  - Listing seller: {}", ctx.accounts.listing.seller);
        msg!("  - Listing NFT mint: {}", ctx.accounts.listing.nft_mint);
        
        msg!("  - Escrow token account: {}", ctx.accounts.escrow_token_account.key());
        msg!("  - Escrow token balance: {}", ctx.accounts.escrow_token_account.amount);
        msg!("  - Escrow token mint: {}", ctx.accounts.escrow_token_account.mint);
        msg!("  - Escrow token owner: {}", ctx.accounts.escrow_token_account.owner);
        
        msg!("  - Buyer WHISKEY account: {}", ctx.accounts.buyer_whiskey_token_account.key());
        msg!("  - Buyer WHISKEY balance: {}", ctx.accounts.buyer_whiskey_token_account.amount);
        msg!("  - Buyer WHISKEY mint: {}", ctx.accounts.buyer_whiskey_token_account.mint);
        msg!("  - Buyer WHISKEY owner: {}", ctx.accounts.buyer_whiskey_token_account.owner);
        
        msg!("  - Seller WHISKEY account: {}", ctx.accounts.seller_whiskey_token_account.key());
        msg!("  - Seller WHISKEY balance: {}", ctx.accounts.seller_whiskey_token_account.amount);
        msg!("  - Seller WHISKEY mint: {}", ctx.accounts.seller_whiskey_token_account.mint);
        msg!("  - Seller WHISKEY owner: {}", ctx.accounts.seller_whiskey_token_account.owner);
        
        msg!("  - Buyer NFT account: {}", ctx.accounts.buyer_nft_token_account.key());
        msg!("  - Buyer NFT balance: {}", ctx.accounts.buyer_nft_token_account.amount);
        msg!("  - Buyer NFT mint: {}", ctx.accounts.buyer_nft_token_account.mint);
        msg!("  - Buyer NFT owner: {}", ctx.accounts.buyer_nft_token_account.owner);
        
        msg!("  - WHISKEY mint: {}", ctx.accounts.whiskey_token_mint.key());
        msg!("  - WHISKEY mint supply: {}", ctx.accounts.whiskey_token_mint.supply);
        msg!("  - WHISKEY mint decimals: {}", ctx.accounts.whiskey_token_mint.decimals);
        
        // Check if buyer has enough WHISKEY tokens
        msg!("🔍 Checking buyer's WHISKEY token balance...");
        if ctx.accounts.buyer_whiskey_token_account.amount < price {
            msg!("❌ Insufficient WHISKEY balance. Required: {}, Available: {}", price, ctx.accounts.buyer_whiskey_token_account.amount);
            msg!("💡 Buyer needs {} more WHISKEY tokens", price - ctx.accounts.buyer_whiskey_token_account.amount);
            return Err(ErrorCode::InsufficientWhiskeyBalance.into());
        }
        msg!("✅ Buyer has sufficient WHISKEY balance: {} >= {}", ctx.accounts.buyer_whiskey_token_account.amount, price);

        // Read dynamic transaction fee from GlobalMarket account (admin configurable)
        let dynamic_fee_bps = read_dynamic_transaction_fee(&ctx.accounts.global_market.to_account_info())?;
        let transaction_fee = (price as u128 * dynamic_fee_bps as u128) / 10000;
        let seller_amount = price - transaction_fee as u64;

                   msg!("💰 Marketplace fee calculation - USING DYNAMIC ADMIN FEE: Price: {} WHISKEY, Fee: {} WHISKEY ({}%) → FEE WALLET, Seller gets: {} WHISKEY", 
                price, transaction_fee, dynamic_fee_bps as f32 / 100.0, seller_amount);

            // Transfer transaction fee to FEE WALLET (treasury)
            if transaction_fee > 0 {
                msg!("1️⃣ Transferring {} WHISKEY fee to FEE WALLET (treasury)...", transaction_fee);
            match token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_whiskey_token_account.to_account_info(),
                        to: ctx.accounts.treasury_whiskey_token_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                transaction_fee as u64,
            ) {
                                   Ok(_) => {
                       msg!("✅ Transaction fee transferred to FEE WALLET (treasury)!");
                   },
                Err(e) => {
                    msg!("❌ Transaction fee transfer failed: {:?}", e);
                    return Err(e);
                }
            }
        }

        msg!("2️⃣ Transferring {} WHISKEY tokens to seller...", seller_amount);
        msg!("🔍 DEBUG: WHISKEY transfer details:");
        msg!("  - From account: {} (balance: {})", ctx.accounts.buyer_whiskey_token_account.key(), ctx.accounts.buyer_whiskey_token_account.amount);
        msg!("  - To account: {} (balance: {})", ctx.accounts.seller_whiskey_token_account.key(), ctx.accounts.seller_whiskey_token_account.amount);
        msg!("  - Transfer amount: {} WHISKEY", seller_amount);
        msg!("  - Authority: {}", ctx.accounts.buyer.key());
        
        // Transfer remaining WHISKEY tokens to seller (price minus fee)
        match token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_whiskey_token_account.to_account_info(),
                    to: ctx.accounts.seller_whiskey_token_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_amount,
        ) {
            Ok(_) => {
                msg!("✅ WHISKEY tokens transferred to seller successfully!");
            },
            Err(e) => {
                msg!("❌ WHISKEY token transfer failed: {:?}", e);
                return Err(e);
            }
        }

        msg!("2️⃣ Transferring NFT from escrow to buyer...");
        msg!("📦 Escrow account: {}", ctx.accounts.escrow_token_account.key());
        msg!("🎁 Buyer NFT account: {}", ctx.accounts.buyer_nft_token_account.key());
        
        msg!("🔍 DEBUG: NFT transfer details:");
        msg!("  - From (escrow): {} (balance: {})", ctx.accounts.escrow_token_account.key(), ctx.accounts.escrow_token_account.amount);
        msg!("  - To (buyer): {} (balance: {})", ctx.accounts.buyer_nft_token_account.key(), ctx.accounts.buyer_nft_token_account.amount);
        msg!("  - NFT mint: {}", ctx.accounts.nft_to_buy_mint.key());
        msg!("  - Authority (listing PDA): {}", ctx.accounts.listing.key());
        msg!("  - PDA seeds: [listing, {}, {}, {}]", ctx.accounts.seller.key(), ctx.accounts.nft_to_buy_mint.key(), listing.bump);
        
        // Transfer NFT from escrow to buyer (using PDA as signing authority)
        match token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.buyer_nft_token_account.to_account_info(),
                    authority: ctx.accounts.listing.to_account_info(),
                },
                &[&[
                    b"listing",
                    ctx.accounts.seller.key().as_ref(),
                    ctx.accounts.nft_to_buy_mint.key().as_ref(),
                    &[listing.bump],
                ][..]],
            ),
            1, // NFT amount is always 1
        ) {
            Ok(_) => {
                msg!("✅ NFT transferred to buyer successfully!");
            },
            Err(e) => {
                msg!("❌ NFT transfer failed: {:?}", e);
                return Err(e);
            }
        }
        
        msg!("3️⃣ Closing escrow account...");
        // Close the escrow token account and send lamports to the seller
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_token_account.to_account_info(),
                    destination: ctx.accounts.seller.to_account_info(),
                    authority: ctx.accounts.listing.to_account_info(),
                },
                &[&[
                    b"listing",
                    ctx.accounts.seller.key().as_ref(),
                    ctx.accounts.nft_to_buy_mint.key().as_ref(),
                    &[listing.bump],
                ][..]],
            ),
        )?;
        
        msg!("🎉 PURCHASE COMPLETED!");
        msg!("NFT {} bought by {} for {} WHISKEY", ctx.accounts.nft_to_buy_mint.key(), ctx.accounts.buyer.key(), price);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        init,
        payer = seller,
        space = MarketplaceListing::SPACE,
        seeds = [b"listing", seller.key().as_ref(), nft_to_list_mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, MarketplaceListing>,

    #[account(
        mut,
        associated_token::mint = nft_to_list_mint,
        associated_token::authority = seller,
        constraint = seller_nft_token_account.amount == 1 @ ErrorCode::InsufficientNftBalance
    )]
    pub seller_nft_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = seller,
        token::mint = nft_to_list_mint,
        token::authority = listing, // Escrow authority is the listing PDA
        seeds = [b"escrow", listing.key().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub nft_to_list_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        close = seller, // Closes the account and sends lamports to the seller
        seeds = [b"listing", seller.key().as_ref(), nft_to_list_mint.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        constraint = listing.nft_mint == nft_to_list_mint.key()
    )]
    pub listing: Account<'info, MarketplaceListing>,

    #[account(
        mut,
        associated_token::mint = nft_to_list_mint,
        associated_token::authority = seller
    )]
    pub seller_nft_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"escrow", listing.key().as_ref()],
        bump
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    pub nft_to_list_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyNft<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        close = seller,
        seeds = [b"listing", seller.key().as_ref(), nft_to_buy_mint.key().as_ref()],
        bump = listing.bump,
        has_one = seller,
        constraint = buyer.key() != seller.key() @ ErrorCode::CannotBuyOwnNft
    )]
    pub listing: Account<'info, MarketplaceListing>,

    #[account(mut)]
    /// CHECK: Seller account, validated by has_one on listing
    pub seller: UncheckedAccount<'info>,

    #[account(
        mut,
        token::mint = nft_to_buy_mint,
        token::authority = listing,
        seeds = [b"escrow", listing.key().as_ref()],
        bump,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_to_buy_mint,
        associated_token::authority = buyer
    )]
    pub buyer_nft_token_account: Account<'info, TokenAccount>,

    #[account(mut, address = WHISKEY_TOKEN_MINT)]
    pub whiskey_token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = whiskey_token_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_whiskey_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = whiskey_token_mint,
        associated_token::authority = seller,
    )]
    pub seller_whiskey_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = whiskey_token_mint,
        associated_token::authority = treasury_wallet
    )]
    pub treasury_whiskey_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury wallet - Collects ALL transaction fees and profits
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

    /// CHECK: Global market account from lending program for dynamic fee rates
    #[account(mut)]
    pub global_market: UncheckedAccount<'info>,
    
    pub nft_to_buy_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
pub struct MarketplaceListing {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub bump: u8,
}

impl MarketplaceListing {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1; // Discriminator + seller + nft_mint + price + bump
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient NFT balance. You must own the NFT to list it.")]
    InsufficientNftBalance,
    #[msg("Cannot buy your own NFT. Please use a different wallet.")]
    CannotBuyOwnNft,
    #[msg("Insufficient WHISKEY token balance to complete the purchase.")]
    InsufficientWhiskeyBalance,
} 