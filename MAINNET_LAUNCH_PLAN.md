# 🚀 MAINNET LAUNCH PLAN - LENDING PROTOCOL

## 🚨 **CRITICAL FIXES REQUIRED BEFORE MAINNET**

### **1. LENDING PROGRAM CAPITAL VAULT AUTHORITY ISSUE**

**❌ CURRENT PROBLEM:**
The lending program's `capital_vault` in the `TakeLoan` context is just an `Account<'info, TokenAccount>` without proper PDA constraints. This means:
- ❌ Any token account could be passed as `capital_vault`
- ❌ No guarantee the lending program controls it
- ❌ Security vulnerability

**✅ REQUIRED FIX:**
The `capital_vault` must be a proper PDA owned by the lending program:

```rust
#[account(
    mut,
    seeds = [CAPITAL_VAULT_SEED],
    bump,
    constraint = capital_vault.mint == asset_mint.key(),
    constraint = capital_vault.owner == global_market.key()
)]
pub capital_vault: Account<'info, TokenAccount>,
```

### **2. CAPITAL VAULT INITIALIZATION MISSING**

**❌ CURRENT PROBLEM:**
The lending program doesn't have an instruction to initialize its capital vault.

**✅ REQUIRED FIX:**
Add `initialize_capital_vault` instruction:

```rust
#[derive(Accounts)]
pub struct InitializeCapitalVault<'info> {
    #[account(mut)]
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
}
```

### **3. REVENUE FLOW MECHANISM MISSING**

**❌ CURRENT PROBLEM:**
No mechanism for whiskey program to transfer USDC to lending program's capital vault.

**✅ REQUIRED FIX:**
Add Cross-Program Invocation (CPI) instruction in whiskey program:

```rust
// In whiskey program
pub fn transfer_to_lending_vault(ctx: Context<TransferToLendingVault>, amount: u64) -> Result<()> {
    let lending_program_id = Pubkey::from_str("LENDING_PROGRAM_ID").unwrap();
    let (lending_capital_vault, _) = Pubkey::find_program_address(
        &[b"capital_vault_usdc"],
        &lending_program_id
    );

    // Transfer from whiskey USDC vault to lending capital vault
    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.whiskey_usdc_vault.to_account_info(),
            to: ctx.accounts.lending_capital_vault.to_account_info(),
            authority: ctx.accounts.lending_pool_config.to_account_info(),
        },
        &signer_seeds
    );
    token::transfer(transfer_ctx, amount)
}
```

---

## 🏗️ **COMPLETE MAINNET DEPLOYMENT SEQUENCE**

### **Phase 1: Deploy Programs**
1. Deploy whiskey program to mainnet
2. Deploy lending program to mainnet (with fixes)
3. Deploy marketplace program to mainnet
4. Verify all program IDs

### **Phase 2: Initialize Core Infrastructure**
1. Initialize whiskey program super admin
2. Create lending pool config
3. Initialize lending program global market
4. **Initialize lending program capital vault** ⭐
5. Initialize collection registry

### **Phase 3: Setup Revenue Flow**
1. Create whiskey program vaults (WHISKEY + USDC)
2. Link whiskey program to lending program
3. Test revenue transfer mechanism
4. Verify lending program can disburse loans

### **Phase 4: Fund and Test**
1. Fund lending capital vault with initial USDC
2. Add test collections
3. Test complete flow: NFT mint → Revenue → Lending
4. Verify all permissions and authorities

---

## 🔧 **CORRECTED LENDING PROGRAM CODE**

```rust
// Add to lending program lib.rs

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

pub fn initialize_capital_vault(_ctx: Context<InitializeCapitalVault>) -> Result<()> {
    msg!("Capital vault initialized successfully");
    Ok(())
}

// Fix TakeLoan context
#[derive(Accounts)]
pub struct TakeLoan<'info> {
    // ... other accounts ...

    #[account(
        mut,
        seeds = [CAPITAL_VAULT_SEED],
        bump,
        constraint = capital_vault.mint == asset_mint.key() @ ErrorCode::InvalidAssetMint,
        constraint = capital_vault.owner == global_market.key() @ ErrorCode::InvalidVaultAuthority
    )]
    pub capital_vault: Account<'info, TokenAccount>,

    // ... rest of accounts ...
}
```

---

## 🎯 **MAINNET INITIALIZATION SCRIPT**

```typescript
class MainnetInitializer {
  async initializeMainnet() {
    console.log('🚀 Starting Mainnet Initialization...');
    
    // 1. Deploy all programs
    await this.deployPrograms();
    
    // 2. Initialize whiskey program
    await this.initializeWhiskeyProgram();
    
    // 3. Initialize lending program with PROPER capital vault
    await this.initializeLendingProgram();
    
    // 4. Setup revenue flow between programs
    await this.setupRevenueFlow();
    
    // 5. Fund capital vault
    await this.fundCapitalVault();
    
    // 6. Test complete system
    await this.testSystem();
    
    console.log('✅ Mainnet initialization complete!');
  }
  
  async initializeLendingProgram() {
    // Initialize global market
    await this.lendingProgram.methods
      .initializeGlobalMarket(maxStakedNfts, perNftValueUsd)
      .accounts({
        globalMarket: this.addresses.globalMarket,
        collectionRegistry: this.addresses.collectionRegistry,
        owner: this.adminKeypair.publicKey,
        capitalVaultUsdc: this.addresses.lendingCapitalVault, // ⭐ CRITICAL
        treasuryWallet: this.adminKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.adminKeypair])
      .rpc();
      
    // ⭐ Initialize capital vault (NEW INSTRUCTION REQUIRED)
    await this.lendingProgram.methods
      .initializeCapitalVault()
      .accounts({
        admin: this.adminKeypair.publicKey,
        globalMarket: this.addresses.globalMarket,
        capitalVault: this.addresses.lendingCapitalVault,
        usdcMint: this.addresses.usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([this.adminKeypair])
      .rpc();
  }
}
```

---

## ⚠️ **MAINNET SECURITY CHECKLIST**

### **Before Launch:**
- [ ] Lending program capital vault has proper PDA constraints
- [ ] Capital vault initialization instruction exists
- [ ] Global market points to correct capital vault address
- [ ] Revenue transfer mechanism implemented
- [ ] All program authorities verified
- [ ] Cross-program references tested
- [ ] Initial funding mechanism ready

### **During Launch:**
- [ ] Deploy programs with verified builds
- [ ] Initialize all PDAs with correct parameters
- [ ] Fund capital vault with real USDC
- [ ] Test loan disbursement
- [ ] Verify revenue flow
- [ ] Monitor all transactions

### **After Launch:**
- [ ] Set up monitoring for vault balances
- [ ] Implement automated revenue transfers
- [ ] Monitor loan health ratios
- [ ] Track cross-program interactions

---

## 🎯 **CRITICAL SUCCESS FACTORS**

1. **✅ Lending Program Authority**: Must control its own capital vault
2. **✅ Revenue Flow**: Whiskey program must transfer USDC to lending vault
3. **✅ Proper Constraints**: All PDAs must have correct seeds and constraints
4. **✅ Initial Funding**: Capital vault must have USDC to disburse loans
5. **✅ Testing**: Complete end-to-end testing before mainnet launch

The current devnet setup works because we manually funded the vault, but mainnet needs the proper program architecture with automated revenue flow! 🏛️
