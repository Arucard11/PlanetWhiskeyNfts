# 🏛️ Complete Vault Architecture Analysis

## 🚨 CRITICAL ISSUE IDENTIFIED

**The problem:** Our take-loan API was using the **lending program's capital vault** instead of the **whiskey program's USDC vault** that's configured in the environment file.

## 📊 Complete Vault Mapping

### 1. **Whiskey Program (68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD)**

#### PDAs Created:
- **Collection Config**: `[b"collection", collection_name]` 
- **Wallet NFT Counter**: `[b"wallet_nft_counter", wallet, collection_config]`
- **Lending Pool Config**: `[b"lending_pool"]` 
- **WHISKEY Vault V2**: `[b"lending_pool", b"whiskey_vault_v2"]`
- **USDC Vault V2**: `[b"lending_pool", b"usdc_vault_v2"]` ← **THIS IS THE CORRECT ONE**
- **Program Admin Config**: `[b"program_super_admin"]`

#### Environment Variables:
```
NEXT_PUBLIC_LENDING_POOL_CONFIG=53fYDhvsfCJYMx6eTbjn92N35YDwTShQy8KM3X2yP2GN
NEXT_PUBLIC_LENDING_POOL_WHISKEY_VAULT=FBK8xP4xYuEv1JvCkkvhCKkTtu9M2xXnyihuqSDRAhCS
NEXT_PUBLIC_LENDING_POOL_USDC_VAULT=GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm ← **CORRECT**
```

### 2. **Lending Program (25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ)**

#### PDAs Created:
- **Global Market**: `[b"global_market"]`
- **Collection Registry**: `[b"collection_registry"]` 
- **Collection Registry V2**: `[b"collection_registry_v2"]`
- **Borrower Account**: `[b"borrower_account", user_wallet]`
- **Loan**: `[b"loan", borrower_wallet, loan_counter]`
- **Collateral Escrow**: `[b"collateral_escrow", user_wallet, nft_mint]`
- **NFT Auction**: `[b"nft_auction", borrower_account]`
- **Capital Vault USDC**: `[b"capital_vault_usdc"]` ← **WE WERE USING THIS INCORRECTLY**

#### Environment Variables:
```
NEXT_PUBLIC_GLOBAL_MARKET_PDA=5WYm2YmxdQKHdGTJmvyZ1bmXsyZE2eJGJHPaQP5mopq7
```

### 3. **Marketplace Program (6SHqHpSVYHUbkX3AgMg3XcAxH5Eax48T9orPAio6j4Wk)**

#### PDAs Created:
- **Marketplace Listing**: `[b"listing", seller_wallet, nft_mint]`
- **Escrow Token Account**: `[b"escrow", listing_pda]`

## 🔧 **The Architecture Design:**

1. **Whiskey Program** = Revenue collection & swapping
   - Collects WHISKEY from NFT mints
   - Swaps WHISKEY → USDC via Jupiter (mainnet)
   - Stores USDC in `lending_pool/usdc_vault_v2` for lending

2. **Lending Program** = Borrowing against NFT collateral
   - Should use the **Whiskey Program's USDC vault** as capital source
   - Has its own `capital_vault_usdc` but this was meant for different purposes

3. **Marketplace Program** = NFT trading
   - Independent escrow system for NFT sales

## 🚨 **Why We Had The Wrong Vault:**

The lending program was designed to use the **whiskey program's USDC vault** as its capital source, but our API was incorrectly using the lending program's own `capital_vault_usdc`. This is why:

1. The environment file correctly points to: `GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm` (whiskey program's vault)
2. Our API was using: `He84QophgrA8GCQTGjkLkUi5qjKCF5Qmrb4Q6Nrt3jL9` (lending program's vault)
3. We funded the wrong vault with 200,000 USDC!

## 🎯 **Correct Flow:**
NFT Mints → WHISKEY Revenue → Jupiter Swap → USDC in Whiskey Program Vault → Lending Program Uses This USDC
