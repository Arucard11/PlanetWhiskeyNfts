Of course. This is a significant architectural shift from a peer-to-pool model to a protocol-as-lender model. This change centralizes the source of capital, which simplifies some aspects but introduces new challenges and risks.

Let's architect this new system from the ground up. This is the definitive blueprint for "Project Constellation." It is designed to be verbose, security-first, and directly aligned with your new specification.

Master Blueprint: Project Constellation
Part I: Executive Summary & Core Architectural Pillars

System Name: Project Constellation
Core Function: An exclusive, NFT-gated lending protocol where the protocol itself is the sole lender of capital.

Architectural Pillars:

Protocol-as-Lender: There is no public lending pool. All loan capital (USDC/USDT) originates from a dedicated, protocol-owned treasury vault funded by NFT mint revenue. This eliminates yield payouts to public lenders and simplifies the tokenomics.

NFT-Gated Access: Borrowing is a privilege reserved exclusively for Planet Whiskey NFT holders. No NFT, no loan.

Treasury-Backed Valuation: The collateral value of each NFT is derived from a centrally reported, multi-asset treasury value (BTC, Gold, Barrels).

Dynamic Interest Rate: The Annual Percentage Rate (APY) for borrowers is not fixed. It fluctuates algorithmically based on the total number of NFTs staked in the protocol, creating a supply-and-demand dynamic for borrowing slots.

Multi-Currency Interest Payments: Borrowers have the flexibility to pay interest in USDC, USDT, or $WHISKEY.

Dual Liquidation Triggers: Liquidation occurs under two conditions: (1) The loan's term expires and is not repaid within the grace period, OR (2) The value of the NFT collateral (as reported by the oracle) drops below the outstanding loan amount.

Auction-Based Liquidation: Defaulted NFTs are seized and sold in an on-chain auction to recover the protocol's capital.

Part II: The On-Chain Citadel (The Solana Program)

This is the Rust/Anchor program that will enforce the rules of Project Constellation.

Step 1: The State Accounts (The Protocol's On-Chain Database)

File: programs/constellation/src/state/global_market.rs

Purpose: The single, master account. It holds the global configuration, treasury data, and the keys to all administrative functions.

Security: owner and oracle_authority must be multisig wallets. The capital vaults are the most critical accounts, holding the entire lending capacity of the protocol.

Code:

code
Rust
download
content_copy
expand_less

use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct GlobalMarket {
    // --- Authorities (MUST be multisig) ---
    pub owner: Pubkey, // Governance authority (can change fees, etc.).
    pub oracle_authority: Pubkey, // The ONLY wallet allowed to update treasury values.

    // --- Protocol Capital Vaults (Where the lending money is stored) ---
    #[account(mut)]
    pub capital_vault_usdc: Pubkey,
    #[account(mut)]
    pub capital_vault_usdt: Pubkey,

    // --- Treasury Valuation (The Oracle Core) ---
    #[account(mut)]
    pub total_treasury_value_usd: u128,
    pub last_treasury_update_ts: i64,

    // --- NFT Configuration ---
    pub nft_collection_key: Pubkey,
    pub total_nft_supply: u32,
    pub max_staked_nfts: u32, // The hard cap (e.g., 1000).
    #[account(mut)]
    pub current_staked_nfts: u32, // Live counter of NFTs in the system.

    // --- Dynamic APY Configuration ---
    pub min_interest_rate_bps: u16, // e.g., 700 for 7.00%.
    pub max_interest_rate_bps: u16, // e.g., 1500 for 15.00%.
}

File: programs/constellation/src/state/borrower_account.rs

Purpose: A new, crucial account. Instead of one account per loan, we create one account per borrower's wallet. This account tracks all NFTs they have deposited and all loans they have taken.

Security: This consolidates a user's position, making it easier to calculate their total borrowing power and risk profile. It enforces the "max five NFTs" rule at the source.

Code:

code
Rust
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
use anchor_lang::prelude::*;

#[account]
pub struct BorrowerAccount {
    pub owner: Pubkey, // The user's wallet address.
    pub global_market: Pubkey, // Link to the master account.

    // --- Collateral Tracking ---
    // Enforces the "max five" rule at the struct level.
    pub deposited_nfts: Vec<Pubkey>, // Stores the mint addresses of the deposited NFTs.
    
    // --- Debt Tracking ---
    pub active_loans: Vec<Pubkey>, // Stores the public keys of their active Loan accounts.

    pub total_borrowing_power_usd: u128,
    pub total_debt_usd: u128,
}

File: programs/constellation/src/state/loan.rs

Purpose: A dedicated account for each individual loan, capturing its specific terms.

Security: Remains largely the same, but now it's linked to a BorrowerAccount instead of just an owner.

Code:

code
Rust
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
use anchor_lang::prelude::*;

#[account]
pub struct Loan {
    pub borrower_account: Pubkey, // Links back to the master account for this user.
    pub principal_amount_usd: u64, // Loan is denominated in USD.
    pub borrowed_asset_mint: Pubkey, // Which stablecoin was actually borrowed.
    
    pub start_ts: i64,
    pub duration_secs: u32,
    pub grace_period_ends_ts: i64,

    pub interest_rate_at_origination_bps: u16, // The APY at the moment the loan was taken.
    pub interest_paid_usd: u64,

    pub status: LoanStatus,
}
// LoanStatus enum remains the same: Active, Defaulted, Repaid.

Step 2: The Core Instructions (The Protocol's Actions)

A. deposit_nft()

Action: A user stakes one of their NFTs to increase their borrowing power.

Logic:

Initialize BorrowerAccount: If this is the user's first deposit, create a new BorrowerAccount for them.

Enforce Max NFTs: Check if borrower_account.deposited_nfts.len() >= 5. If so, reject the transaction with a MaxNftsReached error.

Validate NFT: Confirm the NFT belongs to your collection.

Create Escrow: Transfer the NFT into a protocol-owned escrow account.

Update State: Add the NFT's mint address to the deposited_nfts vector and increment global_market.current_staked_nfts.

Recalculate Borrowing Power: Immediately recalculate the user's total_borrowing_power_usd based on the new total number of NFTs they have staked and the current treasury value.

B. take_loan()

Action: A user with a positive borrowing power takes out a fixed-term loan.

Logic:

Calculate Current APY: This is the core of your dynamic model.

code
Rust
download
content_copy
expand_less
IGNORE_WHEN_COPYING_START
IGNORE_WHEN_COPYING_END
// Inside the handler
let market = &ctx.accounts.global_market;
// A simple linear interpolation model. Can be made more complex (e.g., exponential).
let utilization_ratio = market.current_staked_nfts as f64 / market.max_staked_nfts as f64;
let rate_range = market.max_interest_rate_bps - market.min_interest_rate_bps;
let current_rate_bps = market.min_interest_rate_bps + (rate_range as f64 * utilization_ratio) as u16;

Check Borrow Limit: Ensure the requested loan_amount_usd + the user's total_debt_usd does not exceed their total_borrowing_power_usd.

Check Protocol Liquidity: Ensure the global_market.capital_vault_usdc has enough funds to cover the loan.

Create Loan Account: Create a new Loan account, storing the current_rate_bps as its fixed interest rate for the term.

Disburse Funds: CPI call to transfer the stablecoins from the capital_vault to the user.

Update State: Add the new loan's public key to the borrower_account.active_loans and update their total_debt_usd.

C. trigger_liquidation_auction()

Action: Called by a bot when a loan meets either of the two default conditions.

Logic:

Identify Trigger: The instruction must accept an input specifying the reason for liquidation (TermExpired or CollateralValueDrop).

Condition 1: Term Expired Check: require!(Clock::get()?.unix_timestamp > loan.grace_period_ends_ts, ...)

Condition 2: Value Drop Check:

Recalculate the current value of the borrower's entire collateral portfolio (total_borrowing_power_usd).

require!(borrower_account.total_debt_usd > borrower_account.total_borrowing_power_usd, ...)

Execute: If either condition is met, the logic is the same:

Seize all NFTs in the borrower_account.deposited_nfts.

Mark all of their active loans as Defaulted.

Create one or more NftAuction accounts to begin selling the seized NFTs to recover the total outstanding debt.

Part III: Off-Chain Sentinels (The Bots)

1. The Oracle Bot (The Appraiser)

Purpose & Logic: This remains identical to the previous blueprint. Its job is to securely and reliably report the total_treasury_value_usd to the GlobalMarket account. This is your most critical piece of infrastructure.

2. The Liquidation Bot (The Watchman)

Purpose: This bot's logic becomes more complex, as it now has two conditions to monitor for every borrower.

Architecture:

Logic Loop (runs every minute):

Fetch All BorrowerAccounts.

For each account, perform two checks:

Check 1: Term Expiration.

Iterate through the active_loans for this borrower.

Fetch each Loan account.

If currentTime > loan.grace_period_ends_ts, add this BorrowerAccount to a "Term Expired Liquidation Queue."

Check 2: Collateral Value.

Fetch the live total_treasury_value_usd from the GlobalMarket.

Recalculate what the borrower's total_borrowing_power_usd should be.

If borrower_account.total_debt_usd > calculated_borrowing_power, add this BorrowerAccount to a "Value Drop Liquidation Queue."

Execute Liquidations:

For every account in the queues, build and send a transaction to call the trigger_liquidation_auction() instruction.

Part IV: Your Profit & Capital Flow

Initial Capital: You fund the capital_vault_usdc and capital_vault_usdt from your NFT mint revenue. This is the money that gets loaned out.

Primary Profit (Interest): All interest payments made by borrowers are your profit. When a user pays interest in USDC/USDT, it goes directly back into your capital vaults, increasing their size. When they pay in $WHISKEY, it goes to a protocol-owned wallet.

Secondary Profit (Liquidations): When an NFT is auctioned off, the proceeds are used to cover the outstanding principal of the loan. Any surplus from the auction is pure profit for the protocol.

This protocol-as-lender model means you are not sharing the interest revenue with anyone. Your profit potential is higher, but so is your risk, as you are fronting 100% of the capital. This blueprint provides the necessary controls and automated systems to manage that risk effectively.