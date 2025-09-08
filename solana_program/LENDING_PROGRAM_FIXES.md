# 🔧 LENDING PROGRAM MAINNET FIXES

## 🚨 CRITICAL FIXES NEEDED

### **1. Fix Capital Vault Authority in TakeLoan Context**

**Current (INSECURE):**
```rust
#[account(mut)]
pub capital_vault: Account<'info, TokenAccount>,
```

**Fixed (SECURE):**
```rust
#[account(
    mut,
    seeds = [CAPITAL_VAULT_SEED],
    bump,
    constraint = capital_vault.mint == asset_mint.key() @ ErrorCode::InvalidAssetMint,
    constraint = capital_vault.owner == global_market.key() @ ErrorCode::InvalidVaultAuthority
)]
pub capital_vault: Account<'info, TokenAccount>,
```

### **2. Add Initialize Capital Vault Instruction**

Add this to the lending program:

```rust
/// Initialize the lending program's capital vault
pub fn initialize_capital_vault(_ctx: Context<InitializeCapitalVault>) -> Result<()> {
    msg!("Lending capital vault initialized successfully");
    Ok(())
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
```

### **3. Add Error Codes**

```rust
#[error_code]
pub enum ErrorCode {
    // ... existing errors ...
    
    #[msg("Invalid asset mint for capital vault")]
    InvalidAssetMint,
    
    #[msg("Invalid vault authority - must be global market PDA")]
    InvalidVaultAuthority,
}
```

### **4. Update Global Market Initialization**

The `initialize_global_market` should validate that `capital_vault_usdc` is the correct PDA:

```rust
pub fn initialize_global_market(
    ctx: Context<InitializeGlobalMarket>,
    max_staked_nfts: u32,
    per_nft_value_usd: u64,
) -> Result<()> {
    let global_market = &mut ctx.accounts.global_market;

    // Validate that capital_vault_usdc is the correct PDA
    let (expected_capital_vault, _) = Pubkey::find_program_address(
        &[CAPITAL_VAULT_SEED],
        ctx.program_id
    );
    
    require!(
        ctx.accounts.capital_vault_usdc.key() == expected_capital_vault,
        ErrorCode::InvalidVaultAuthority
    );

    // ... rest of initialization ...
}
```

## 🏗️ IMPLEMENTATION STEPS

1. **Update lending program with fixes**
2. **Rebuild and redeploy to devnet for testing** 
3. **Test capital vault initialization**
4. **Test loan functionality with proper constraints**
5. **Deploy to mainnet with verified build**

## 🎯 WHY THESE FIXES ARE CRITICAL

- **Security**: Prevents using arbitrary token accounts as capital vault
- **Authority**: Ensures lending program controls its vault
- **Mainnet Ready**: Proper PDA constraints for production use
- **Automated**: Capital vault can be initialized programmatically
