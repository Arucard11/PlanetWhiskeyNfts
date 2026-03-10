use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
    associated_token::AssociatedToken,
};
use mpl_token_metadata::accounts::Metadata;

declare_id!("C2ukp5uHz3DTYd2S5angyzAo12wbUi8ydgxGiUK4Y1Yh");

// Removed hardcoded whiskey program reference - no longer needed

// Constants - MAINNET ADDRESSES
pub const WHISKEY_TOKEN_MINT: Pubkey = pubkey!("9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph");

// ADMIN WALLET - This wallet controls ALL lending administrative functions
pub const ADMIN_WALLET: Pubkey = pubkey!("F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X");

// Seeds for PDAs - Project Constellation Architecture
pub const GLOBAL_MARKET_SEED: &[u8] = b"global_market";
pub const BORROWER_ACCOUNT_SEED: &[u8] = b"borrower_account";
pub const LOAN_SEED: &[u8] = b"loan";
pub const COLLATERAL_ESCROW_SEED: &[u8] = b"collateral_escrow";
// Removed NFT_AUCTION_SEED - no longer needed
pub const CAPITAL_VAULT_SEED: &[u8] = b"capital_vault_usdc";

// Token mint addresses (MAINNET)
pub const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // Real USDC mint for mainnet

// Loan duration constants (in seconds)
pub const ONE_MONTH_SECS: u32 = 2592000;   // 30 days
pub const TWO_MONTHS_SECS: u32 = 5184000;  // 60 days
pub const THREE_MONTHS_SECS: u32 = 7776000; // 90 days

/// Global Market State - Project Constellation Master Account
#[account]
#[derive(Default)]
pub struct GlobalMarket {
    // --- Authorities (MUST be multisig in production) ---
    pub owner: Pubkey,           // Governance authority (treasury wallet)
    pub liquidation_authority: Pubkey, // Dedicated liquidation authority (separate keypair)

    // --- Protocol Capital Vault (Where lending money is stored) ---
    pub capital_vault_usdc: Pubkey,  // Protocol's USDC lending capital
    
    // --- Treasury Wallet (Where ALL fees and profits go) ---
    pub treasury_wallet: Pubkey, // Admin's actual wallet for profit withdrawal

    // --- NFT Configuration ---
    pub collection_registry: Pubkey, // PDA to the main CollectionRegistry account
    pub max_staked_nfts: u32,       // Global collateral cap (500-10,000)
    pub current_staked_nfts: u32,   // Current NFTs used as collateral
    pub per_nft_value_usd: u64,     // DEPRECATED: Fixed USD value per NFT (kept for backward compatibility)

    // --- Dynamic Interest Rates (Admin Configurable 2.5% - 25%) ---
    pub base_interest_rate_1_month_bps: u16,  // Base 1 month rate (when utilization = 0%)
    pub base_interest_rate_2_month_bps: u16,  // Base 2 month rate (when utilization = 0%)
    pub base_interest_rate_3_month_bps: u16,  // Base 3 month rate (when utilization = 0%)
    
    // --- Utilization-Based Rate Multipliers ---
    pub max_interest_rate_multiplier_bps: u16, // Max multiplier at 100% utilization (e.g., 300% = 3x)
    pub optimal_utilization_rate_bps: u16,     // Optimal utilization rate (e.g., 80% = 8000 bps)
    pub utilization_slope_1_bps: u16,          // Rate increase before optimal utilization
    pub utilization_slope_2_bps: u16,          // Rate increase after optimal utilization (steeper)
    
    // --- Current Liquidity Tracking ---
    pub total_liquidity_available_usd: u128,   // Total USDC available for lending
    pub total_liquidity_borrowed_usd: u128,    // Total amount currently borrowed

    // --- Fee Configuration (Admin Configurable) ---
    pub transaction_fee_bps: u16,    // 1% - 5% for all transactions

    // --- Revenue Split Configuration ---
    pub lending_wallet_share_bps: u16, // 70% of mint revenue to lending (7000 bps)
    pub treasury_wallet_share_bps: u16, // 30% of mint revenue to treasury (3000 bps)

    // --- Collateral Configuration ---
    pub loan_to_value_ratio_bps: u16,   // LTV ratio (e.g., 7000 = 70% of NFT value can be borrowed)

    pub bump: u8,
}

impl GlobalMarket {
    pub const SPACE: usize = 8 + // discriminator
        32 + // owner
        32 + // liquidation_authority
        32 + // capital_vault_usdc
        32 + // treasury_wallet
        32 + // collection_registry
        4 +  // max_staked_nfts
        4 +  // current_staked_nfts
        8 +  // per_nft_value_usd (deprecated)
        2 +  // base_interest_rate_1_month_bps
        2 +  // base_interest_rate_2_month_bps
        2 +  // base_interest_rate_3_month_bps
        2 +  // max_interest_rate_multiplier_bps
        2 +  // optimal_utilization_rate_bps
        2 +  // utilization_slope_1_bps
        2 +  // utilization_slope_2_bps
        16 + // total_liquidity_available_usd
        16 + // total_liquidity_borrowed_usd
        2 +  // transaction_fee_bps
        2 +  // lending_wallet_share_bps
        2 +  // treasury_wallet_share_bps
        2 +  // loan_to_value_ratio_bps
        1;   // bump

    /// Calculate dynamic interest rate based on current liquidity utilization
    /// Higher utilization = Higher rates (supply and demand)
    pub fn calculate_dynamic_interest_rate(&self, base_rate_bps: u16) -> u16 {
        // If no liquidity available, return max rate
        if self.total_liquidity_available_usd == 0 {
            return (base_rate_bps as u32 * self.max_interest_rate_multiplier_bps as u32 / 10000) as u16;
        }

        // Calculate utilization rate (0-10000 bps = 0-100%)
        let utilization_rate_bps = ((self.total_liquidity_borrowed_usd * 10000) / self.total_liquidity_available_usd) as u16;
        
        msg!("💹 Utilization calculation:");
        msg!("  Available liquidity: ${}", self.total_liquidity_available_usd);
        msg!("  Borrowed liquidity: ${}", self.total_liquidity_borrowed_usd);
        msg!("  Utilization rate: {}%", utilization_rate_bps as f32 / 100.0);

        let final_rate = if utilization_rate_bps <= self.optimal_utilization_rate_bps {
            // Below optimal utilization - gradual increase
            let utilization_factor = (utilization_rate_bps as u32 * self.utilization_slope_1_bps as u32) / 10000;
            base_rate_bps + (utilization_factor as u16)
        } else {
            // Above optimal utilization - steep increase
            let excess_utilization = utilization_rate_bps - self.optimal_utilization_rate_bps;
            let steep_increase = (excess_utilization as u32 * self.utilization_slope_2_bps as u32) / 10000;
            let optimal_rate = base_rate_bps + ((self.optimal_utilization_rate_bps as u32 * self.utilization_slope_1_bps as u32) / 10000) as u16;
            optimal_rate + steep_increase as u16
        };

        // Cap at maximum rate
        let max_rate = (base_rate_bps as u32 * self.max_interest_rate_multiplier_bps as u32 / 10000) as u16;
        let capped_rate = if final_rate > max_rate { max_rate } else { final_rate };

        msg!("  Base rate: {}%", base_rate_bps as f32 / 100.0);
        msg!("  Final rate: {}%", capped_rate as f32 / 100.0);
        msg!("  Rate multiplier: {}x", capped_rate as f32 / base_rate_bps as f32);

        capped_rate
    }

    /// Update liquidity tracking when loans are taken or repaid
    pub fn update_liquidity_tracking(&mut self, loan_amount: u64, is_new_loan: bool) {
        if is_new_loan {
            self.total_liquidity_borrowed_usd += loan_amount as u128;
        } else {
            self.total_liquidity_borrowed_usd = self.total_liquidity_borrowed_usd.saturating_sub(loan_amount as u128);
        }
        
        msg!("📊 Liquidity updated: Available: ${}, Borrowed: ${}, Utilization: {}%", 
             self.total_liquidity_available_usd,
             self.total_liquidity_borrowed_usd,
             if self.total_liquidity_available_usd > 0 {
                 (self.total_liquidity_borrowed_usd * 100 / self.total_liquidity_available_usd) as u64
             } else { 100 });
    }

    /// Get the USD value for a specific NFT collection
    /// NOTE: This method is deprecated - collection values are now stored in CollectionRegistry
    pub fn get_collection_value_usd(&self, _collection_mint: &Pubkey) -> Result<u64> {
        // Fallback to deprecated global value since collections are now in separate registry
        Ok(self.per_nft_value_usd)
    }
    
    /// Parse collection mint from Metaplex metadata account data
    /// Uses a more robust approach that searches for collection data in the account
    pub fn parse_collection_from_metadata(metadata_data: &[u8]) -> Result<Pubkey> {
        if metadata_data.len() < 100 {
            msg!("❌ Metadata account too small: {} bytes", metadata_data.len());
            return Err(ErrorCode::InvalidNftMetadata.into());
        }
        
        // Log the first few bytes for debugging
        if metadata_data.len() >= 16 {
            msg!("🔍 First 16 bytes: {:?}", &metadata_data[0..16]);
        }
        
        // The metadata account structure (simplified approach):
        // We'll search for a 32-byte pubkey that looks like a collection mint
        // by scanning through the account data for valid pubkey patterns
        
        // Start after the basic header (discriminator + key + update_authority + mint)
        let mut search_start = 73; // 8 + 1 + 32 + 32
        
        // Search through the account data for collection information
        // Collection data typically appears near the end of the metadata
        while search_start + 33 <= metadata_data.len() {
            // Look for the collection option byte (1) followed by a pubkey (32 bytes)
            if metadata_data[search_start] == 1 {
                // Found potential collection marker
                let potential_collection_start = search_start + 1;
                
                if potential_collection_start + 32 <= metadata_data.len() {
                    let collection_bytes = &metadata_data[potential_collection_start..potential_collection_start + 32];
                    
                    // Basic validation - check if it's not all zeros
                    let is_valid_pubkey = !collection_bytes.iter().all(|&b| b == 0);
                    
                    if is_valid_pubkey {
                        match collection_bytes.try_into() {
                            Ok(bytes_array) => {
                                let collection_mint = Pubkey::new_from_array(bytes_array);
                                msg!("✅ Found collection mint at offset {}: {}", potential_collection_start, collection_mint);
                                return Ok(collection_mint);
                            }
                            Err(_) => {
                                msg!("❌ Failed to convert bytes to pubkey at offset {}", potential_collection_start);
                            }
                        }
                    }
                }
            }
            search_start += 1;
        }
        
        // If we can't find a collection in the metadata, try a different approach
        // Look for collection data in the last part of the account
        if metadata_data.len() >= 100 {
            let end_section_start = metadata_data.len().saturating_sub(100);
            
            for i in end_section_start..metadata_data.len().saturating_sub(32) {
                if metadata_data[i] == 1 && i + 33 <= metadata_data.len() {
                    let potential_collection_bytes = &metadata_data[i + 1..i + 33];
                    
                    if !potential_collection_bytes.iter().all(|&b| b == 0) {
                        if let Ok(bytes_array) = potential_collection_bytes.try_into() {
                            let collection_mint = Pubkey::new_from_array(bytes_array);
                            msg!("✅ Found collection mint in end section at offset {}: {}", i + 1, collection_mint);
                            return Ok(collection_mint);
                        }
                    }
                }
            }
        }
        
        msg!("❌ No valid collection found in metadata account");
        Err(ErrorCode::InvalidNftCollection.into())
    }

    /// Parse collection from metadata using proper Metaplex deserialization
    pub fn parse_collection_from_metadata_proper(metadata_data: &[u8]) -> Result<Pubkey> {
        msg!("🔍 Parsing metadata with proper Metaplex deserialization - size: {}", metadata_data.len());
        
        // Deserialize the metadata account using Metaplex 5.x API
        let metadata = match Metadata::safe_deserialize(metadata_data) {
            Ok(meta) => meta,
            Err(e) => {
                msg!("❌ Failed to deserialize metadata: {:?}", e);
                return Err(ErrorCode::InvalidNftMetadata.into());
            }
        };
        
        msg!("✅ Successfully deserialized metadata");
        msg!("🔍 NFT Name: {}", metadata.name);
        msg!("🔍 NFT Symbol: {}", metadata.symbol);
        msg!("🔍 NFT Mint: {}", metadata.mint);
        
        // Check if the NFT has a collection
        match &metadata.collection {
            Some(collection) => {
                msg!("🔍 Collection found: {} (verified: {})", collection.key, collection.verified);
                
                // For security, prefer verified collections but allow unverified for testing
                if collection.verified {
                    msg!("✅ Returning verified collection: {}", collection.key);
                } else {
                    msg!("⚠️ Returning unverified collection: {}", collection.key);
                }
                
                Ok(collection.key)
            }
            None => {
                msg!("❌ No collection found in metadata");
                Err(ErrorCode::InvalidNftCollection.into())
            }
        }
    }
}

/// Collection Registry - Scalable collection management (Option 2: Multiple Registry Accounts)
#[account]
pub struct CollectionRegistry {
    pub authority: Pubkey,        // Who can manage this registry
    pub collections: Vec<CollectionEntry>, // Collection entries (max 100 per registry)
    pub next_registry: Option<Pubkey>,     // Link to next registry if needed
    pub bump: u8,
}

/// Individual Collection Entry
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CollectionEntry {
    pub mint: Pubkey,             // Collection mint address
    pub value_usd: u64,           // USD value per NFT in this collection
    pub is_approved: bool,        // Whether this collection is approved for lending
    pub added_at: i64,            // Timestamp when added
}

impl CollectionRegistry {
    pub const SPACE: usize = 8 + // discriminator
        32 + // authority
        4 + // collections length
        100 * (32 + 8 + 1 + 8) + // collections (100 max, each entry is 49 bytes)
        1 + // next_registry (Option<Pubkey>)
        1; // bump
}

/// Borrower Account - Consolidates each user's position (Project Constellation)
#[account]
pub struct BorrowerAccount {
    pub owner: Pubkey,              // The user's wallet address
    pub global_market: Pubkey,      // Link to the master account

    // --- Collateral Tracking (Max 5 NFTs per user) ---
    pub deposited_nfts: Vec<Pubkey>, // NFT mint addresses (max 5)
    
    // --- Debt Tracking ---
    pub active_loans: Vec<Pubkey>,   // Active loan account keys
    
    pub total_borrowing_power_usd: u128, // Current borrow capacity
    pub total_debt_usd: u128,           // Total outstanding debt
    pub loan_counter: u64,              // Counter for unique loan seeds

    pub bump: u8,
}

impl BorrowerAccount {
    pub const SPACE: usize = 8 + // discriminator
        32 + // owner
        32 + // global_market
        4 + (32 * 5) + // deposited_nfts (max 5 NFTs)
        4 + (32 * 10) + // active_loans (max 10 loans)
        16 + // total_borrowing_power_usd
        16 + // total_debt_usd
        8 + // loan_counter
        1;   // bump
}

/// Individual Loan Account - Links to BorrowerAccount
#[account]
pub struct Loan {
    pub borrower_account: Pubkey,    // Links to BorrowerAccount
    pub principal_amount_usd: u64,   // Loan denominated in USD
    pub borrowed_asset_mint: Pubkey, // USDC mint
    
    pub start_ts: i64,
    pub duration_secs: u32,          // 1, 3, or 6 months
    pub grace_period_ends_ts: i64,

    pub interest_rate_at_origination_bps: u16, // Fixed rate when loan taken
    pub interest_paid_usd: u64,

    pub status: LoanStatus,
    pub bump: u8,
}

impl Loan {
    pub const SPACE: usize = 8 + // discriminator
        32 + // borrower_account
        8 +  // principal_amount_usd
        32 + // borrowed_asset_mint
        8 +  // start_ts
        4 +  // duration_secs
        8 +  // grace_period_ends_ts
        2 +  // interest_rate_at_origination_bps
        8 +  // interest_paid_usd
        1 +  // status
        1;   // bump

    pub fn calculate_total_owed(&self) -> u64 {
        let interest_amount = (self.principal_amount_usd as u128 * self.interest_rate_at_origination_bps as u128) / 10000;
        self.principal_amount_usd + interest_amount as u64 - self.interest_paid_usd
    }

    pub fn is_expired(&self, current_ts: i64) -> bool {
        current_ts > (self.start_ts + self.duration_secs as i64)
    }

    pub fn is_defaultable(&self, current_ts: i64) -> bool {
        current_ts > self.grace_period_ends_ts && self.status == LoanStatus::Active
    }
}

// Removed NFT Auction system - replaced with direct NFT burning

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LoanStatus {
    Active,
    Defaulted,
    Repaid,
}

impl Default for LoanStatus {
    fn default() -> Self {
        LoanStatus::Active
    }
}

// Removed AuctionStatus enum - no longer needed

#[program]
pub mod lendingprogram {
    use super::*;

    /// Initialize the global market (Project Constellation Master Setup)
    pub fn initialize_global_market(
        ctx: Context<InitializeGlobalMarket>,
        max_staked_nfts: u32,
        per_nft_value_usd: u64,
        liquidation_authority: Pubkey,
    ) -> Result<()> {
        let global_market = &mut ctx.accounts.global_market;
        
        // Validate parameters
        require!(max_staked_nfts >= 500 && max_staked_nfts <= 10000, ErrorCode::InvalidStakedNftsLimit);
        require!(per_nft_value_usd > 0, ErrorCode::InvalidNftValue);

        global_market.owner = ctx.accounts.owner.key();
        global_market.liquidation_authority = liquidation_authority;
        global_market.capital_vault_usdc = ctx.accounts.capital_vault_usdc.key();
        global_market.treasury_wallet = ctx.accounts.treasury_wallet.key();
        global_market.collection_registry = ctx.accounts.collection_registry.key();
        
        global_market.max_staked_nfts = max_staked_nfts;
        global_market.current_staked_nfts = 0;
        global_market.per_nft_value_usd = per_nft_value_usd;

        // Initialize with base rates (when utilization = 0%)
        global_market.base_interest_rate_1_month_bps = 300;  // 3% base rate
        global_market.base_interest_rate_2_month_bps = 500;  // 5% base rate
        global_market.base_interest_rate_3_month_bps = 750;  // 7.5% base rate
        
        // Initialize utilization-based rate parameters
        global_market.max_interest_rate_multiplier_bps = 30000; // 300% max multiplier (3x base rate)
        global_market.optimal_utilization_rate_bps = 8000;     // 80% optimal utilization
        global_market.utilization_slope_1_bps = 500;           // 5% rate increase per 100% utilization (gradual)
        global_market.utilization_slope_2_bps = 2000;          // 20% rate increase per 100% utilization (steep)
        
        // Initialize liquidity tracking
        global_market.total_liquidity_available_usd = 0;       // Will be updated when liquidity is deposited
        global_market.total_liquidity_borrowed_usd = 0;
        
        // Initialize fee configuration
        global_market.transaction_fee_bps = 250;        // 2.5%
        
        // Initialize revenue split (80/20)can yd 
        global_market.lending_wallet_share_bps = 8000;  // 80%
        global_market.treasury_wallet_share_bps = 2000; // 20%

        // Initialize collateral configuration
        global_market.loan_to_value_ratio_bps = 7000;    // 70% LTV (users can borrow 70% of NFT value)

        global_market.bump = ctx.bumps.global_market;

        // Use the existing Collection Registry V2 (no initialization needed)

        msg!("Global market initialized with max {} staked NFTs", max_staked_nfts);
        msg!("Collection registry initialized with authority: {}", ctx.accounts.owner.key());
        Ok(())
    }

    /// Initialize the lending program's capital vault
    pub fn initialize_capital_vault(_ctx: Context<InitializeCapitalVault>) -> Result<()> {
        msg!("Lending capital vault initialized successfully");
        Ok(())
    }

    /// Update admin settings (only treasury wallet can call)
    /// Now includes ALL configurable GlobalMarket parameters
    pub fn update_admin_settings(
        ctx: Context<UpdateAdminSettings>,
        new_base_interest_rate_1_month_bps: Option<u16>,
        new_base_interest_rate_2_month_bps: Option<u16>,
        new_base_interest_rate_3_month_bps: Option<u16>,
        new_optimal_utilization_rate_bps: Option<u16>,
        new_max_interest_rate_multiplier_bps: Option<u16>,
        new_utilization_slope_1_bps: Option<u16>,
        new_utilization_slope_2_bps: Option<u16>,
        new_loan_to_value_ratio_bps: Option<u16>,
        new_transaction_fee_bps: Option<u16>,
        new_lending_wallet_share_bps: Option<u16>,
        new_treasury_wallet_share_bps: Option<u16>,
        new_max_staked_nfts: Option<u32>,
        new_per_nft_value_usd: Option<u64>,
    ) -> Result<()> {
        let global_market = &mut ctx.accounts.global_market;

        // Only admin wallet can update settings
        // Note: Admin wallet is hardcoded, owner field is for treasury operations

        // Update base interest rates (2.5% - 25%)
        if let Some(rate) = new_base_interest_rate_1_month_bps {
            require!(rate >= 250 && rate <= 2500, ErrorCode::InvalidInterestRate);
            global_market.base_interest_rate_1_month_bps = rate;
        }
        if let Some(rate) = new_base_interest_rate_2_month_bps {
            require!(rate >= 250 && rate <= 2500, ErrorCode::InvalidInterestRate);
            global_market.base_interest_rate_2_month_bps = rate;
        }
        if let Some(rate) = new_base_interest_rate_3_month_bps {
            require!(rate >= 250 && rate <= 2500, ErrorCode::InvalidInterestRate);
            global_market.base_interest_rate_3_month_bps = rate;
        }

        // Update utilization-based rate parameters
        if let Some(optimal_rate) = new_optimal_utilization_rate_bps {
            require!(optimal_rate >= 5000 && optimal_rate <= 9500, ErrorCode::InvalidUtilizationRate); // 50% - 95%
            global_market.optimal_utilization_rate_bps = optimal_rate;
            msg!("📊 Optimal utilization rate updated to {}%", optimal_rate / 100);
        }
        if let Some(multiplier) = new_max_interest_rate_multiplier_bps {
            require!(multiplier >= 10000 && multiplier <= 50000, ErrorCode::InvalidRateMultiplier); // 1x - 5x
            global_market.max_interest_rate_multiplier_bps = multiplier;
            msg!("📈 Max interest rate multiplier updated to {}% ({}x)", multiplier / 100, multiplier / 10000);
        }
        
        // Update utilization slopes (NEW)
        if let Some(slope1) = new_utilization_slope_1_bps {
            require!(slope1 <= 10000, ErrorCode::InvalidUtilizationSlope); // Max 100%
            global_market.utilization_slope_1_bps = slope1;
            msg!("📈 Utilization slope 1 updated to {}%", slope1 / 100);
        }
        if let Some(slope2) = new_utilization_slope_2_bps {
            require!(slope2 <= 20000, ErrorCode::InvalidUtilizationSlope); // Max 200%
            global_market.utilization_slope_2_bps = slope2;
            msg!("📈 Utilization slope 2 updated to {}%", slope2 / 100);
        }

        // Update Loan-to-Value ratio (40% - 90%)
        if let Some(ltv_ratio) = new_loan_to_value_ratio_bps {
            require!(ltv_ratio >= 4000 && ltv_ratio <= 9000, ErrorCode::InvalidLtvRatio); // 40% - 90%
            global_market.loan_to_value_ratio_bps = ltv_ratio;
            msg!("🏦 LTV ratio updated to {}%", ltv_ratio / 100);
        }

        // Update transaction fee (1% - 5%)
        if let Some(fee) = new_transaction_fee_bps {
            require!(fee >= 100 && fee <= 500, ErrorCode::InvalidTransactionFee);
            global_market.transaction_fee_bps = fee;
            msg!("💰 Transaction fee updated to {}%", fee / 100);
        }

        // Update revenue split configuration (NEW)
        if let Some(lending_share) = new_lending_wallet_share_bps {
            // Ensure it's between 0% and 100%
            require!(lending_share <= 10000, ErrorCode::InvalidRevenueSplit);
            global_market.lending_wallet_share_bps = lending_share;
            msg!("🏦 Lending wallet share updated to {}%", lending_share / 100);
        }
        if let Some(treasury_share) = new_treasury_wallet_share_bps {
            // Ensure it's between 0% and 100%
            require!(treasury_share <= 10000, ErrorCode::InvalidRevenueSplit);
            global_market.treasury_wallet_share_bps = treasury_share;
            msg!("🏛️ Treasury wallet share updated to {}%", treasury_share / 100);
        }
        
        // Validate that revenue split adds up to 100% if both are provided
        if new_lending_wallet_share_bps.is_some() || new_treasury_wallet_share_bps.is_some() {
            let total_share = global_market.lending_wallet_share_bps + global_market.treasury_wallet_share_bps;
            require!(total_share == 10000, ErrorCode::InvalidRevenueSplitTotal);
            msg!("✅ Revenue split validation passed: {}% + {}% = 100%", 
                 global_market.lending_wallet_share_bps / 100, 
                 global_market.treasury_wallet_share_bps / 100);
        }

        // USDW coupon system removed

        // Update max staked NFTs (500 - 10,000)
        if let Some(max_nfts) = new_max_staked_nfts {
            require!(max_nfts >= 500 && max_nfts <= 10000, ErrorCode::InvalidStakedNftsLimit);
            require!(max_nfts >= global_market.current_staked_nfts, ErrorCode::MaxStakedNftsTooLow);
            global_market.max_staked_nfts = max_nfts;
            msg!("🔢 Max staked NFTs updated to {}", max_nfts);
        }

        // Update per-NFT value
        if let Some(nft_value) = new_per_nft_value_usd {
            require!(nft_value > 0, ErrorCode::InvalidNftValue);
            global_market.per_nft_value_usd = nft_value;
            msg!("💰 Per-NFT value updated to ${}", nft_value);
        }

        msg!("Admin settings updated by treasury wallet");
        Ok(())
    }

    /// Manage approved NFT collections with their USD values (only treasury wallet can call)
    /// Initialize the main collection registry
    pub fn initialize_collection_registry(ctx: Context<InitializeCollectionRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.collection_registry;
        registry.authority = ctx.accounts.authority.key();
        registry.collections = Vec::new();
        registry.next_registry = None;
        registry.bump = ctx.bumps.collection_registry;
        msg!("✅ Collection registry initialized");
        Ok(())
    }

    /// Add a collection to the registry
    pub fn add_collection(
        ctx: Context<AddCollection>,
        collection_mint: Pubkey,
        value_usd: u64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.collection_registry;
        
        // Check if collection already exists
        for entry in &registry.collections {
            if entry.mint == collection_mint {
                return Err(ErrorCode::CollectionAlreadyExists.into());
            }
        }
        
        // Check if registry is full
        require!(registry.collections.len() < 100, ErrorCode::RegistryFull);
        require!(value_usd > 0, ErrorCode::InvalidNftValue);
        
        // Add new collection
        registry.collections.push(CollectionEntry {
            mint: collection_mint,
            value_usd,
            is_approved: true,
            added_at: Clock::get()?.unix_timestamp,
        });
        
        msg!("✅ Added collection: {} with value: ${}", collection_mint, value_usd);
        Ok(())
    }

    /// Update a collection's USD value
    pub fn update_collection_value(
        ctx: Context<UpdateCollectionValue>,
        collection_mint: Pubkey,
        new_value_usd: u64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.collection_registry;
        require!(new_value_usd > 0, ErrorCode::InvalidNftValue);
        
        for entry in &mut registry.collections {
            if entry.mint == collection_mint {
                entry.value_usd = new_value_usd;
                msg!("✅ Updated collection {} value to: ${}", collection_mint, new_value_usd);
                return Ok(());
            }
        }
        
        Err(ErrorCode::CollectionNotFound.into())
    }

    /// Toggle collection approval status
    pub fn toggle_collection_approval(
        ctx: Context<ToggleCollectionApproval>,
        collection_mint: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.collection_registry;
        
        for entry in &mut registry.collections {
            if entry.mint == collection_mint {
                entry.is_approved = !entry.is_approved;
                let status = if entry.is_approved { "approved" } else { "disapproved" };
                msg!("✅ Collection {} is now {}", collection_mint, status);
                return Ok(());
            }
        }
        
        Err(ErrorCode::CollectionNotFound.into())
    }



    /// Deposit NFT to increase borrowing power
    pub fn deposit_nft(ctx: Context<DepositNft>, collection_mint: Pubkey) -> Result<()> {
        let global_market = &mut ctx.accounts.global_market;
        let borrower_account = &mut ctx.accounts.borrower_account;

        // Check global collateral limit
        require!(
            global_market.current_staked_nfts < global_market.max_staked_nfts,
            ErrorCode::GlobalCollateralLimitReached
        );

        // Check user's NFT limit (max 5)
        require!(
            borrower_account.deposited_nfts.len() < 5,
            ErrorCode::UserNftLimitReached
        );

        // Verify NFT ownership
        require!(
            ctx.accounts.user_nft_account.amount == 1,
            ErrorCode::InvalidNftOwnership
        );

        // CRITICAL: Verify NFT belongs to approved collection using registry
        let registry = &ctx.accounts.collection_registry;
        let nft_mint = &ctx.accounts.nft_mint;
        
        // Derive metadata PDA for this NFT
        let metadata_program = &ctx.accounts.token_metadata_program;
        let metadata_program_key = metadata_program.key();
        let nft_mint_key = nft_mint.key();
        let metadata_seeds = &[
            b"metadata",
            metadata_program_key.as_ref(),
            nft_mint_key.as_ref(),
        ];
        let (metadata_pda, _) = Pubkey::find_program_address(metadata_seeds, &metadata_program_key);
        
        require!(
            ctx.accounts.nft_metadata.key() == metadata_pda,
            ErrorCode::InvalidNftMetadata
        );

        // SECURITY: Verify that the NFT actually belongs to the claimed collection
        // Use enhanced manual parsing for better reliability
        let metadata_account = &ctx.accounts.nft_metadata;
        let metadata_data = metadata_account.try_borrow_data()?;
        
        msg!("🔍 NFT Mint: {}", nft_mint.key());
        msg!("🔍 NFT Token Account: {}", ctx.accounts.user_nft_account.key());
        msg!("🔍 Collection Mint (claimed): {}", collection_mint);
        msg!("🔍 Metadata account size: {}", metadata_data.len());
        
        // Parse the actual collection from metadata using proper Metaplex deserialization
        let actual_collection_mint = GlobalMarket::parse_collection_from_metadata_proper(&metadata_data)?;
        
        msg!("🔍 Collection Mint (from metadata): {}", actual_collection_mint);
        
        // CRITICAL SECURITY CHECK: Ensure the claimed collection matches the actual collection
        require!(
            actual_collection_mint == collection_mint,
            ErrorCode::InvalidNftCollection
        );
        
        msg!("✅ Collection verification passed: NFT belongs to claimed collection");
        
        // Now check if this collection is in the registry
        let mut collection_value = None;
        let mut is_approved = false;
        
        msg!("🔍 Available collections in registry:");
        for (i, entry) in registry.collections.iter().enumerate() {
            msg!("  {}: {} (approved: {})", i, entry.mint, entry.is_approved);
        }
        
        for entry in &registry.collections {
            if entry.mint == actual_collection_mint {
                collection_value = Some(entry.value_usd);
                is_approved = entry.is_approved;
                msg!("🔍 Found collection in registry: {} (approved: {})", entry.mint, entry.is_approved);
                break;
            }
        }
        
        if collection_value.is_none() {
            msg!("❌ Collection {} not found in approved collections registry", actual_collection_mint);
            msg!("💡 Please add the collection to the lending registry first");
            return Err(ErrorCode::InvalidNftCollection.into());
        }
        
        msg!("🔍 NFT Collection Mint: {}", actual_collection_mint);
        
        // We already have the collection value and approval status from above
        require!(is_approved, ErrorCode::InvalidNftCollection);
        let nft_value = collection_value.ok_or(ErrorCode::InvalidNftCollection)?;
        
        msg!("✅ NFT collection verified: {} with value: ${}", nft_mint.key(), nft_value);

        // Transfer NFT to escrow
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_nft_account.to_account_info(),
                to: ctx.accounts.nft_escrow.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, 1)?;

        // Update state
        borrower_account.deposited_nfts.push(ctx.accounts.nft_mint.key());
        global_market.current_staked_nfts += 1;

        // Calculate per-NFT borrowing power using collection-specific value
        // NOTE: nft_value is stored in micro-dollars (1 USD = 1,000,000 micro-dollars)
        // Keep all calculations in micro-dollars to maintain precision
        let per_nft_value_micro_usd = nft_value as u128; // Already in micro-dollars
        
        // Apply configurable Loan-to-Value ratio (80% of NFT value can be borrowed by default)
        let ltv_ratio_bps = global_market.loan_to_value_ratio_bps;
        let per_nft_borrowing_power_micro = (per_nft_value_micro_usd * ltv_ratio_bps as u128) / 10000;
        
        // Total borrowing power = Per-NFT power × Number of NFTs (max 5)
        let nft_count = borrower_account.deposited_nfts.len() as u128;
        borrower_account.total_borrowing_power_usd = per_nft_borrowing_power_micro * nft_count;

        msg!("💎 NFT Collateral Calculation:");
        msg!("  Per-NFT value: ${}", per_nft_value_micro_usd / 1_000_000);
        msg!("  LTV ratio: {}%", ltv_ratio_bps / 100);
        msg!("  Per-NFT borrowing power: ${}", per_nft_borrowing_power_micro / 1_000_000);
        msg!("  NFTs deposited: {}/5", nft_count);
        msg!("  Total borrowing power: ${} (${} × {})", 
             borrower_account.total_borrowing_power_usd / 1_000_000, per_nft_borrowing_power_micro / 1_000_000, nft_count);
        Ok(())
    }

    /// Take a loan against deposited NFTs
    pub fn take_loan(
        ctx: Context<TakeLoan>,
        loan_amount_usd: u64,
        duration_secs: u32,
    ) -> Result<()> {
        msg!("🚀 Starting take_loan instruction");
        msg!("  Loan amount USD: {}", loan_amount_usd);
        msg!("  Duration seconds: {}", duration_secs);
        msg!("  Borrower: {}", ctx.accounts.borrower.key());
        msg!("  Global market: {}", ctx.accounts.global_market.key());
        msg!("  Borrower account: {}", ctx.accounts.borrower_account.key());
        msg!("  Loan PDA: {}", ctx.accounts.loan.key());
        msg!("  Capital vault: {}", ctx.accounts.capital_vault.key());
        msg!("  Asset mint: {}", ctx.accounts.asset_mint.key());
        
        let global_market = &ctx.accounts.global_market;
        let borrower_account = &mut ctx.accounts.borrower_account;
        let loan = &mut ctx.accounts.loan;
        let current_ts = Clock::get()?.unix_timestamp;
        
        msg!("📊 Current borrower account state:");
        msg!("  Total borrowing power: {}", borrower_account.total_borrowing_power_usd);
        msg!("  Current debt: {}", borrower_account.total_debt_usd);
        msg!("  Deposited NFTs: {}", borrower_account.deposited_nfts.len());
        msg!("  Loan counter: {}", borrower_account.loan_counter);

        // Validate loan duration and calculate dynamic interest rate
        let base_rate_bps = match duration_secs {
            ONE_MONTH_SECS => global_market.base_interest_rate_1_month_bps,
            TWO_MONTHS_SECS => global_market.base_interest_rate_2_month_bps,
            THREE_MONTHS_SECS => global_market.base_interest_rate_3_month_bps,
            _ => return Err(ErrorCode::InvalidLoanDuration.into()),
        };

        // Calculate dynamic interest rate based on current liquidity utilization
        let interest_rate_bps = global_market.calculate_dynamic_interest_rate(base_rate_bps);
        
        msg!("🎯 Dynamic rate calculation for {} month loan:", duration_secs / (30 * 24 * 3600));
        msg!("  Base rate: {}%", base_rate_bps as f32 / 100.0);
        msg!("  Dynamic rate: {}%", interest_rate_bps as f32 / 100.0);
        msg!("  Rate increase due to utilization: {}%", (interest_rate_bps - base_rate_bps) as f32 / 100.0);

        // CRITICAL SECURITY CHECK: User must have deposited NFTs as collateral
        require!(
            !borrower_account.deposited_nfts.is_empty(),
            ErrorCode::InsufficientBorrowingPower
        );
        
        msg!("✅ Collateral verification: User has {} deposited NFTs", borrower_account.deposited_nfts.len());

        // Check borrowing capacity
        let new_total_debt = borrower_account.total_debt_usd + loan_amount_usd as u128;
        msg!("💰 Borrowing capacity check:");
        msg!("  Current debt: {}", borrower_account.total_debt_usd);
        msg!("  Loan amount: {}", loan_amount_usd);
        msg!("  New total debt: {}", new_total_debt);
        msg!("  Borrowing power: {}", borrower_account.total_borrowing_power_usd);
        msg!("  Available to borrow: {}", borrower_account.total_borrowing_power_usd - borrower_account.total_debt_usd);
        
        require!(
            new_total_debt <= borrower_account.total_borrowing_power_usd,
            ErrorCode::InsufficientBorrowingPower
        );

        // Check protocol liquidity (capital vault has enough funds)
        let capital_vault_balance = ctx.accounts.capital_vault.amount;
        msg!("🏦 Protocol liquidity check:");
        msg!("  Capital vault balance: {}", capital_vault_balance);
        msg!("  Loan amount requested: {}", loan_amount_usd);
        msg!("  Sufficient funds: {}", capital_vault_balance >= loan_amount_usd);
        
        require!(
            loan_amount_usd <= capital_vault_balance,
            ErrorCode::InsufficientProtocolLiquidity
        );

        // Create signer seeds for global market authority
        let global_market_bump = [global_market.bump];
        let global_market_seeds = [GLOBAL_MARKET_SEED, &global_market_bump];
        let signer_seeds = [&global_market_seeds[..]];

        // Transfer full loan amount to borrower (no fee on loan origination)
        msg!("💰 Transferring loan amount to borrower:");
        msg!("  Loan amount: {}", loan_amount_usd);
        msg!("  From: {}", ctx.accounts.capital_vault.key());
        msg!("  To: {}", ctx.accounts.borrower_token_account.key());
        
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.capital_vault.to_account_info(),
                to: ctx.accounts.borrower_token_account.to_account_info(),
                authority: ctx.accounts.global_market.to_account_info(),
            },
            &signer_seeds
        );
        token::transfer(transfer_ctx, loan_amount_usd)?;
        msg!("✅ Loan amount transferred successfully");

        // Initialize loan
        loan.borrower_account = borrower_account.key();
        loan.principal_amount_usd = loan_amount_usd;
        loan.borrowed_asset_mint = ctx.accounts.asset_mint.key();
        loan.start_ts = current_ts;
        loan.duration_secs = duration_secs;
        loan.grace_period_ends_ts = current_ts + duration_secs as i64 + 172800; // 2 day grace period
        loan.interest_rate_at_origination_bps = interest_rate_bps;
        loan.interest_paid_usd = 0;
        loan.status = LoanStatus::Active;
        loan.bump = ctx.bumps.loan;

        // Update borrower account
        borrower_account.active_loans.push(loan.key());
        borrower_account.total_debt_usd = new_total_debt;
        borrower_account.loan_counter += 1; // Increment for next loan

        // Update global liquidity tracking
        let global_market = &mut ctx.accounts.global_market;
        global_market.update_liquidity_tracking(loan_amount_usd, true);

        msg!("✅ Loan taken: ${} for {} days at {}%", loan_amount_usd, duration_secs / 86400, interest_rate_bps as f32 / 100.0);
        msg!("📊 New utilization rate: {}%", 
             if global_market.total_liquidity_available_usd > 0 {
                 (global_market.total_liquidity_borrowed_usd * 100 / global_market.total_liquidity_available_usd) as u64
             } else { 0 });
        Ok(())
    }

    /// Make interest payment (WHISKEY TOKENS ONLY - goes to treasury)
    pub fn make_interest_payment(
        ctx: Context<MakeInterestPayment>,
        payment_amount_whiskey: u64, // Amount in WHISKEY tokens (with 6 decimals)
        current_whiskey_price_usd: u64, // Current WHISKEY price in USD (with 6 decimals, e.g., 1.50 = 1500000)
    ) -> Result<()> {
        let loan = &mut ctx.accounts.loan;
        let borrower_account = &mut ctx.accounts.borrower_account;
        let global_market = &mut ctx.accounts.global_market;

        require!(loan.status == LoanStatus::Active, ErrorCode::LoanNotActive);
        require!(payment_amount_whiskey > 0, ErrorCode::InvalidPaymentAmount);
        require!(current_whiskey_price_usd > 0, ErrorCode::InvalidWhiskeyPrice);

        let total_owed_usd = loan.calculate_total_owed();
        
        // Calculate USD value of WHISKEY payment
        // payment_amount_whiskey has 6 decimals, current_whiskey_price_usd has 6 decimals
        // So we need to divide by 1_000_000 to get the actual USD value
        let payment_value_usd = (payment_amount_whiskey as u128 * current_whiskey_price_usd as u128) / 1_000_000;
        
        msg!("💰 Payment validation:");
        msg!("   WHISKEY amount: {} (raw with 6 decimals)", payment_amount_whiskey);
        msg!("   WHISKEY price: ${} (raw with 6 decimals)", current_whiskey_price_usd);
        msg!("   Payment USD value: ${}", payment_value_usd);
        msg!("   Total owed: ${}", total_owed_usd);

        // Check if payment is sufficient for full repayment
        let remaining_debt = total_owed_usd.saturating_sub(loan.interest_paid_usd);
        require!(
            payment_value_usd >= remaining_debt as u128,
            ErrorCode::InsufficientPaymentAmount
        );

        // Don't allow overpayment by more than 5%
        let max_allowed_payment = (remaining_debt as u128 * 105) / 100; // 105% of remaining debt
        require!(
            payment_value_usd <= max_allowed_payment,
            ErrorCode::ExcessivePaymentAmount
        );

        // Transfer WHISKEY payment from borrower to treasury wallet's WHISKEY account
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower_whiskey_token_account.to_account_info(),
                to: ctx.accounts.treasury_whiskey_token_account.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, payment_amount_whiskey)?;

        // Update loan state with USD equivalent
        loan.interest_paid_usd += payment_value_usd as u64;

        // If fully repaid, update everything properly
        if loan.interest_paid_usd >= total_owed_usd {
            loan.status = LoanStatus::Repaid;
            
            // Remove loan from active loans list
            borrower_account.active_loans.retain(|&loan_key| loan_key != loan.key());
            
            // Update borrower account debt (subtract the full amount owed: principal + interest)
            // Note: total_debt_usd tracks only principal when loan is taken, but we need to ensure
            // it reaches zero when all loans including interest are fully repaid
            borrower_account.total_debt_usd = borrower_account
                .total_debt_usd
                .saturating_sub(loan.principal_amount_usd as u128);
            
            // Update global market liquidity tracking
            global_market.update_liquidity_tracking(loan.principal_amount_usd, false);
            
            msg!("🎉 Loan fully repaid and removed from active loans!");
            msg!("   Principal: ${}", loan.principal_amount_usd);
            msg!("   Total owed (principal + interest): ${}", total_owed_usd);
            msg!("   New total debt: ${}", borrower_account.total_debt_usd);
        }

        msg!("✅ Payment processed: {} WHISKEY tokens (${} USD value)", payment_amount_whiskey, payment_value_usd);
        Ok(())
    }

    /// Repay loan with dual payment: USDC for principal, WHISKEY for interest
    pub fn repay_loan_dual_payment(
        ctx: Context<RepayLoanDualPayment>,
        usdc_principal_amount: u64, // Principal amount in USDC (with 6 decimals)
        whiskey_interest_amount: u64, // Interest amount in WHISKEY tokens (with 6 decimals)
        current_whiskey_price_usd: u64, // Current WHISKEY price in USD (with 6 decimals)
    ) -> Result<()> {
        let loan = &mut ctx.accounts.loan;
        let borrower_account = &mut ctx.accounts.borrower_account;
        let global_market = &mut ctx.accounts.global_market;

        require!(loan.status == LoanStatus::Active, ErrorCode::LoanNotActive);
        require!(usdc_principal_amount > 0, ErrorCode::InvalidPaymentAmount);
        require!(whiskey_interest_amount > 0, ErrorCode::InvalidPaymentAmount);
        require!(current_whiskey_price_usd > 0, ErrorCode::InvalidWhiskeyPrice);

        // Calculate expected amounts
        let expected_principal = loan.principal_amount_usd;
        let total_interest_usd = (loan.principal_amount_usd as u128 * loan.interest_rate_at_origination_bps as u128) / 10000;
        let remaining_interest_usd = total_interest_usd.saturating_sub(loan.interest_paid_usd as u128);

        // Convert WHISKEY payment to USD value
        let whiskey_payment_usd_value = (whiskey_interest_amount as u128 * current_whiskey_price_usd as u128) / 1_000_000;

        msg!("💰 Dual Payment Validation:");
        msg!("   Expected principal (USDC): {}", expected_principal);
        msg!("   Provided principal (USDC): {}", usdc_principal_amount);
        msg!("   Expected interest (USD): {}", remaining_interest_usd);
        msg!("   Provided WHISKEY tokens: {}", whiskey_interest_amount);
        msg!("   WHISKEY USD value: {}", whiskey_payment_usd_value);

        // Validate principal payment (exact match required)
        require!(
            usdc_principal_amount == expected_principal,
            ErrorCode::InvalidPaymentAmount
        );

        // Validate interest payment (allow 5% buffer for price fluctuations)
        let min_interest_payment = (remaining_interest_usd * 95) / 100; // 95% of required
        let max_interest_payment = (remaining_interest_usd * 105) / 100; // 105% of required
        require!(
            whiskey_payment_usd_value >= min_interest_payment && whiskey_payment_usd_value <= max_interest_payment,
            ErrorCode::InvalidPaymentAmount
        );

        // Create signer seeds for global market authority (for receiving USDC back to capital vault)
        let global_market_bump = [global_market.bump];
        let global_market_seeds = [GLOBAL_MARKET_SEED, &global_market_bump];
        let _signer_seeds = [&global_market_seeds[..]];

        // Transfer USDC principal from borrower back to capital vault
        msg!("💸 Transferring USDC principal back to capital vault...");
        let usdc_transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower_usdc_token_account.to_account_info(),
                to: ctx.accounts.capital_vault.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        );
        token::transfer(usdc_transfer_ctx, usdc_principal_amount)?;

        // Transfer WHISKEY interest from borrower to treasury
        msg!("🥃 Transferring WHISKEY interest to treasury...");
        let whiskey_transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.borrower_whiskey_token_account.to_account_info(),
                to: ctx.accounts.treasury_whiskey_token_account.to_account_info(),
                authority: ctx.accounts.borrower.to_account_info(),
            },
        );
        token::transfer(whiskey_transfer_ctx, whiskey_interest_amount)?;

        // Update loan state - mark as fully repaid
        loan.interest_paid_usd += whiskey_payment_usd_value as u64;
        loan.status = LoanStatus::Repaid;

        // Remove loan from active loans list
        borrower_account.active_loans.retain(|&loan_key| loan_key != loan.key());

        // Update borrower account debt (subtract the principal amount)
        borrower_account.total_debt_usd = borrower_account
            .total_debt_usd
            .saturating_sub(loan.principal_amount_usd as u128);

        // Update global market liquidity tracking (principal returned to capital vault)
        global_market.update_liquidity_tracking(loan.principal_amount_usd, false);

        msg!("🎉 Dual payment loan repayment completed!");
        msg!("   Principal repaid: {} USDC", usdc_principal_amount);
        msg!("   Interest paid: {} WHISKEY tokens (${} USD value)", whiskey_interest_amount, whiskey_payment_usd_value);
        msg!("   Loan status: Repaid");
        msg!("   New borrower debt: {}", borrower_account.total_debt_usd);

        Ok(())
    }

    /// Liquidate expired loan by burning NFT collateral
    pub fn liquidate_expired_loan(
        ctx: Context<LiquidateExpiredLoan>,
        loan_id: Pubkey,
        collection_mint: Pubkey,
    ) -> Result<()> {
        let borrower_account = &mut ctx.accounts.borrower_account;
        let global_market = &mut ctx.accounts.global_market;
        let registry = &ctx.accounts.collection_registry;
        let current_ts = Clock::get()?.unix_timestamp;

        msg!("🔥 Starting NFT liquidation by burning...");
        msg!("  Borrower: {}", borrower_account.owner);
        msg!("  Loan ID: {}", loan_id);

        let loan_exists = borrower_account.active_loans.contains(&loan_id);
        require!(loan_exists, ErrorCode::LoanNotActive);

        let loan = &ctx.accounts.loan;
        require!(loan.status == LoanStatus::Active, ErrorCode::LoanNotActive);
        require!(loan.is_defaultable(current_ts), ErrorCode::LoanNotDefaultable);

        msg!("✅ Loan is expired and defaultable");

        msg!("🔥 Burning NFT: {}", ctx.accounts.nft_mint.key());
        
        let global_market_bump = [global_market.bump];
        let global_market_seeds = [GLOBAL_MARKET_SEED, &global_market_bump];
        let signer_seeds = [&global_market_seeds[..]];

        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::CloseAccount {
                account: ctx.accounts.nft_escrow.to_account_info(),
                destination: ctx.accounts.liquidator.to_account_info(),
                authority: global_market.to_account_info(),
            },
            &signer_seeds,
        );
        token::close_account(close_ctx)?;

        let loan = &mut ctx.accounts.loan;
        loan.status = LoanStatus::Defaulted;

        borrower_account.active_loans.retain(|&l| l != loan_id);

        let nft_mint = ctx.accounts.nft_mint.key();
        borrower_account.deposited_nfts.retain(|&nft| nft != nft_mint);

        // Look up collection value from registry instead of deprecated per_nft_value_usd
        let mut nft_value: u128 = global_market.per_nft_value_usd as u128; // fallback
        for entry in &registry.collections {
            if entry.mint == collection_mint && entry.is_approved {
                nft_value = entry.value_usd as u128;
                break;
            }
        }

        borrower_account.total_borrowing_power_usd = borrower_account
            .total_borrowing_power_usd
            .saturating_sub(nft_value);

        global_market.current_staked_nfts = global_market.current_staked_nfts.saturating_sub(1);

        msg!("🔥 NFT BURNED - Liquidation complete!");
        msg!("  Burned NFT: {}", nft_mint);
        msg!("  Remaining debt: ${}", borrower_account.total_debt_usd);
        msg!("  Remaining collateral: {} NFTs", borrower_account.deposited_nfts.len());

        Ok(())
    }

    /// Add liquidity to the protocol (admin only)
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        liquidity_amount_usd: u64,
    ) -> Result<()> {
        let global_market = &mut ctx.accounts.global_market;

        // Only treasury wallet can add liquidity
        require!(
            ctx.accounts.admin.key() == global_market.owner,
            ErrorCode::UnauthorizedTreasuryAccess
        );

        // Update total available liquidity
        global_market.total_liquidity_available_usd += liquidity_amount_usd as u128;

        msg!("💰 Liquidity added: ${}", liquidity_amount_usd);
        msg!("📊 Total available liquidity: ${}", global_market.total_liquidity_available_usd);
        msg!("📈 New utilization rate: {}%", 
             if global_market.total_liquidity_available_usd > 0 {
                 (global_market.total_liquidity_borrowed_usd * 100 / global_market.total_liquidity_available_usd) as u64
             } else { 0 });

        Ok(())
    }

    /// Withdraw NFT after full loan repayment
    pub fn withdraw_nft(ctx: Context<WithdrawNft>, collection_mint: Pubkey) -> Result<()> {
        let borrower_account = &mut ctx.accounts.borrower_account;
        let global_market = &ctx.accounts.global_market;
        let registry = &ctx.accounts.collection_registry;
        
        require!(
            borrower_account.active_loans.is_empty(),
            ErrorCode::OutstandingDebtExists
        );
        
        require!(
            borrower_account.total_debt_usd == 0,
            ErrorCode::OutstandingDebtExists
        );
        
        let nft_mint = ctx.accounts.nft_mint.key();
        let nft_index = borrower_account.deposited_nfts
            .iter()
            .position(|&mint| mint == nft_mint)
            .ok_or(ErrorCode::NftNotDeposited)?;
            
        borrower_account.deposited_nfts.remove(nft_index);
        
        // Look up collection value from registry instead of deprecated per_nft_value_usd
        let mut collection_value_micro: u128 = global_market.per_nft_value_usd as u128; // fallback
        for entry in &registry.collections {
            if entry.mint == collection_mint && entry.is_approved {
                collection_value_micro = entry.value_usd as u128;
                break;
            }
        }
        let ltv_ratio = global_market.loan_to_value_ratio_bps as u128;
        let nft_borrowing_power_micro = (collection_value_micro * ltv_ratio) / 10000;
        
        borrower_account.total_borrowing_power_usd = borrower_account
            .total_borrowing_power_usd
            .saturating_sub(nft_borrowing_power_micro);
        
        // The escrow token account has borrower_account as its authority (see DepositNft struct line 1418)
        // So we need to use borrower_account as the authority with its PDA seeds
        let user_key = ctx.accounts.user.key();
        let borrower_account_bump = ctx.bumps.borrower_account;
        let borrower_account_bump_bytes = [borrower_account_bump];
        
        // Create signer seeds for the borrower_account PDA (which is the authority of the escrow)
        let borrower_account_seeds = [
            BORROWER_ACCOUNT_SEED,
            user_key.as_ref(),
            &borrower_account_bump_bytes
        ];
        let signer_seeds = [&borrower_account_seeds[..]];
        
        // Transfer NFT from escrow back to user
        // The authority is the borrower_account PDA (as defined in DepositNft struct)
        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.nft_escrow.to_account_info(),
                to: ctx.accounts.user_nft_account.to_account_info(),
                authority: ctx.accounts.borrower_account.to_account_info(),
            },
            &signer_seeds
        );
        token::transfer(transfer_ctx, 1)?;
        
        // Update global market NFT count
        let global_market = &mut ctx.accounts.global_market;
        global_market.current_staked_nfts = global_market.current_staked_nfts.saturating_sub(1);
        
        msg!("✅ NFT withdrawn: {}", nft_mint);
        Ok(())
    }

    /// Process mint revenue split (80% to lending, 20% to treasury)
    pub fn process_mint_revenue(
        ctx: Context<ProcessMintRevenue>,
        total_revenue_whiskey: u64,
    ) -> Result<()> {
        let global_market = &ctx.accounts.global_market;

        // Calculate splits
        let lending_share = (total_revenue_whiskey as u128 * global_market.lending_wallet_share_bps as u128) / 10000;
        let treasury_share = (total_revenue_whiskey as u128 * global_market.treasury_wallet_share_bps as u128) / 10000;

        // Convert 80% to USDC and send to lending wallet
        // (This would involve a swap mechanism - simplified here)
        let usdc_amount = lending_share as u64; // Assuming 1:1 for simplicity

        let transfer_to_lending_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.revenue_source.to_account_info(),
                to: ctx.accounts.capital_vault_usdc.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(transfer_to_lending_ctx, usdc_amount)?;

        // Keep 20% in WHISKEY and send to treasury
        let transfer_to_treasury_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.revenue_source.to_account_info(),
                to: ctx.accounts.treasury_whiskey_token_account.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(transfer_to_treasury_ctx, treasury_share as u64)?;

        msg!("Revenue split: {}% to lending (${} USDC), {}% to treasury ({} WHISKEY)", 
             global_market.lending_wallet_share_bps / 100,
             usdc_amount,
             global_market.treasury_wallet_share_bps / 100,
             treasury_share);
        Ok(())
    }

}

// Removed LiquidationReason enum - simplified to just expire-based burning

// Account validation structs
#[derive(Accounts)]
pub struct InitializeGlobalMarket<'info> {
    #[account(
        init,
        payer = owner,
        space = GlobalMarket::SPACE,
        seeds = [GLOBAL_MARKET_SEED],
        bump
    )]
    pub global_market: Account<'info, GlobalMarket>,

    #[account(
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>, // Treasury wallet

    /// CHECK: Capital vault for USDC lending
    pub capital_vault_usdc: UncheckedAccount<'info>,

    /// CHECK: Treasury wallet (admin's actual wallet for profit withdrawal)
    pub treasury_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCapitalVault<'info> {
    #[account(
        mut,
        constraint = admin.key() == ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>,

    #[account(
        seeds = [GLOBAL_MARKET_SEED],
        bump = global_market.bump
    )]
    pub global_market: Account<'info, GlobalMarket>,

    #[account(
        init,
        payer = admin,
        token::mint = usdc_mint,
        token::authority = global_market,
        seeds = [CAPITAL_VAULT_SEED],
        bump
    )]
    pub capital_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateAdminSettings<'info> {
        #[account(
            mut,
            seeds = [GLOBAL_MARKET_SEED],
            bump = global_market.bump
        )]
        pub global_market: Account<'info, GlobalMarket>,

        #[account(
            address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
        )]
        pub admin: Signer<'info>, // Must be the hardcoded admin wallet
    }



#[derive(Accounts)]
pub struct DepositNft<'info> {
    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,

    #[account(
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(
        init_if_needed,
        payer = user,
        space = BorrowerAccount::SPACE,
        seeds = [BORROWER_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub borrower_account: Account<'info, BorrowerAccount>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = user
    )]
    pub user_nft_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        token::mint = nft_mint,
        token::authority = borrower_account,
        seeds = [COLLATERAL_ESCROW_SEED, user.key().as_ref(), nft_mint.key().as_ref()],
        bump
    )]
    pub nft_escrow: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: NFT Metadata account for collection verification
    pub nft_metadata: UncheckedAccount<'info>,

    /// CHECK: Token Metadata Program for NFT verification
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TakeLoan<'info> {
    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,

    #[account(mut)]
    pub borrower_account: Account<'info, BorrowerAccount>,

    #[account(
        init,
        payer = borrower,
        space = Loan::SPACE,
        seeds = [LOAN_SEED, borrower.key().as_ref(), &borrower_account.loan_counter.to_le_bytes()],
        bump
    )]
    pub loan: Account<'info, Loan>,

    pub asset_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [CAPITAL_VAULT_SEED],
        bump,
        constraint = capital_vault.mint == asset_mint.key() @ ErrorCode::InvalidAssetMint,
        constraint = capital_vault.owner == global_market.key() @ ErrorCode::InvalidVaultAuthority
    )]
    pub capital_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = treasury_wallet
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury wallet (admin's actual wallet)
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = borrower
    )]
    pub borrower_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub borrower: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MakeInterestPayment<'info> {
    #[account(mut)]
    pub loan: Account<'info, Loan>,

    #[account(
        mut,
        seeds = [BORROWER_ACCOUNT_SEED, borrower.key().as_ref()],
        bump
    )]
    pub borrower_account: Account<'info, BorrowerAccount>,

    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,

    // Borrower's WHISKEY token account (interest payments are ALWAYS in WHISKEY)
    #[account(
        mut,
        associated_token::mint = WHISKEY_TOKEN_MINT,
        associated_token::authority = borrower
    )]
    pub borrower_whiskey_token_account: Account<'info, TokenAccount>,

    // Treasury wallet's WHISKEY token account (where ALL interest payments go)
    #[account(
        mut,
        associated_token::mint = WHISKEY_TOKEN_MINT,
        associated_token::authority = treasury_wallet
    )]
    pub treasury_whiskey_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury wallet (admin's actual wallet)
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

    pub borrower: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RepayLoanDualPayment<'info> {
    #[account(mut)]
    pub loan: Account<'info, Loan>,

    #[account(
        mut,
        seeds = [BORROWER_ACCOUNT_SEED, borrower.key().as_ref()],
        bump
    )]
    pub borrower_account: Account<'info, BorrowerAccount>,

    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,

    // Capital vault (where USDC principal gets returned)
    #[account(
        mut,
        seeds = [CAPITAL_VAULT_SEED],
        bump,
        constraint = capital_vault.mint == USDC_MINT.parse::<Pubkey>().unwrap() @ ErrorCode::InvalidAssetMint,
        constraint = capital_vault.owner == global_market.key() @ ErrorCode::InvalidVaultAuthority
    )]
    pub capital_vault: Account<'info, TokenAccount>,

    // Borrower's USDC token account (for principal repayment)
    #[account(
        mut,
        associated_token::mint = USDC_MINT.parse::<Pubkey>().unwrap(),
        associated_token::authority = borrower
    )]
    pub borrower_usdc_token_account: Account<'info, TokenAccount>,

    // Borrower's WHISKEY token account (for interest payment)
    #[account(
        mut,
        associated_token::mint = WHISKEY_TOKEN_MINT,
        associated_token::authority = borrower
    )]
    pub borrower_whiskey_token_account: Account<'info, TokenAccount>,

    // Treasury wallet's WHISKEY token account (where interest payments go)
    #[account(
        mut,
        associated_token::mint = WHISKEY_TOKEN_MINT,
        associated_token::authority = treasury_wallet
    )]
    pub treasury_whiskey_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury wallet (admin's actual wallet)
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

    pub borrower: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LiquidateExpiredLoan<'info> {
    #[account(mut)]
    pub borrower_account: Account<'info, BorrowerAccount>,
    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,
    #[account(
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,
    #[account(mut)]
    pub loan: Account<'info, Loan>,
    pub nft_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [COLLATERAL_ESCROW_SEED, borrower_account.owner.as_ref(), nft_mint.key().as_ref()],
        bump
    )]
    pub nft_escrow: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = liquidator.key() == global_market.liquidation_authority @ ErrorCode::UnauthorizedLiquidator
    )]
    pub liquidator: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,

    pub admin: Signer<'info>, // Treasury wallet
}

#[derive(Accounts)]
pub struct ProcessMintRevenue<'info> {
    pub global_market: Account<'info, GlobalMarket>,

    #[account(mut)]
    pub revenue_source: Account<'info, TokenAccount>, // WHISKEY tokens from mint

    #[account(mut)]
    pub capital_vault_usdc: Account<'info, TokenAccount>, // 70% goes here (as USDC)

    #[account(
        mut,
        associated_token::mint = WHISKEY_TOKEN_MINT,
        associated_token::authority = treasury_wallet
    )]
    pub treasury_whiskey_token_account: Account<'info, TokenAccount>, // 30% goes to treasury wallet

    /// CHECK: Treasury wallet (admin's actual wallet)
    #[account(mut)]
    pub treasury_wallet: UncheckedAccount<'info>,

    pub admin: Signer<'info>, // Admin authorizes the split

    pub token_program: Program<'info, Token>,
}


// Error codes
#[error_code]
pub enum ErrorCode {

    #[msg("Unauthorized treasury wallet access")]
    UnauthorizedTreasuryAccess,
    #[msg("Unauthorized liquidator - only designated liquidation authority can liquidate loans")]
    UnauthorizedLiquidator,

    #[msg("Invalid staked NFTs limit (must be 500-10,000)")]
    InvalidStakedNftsLimit,
    #[msg("Invalid interest rate (must be 2.5%-25%)")]
    InvalidInterestRate,
    #[msg("Invalid transaction fee (must be 1%-5%)")]
    InvalidTransactionFee,
    #[msg("Max staked NFTs too low (below current staked)")]
    MaxStakedNftsTooLow,
    #[msg("Global collateral limit reached")]
    GlobalCollateralLimitReached,
    #[msg("User NFT limit reached (max 5)")]
    UserNftLimitReached,
    #[msg("Invalid NFT ownership")]
    InvalidNftOwnership,
    #[msg("Invalid loan duration")]
    InvalidLoanDuration,
    #[msg("Insufficient borrowing power")]
    InsufficientBorrowingPower,
    #[msg("Insufficient protocol liquidity")]
    InsufficientProtocolLiquidity,
    #[msg("Loan not active")]
    LoanNotActive,
    #[msg("Invalid payment amount")]
    InvalidPaymentAmount,
    #[msg("Excessive payment amount")]
    ExcessivePaymentAmount,
    #[msg("Loan not defaultable")]
    LoanNotDefaultable,
    #[msg("Collateral value sufficient")]
    CollateralValueSufficient,
    #[msg("Invalid utilization rate (must be 50%-95%)")]
    InvalidUtilizationRate,
    #[msg("Invalid rate multiplier (must be 1x-5x)")]
    InvalidRateMultiplier,
    #[msg("Invalid LTV ratio (must be 40%-90%)")]
    InvalidLtvRatio,
    #[msg("Invalid NFT value (must be greater than 0)")]
    InvalidNftValue,
    #[msg("Invalid NFT metadata account")]
    InvalidNftMetadata,
    #[msg("NFT is not from an approved collection")]
    InvalidNftCollection,
    #[msg("Too many collections (max 10)")]
    TooManyCollections,
    #[msg("No collections provided")]
    NoCollectionsProvided,
    #[msg("Unauthorized: Caller is not the admin wallet")]
    UnauthorizedAdmin,
    #[msg("Collection already exists in registry")]
    CollectionAlreadyExists,
    #[msg("Collection not found in registry")]
    CollectionNotFound,
    #[msg("Registry is full (max 100 collections per registry)")]
    RegistryFull,
    #[msg("Invalid utilization slope (must be <= 100% for slope1, <= 200% for slope2)")]
    InvalidUtilizationSlope,
    #[msg("Invalid revenue split percentage (must be <= 100%)")]
    InvalidRevenueSplit,
    #[msg("Revenue split percentages must add up to exactly 100%")]
    InvalidRevenueSplitTotal,
    #[msg("Outstanding debt exists - cannot withdraw NFT")]
    OutstandingDebtExists,
    #[msg("NFT not found in deposited collateral")]
    NftNotDeposited,
    #[msg("Invalid WHISKEY price (must be greater than 0)")]
    InvalidWhiskeyPrice,
    #[msg("Insufficient payment amount (WHISKEY value less than debt)")]
    InsufficientPaymentAmount,
    
    #[msg("Invalid asset mint for capital vault")]
    InvalidAssetMint,
    
    #[msg("Invalid vault authority - must be global market PDA")]
    InvalidVaultAuthority,
}

// New account contexts for collection registry management
#[derive(Accounts)]
pub struct InitializeCollectionRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = CollectionRegistry::SPACE,
        seeds = [b"collection_registry"],
        bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(mut)]
    pub authority: Signer<'info>, // Admin wallet

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddCollection<'info> {
    #[account(
        mut,
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(
        address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>, // Must be the hardcoded admin wallet
}

#[derive(Accounts)]
pub struct UpdateCollectionValue<'info> {
    #[account(
        mut,
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(
        address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>, // Must be the hardcoded admin wallet
}

#[derive(Accounts)]
pub struct ToggleCollectionApproval<'info> {
    #[account(
        mut,
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(
        address = ADMIN_WALLET @ ErrorCode::UnauthorizedAdmin
    )]
    pub admin: Signer<'info>, // Must be the hardcoded admin wallet
}


#[derive(Accounts)]
pub struct WithdrawNft<'info> {
    #[account(mut)]
    pub global_market: Account<'info, GlobalMarket>,

    #[account(
        seeds = [b"collection_registry"],
        bump = collection_registry.bump
    )]
    pub collection_registry: Account<'info, CollectionRegistry>,

    #[account(
        mut,
        seeds = [BORROWER_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub borrower_account: Account<'info, BorrowerAccount>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = user
    )]
    pub user_nft_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [COLLATERAL_ESCROW_SEED, user.key().as_ref(), nft_mint.key().as_ref()],
        bump,
        constraint = nft_escrow.amount == 1 @ ErrorCode::InvalidNftOwnership
    )]
    pub nft_escrow: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}