# 🏛️ COMPLETE CROSS-PROGRAM ARCHITECTURE ANALYSIS

## 🚨 CRITICAL CROSS-PROGRAM DEPENDENCIES

This analysis covers ALL PDAs, vaults, and shared addresses across the three programs, explaining why each exists and how they interconnect.

---

## 📋 **SHARED CONSTANTS & ADDRESSES**

### **Admin Wallet (CRITICAL SHARED)**
- **Address**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`
- **Used By**: ALL THREE PROGRAMS
- **Purpose**: Ultimate authority for all administrative functions
- **Why Shared**: Single point of control for the entire ecosystem

### **Program IDs**
- **Whiskey Program**: `68iiLsi736PMxTYoS8Lbgczk1odiLzyAkb6y2sm5TtnD`
- **Lending Program**: `25HNJoG1kZpLHT7B94LHbpGjV2BtBPcSfQgCkLSrxYVZ`  
- **Marketplace Program**: `6SHqHpSVYHUbkX3AgMg3XcAxH5Eax48T9orPAio6j4Wk`

### **Token Mints (CRITICAL SHARED)**
- **WHISKEY Token**: `FuXejqzRAWWkoAcNrDU8L2i6cXXmB5NwqAVp2daN456j`
- **USDC Token**: `5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR` (devnet)
- **Used By**: ALL THREE PROGRAMS
- **Why Shared**: Common currency system

---

## 🥃 **WHISKEY PROGRAM PDAs**

### **1. Program Super Admin**
- **Seeds**: `[b"program_super_admin"]`
- **Purpose**: Program-level admin configuration
- **Authority**: Admin wallet
- **Used For**: Program initialization control

### **2. Collection Config (Per Collection)**
- **Seeds**: `[b"collection", collection_name.as_bytes()]`
- **Purpose**: Individual NFT collection configuration
- **Authority**: PDA itself (self-governing)
- **Contains**: Collection metadata, pricing, mint limits
- **Why**: Each collection needs independent configuration

### **3. Wallet NFT Counter (Per User Per Collection)**
- **Seeds**: `[b"wallet_nft_counter", user_wallet, collection_config]`
- **Purpose**: Track NFT mints per wallet per collection
- **Limit**: Max 5 NFTs per wallet per collection
- **Why**: Prevent spam minting

### **4. Lending Pool Config (CRITICAL SHARED)**
- **Seeds**: `[b"lending_pool"]`
- **Program**: Whiskey Program
- **Purpose**: Central configuration for revenue collection
- **Authority**: Admin wallet
- **Referenced By**: Lending program for vault access

### **5. WHISKEY Vault V2 (CRITICAL SHARED)**
- **Seeds**: `[b"lending_pool", b"whiskey_vault_v2"]`
- **Program**: Whiskey Program
- **Purpose**: Stores WHISKEY tokens from NFT sales
- **Authority**: Lending Pool Config PDA
- **Used By**: Jupiter swaps (mainnet)

### **6. USDC Vault V2 (CRITICAL SHARED)**
- **Seeds**: `[b"lending_pool", b"usdc_vault_v2"]`
- **Program**: Whiskey Program
- **Purpose**: Stores USDC from WHISKEY swaps
- **Authority**: Lending Pool Config PDA
- **Referenced By**: Lending program as capital source
- **Environment Var**: `NEXT_PUBLIC_LENDING_POOL_USDC_VAULT`

---

## 🏦 **LENDING PROGRAM PDAs**

### **1. Global Market (MASTER ACCOUNT)**
- **Seeds**: `[b"global_market"]`
- **Purpose**: Master configuration for entire lending protocol
- **Authority**: Admin wallet
- **Contains**: All lending parameters, vault references, fee splits
- **References**: 
  - `capital_vault_usdc` → Points to Whiskey Program's USDC Vault V2
  - `treasury_wallet` → Admin wallet for fee collection
  - `collection_registry` → NFT collection approvals

### **2. Collection Registry V2**
- **Seeds**: `[b"collection_registry_v2"]`
- **Purpose**: Approved NFT collections for collateral
- **Authority**: Admin wallet
- **Contains**: List of approved collection mints and USD values
- **Why V2**: Upgraded version with better scalability

### **3. Borrower Account (Per User)**
- **Seeds**: `[b"borrower_account", user_wallet]`
- **Purpose**: User's lending profile and collateral tracking
- **Contains**: 
  - Deposited NFTs (max 5)
  - Active loans (max 10)
  - Total borrowing power
  - Total debt
- **References**: Global Market PDA

### **4. Loan (Per Loan)**
- **Seeds**: `[b"loan", borrower_wallet, loan_counter]`
- **Purpose**: Individual loan details
- **Contains**: Principal, interest rate, duration, status
- **Unique**: Each loan gets unique counter from borrower account

### **5. Collateral Escrow (Per NFT)**
- **Seeds**: `[b"collateral_escrow", user_wallet, nft_mint]`
- **Purpose**: Holds deposited NFT as collateral
- **Authority**: Borrower Account PDA
- **Contains**: 1 NFT token locked until loan repayment

### **6. NFT Auction (Per Defaulted Borrower)**
- **Seeds**: `[b"nft_auction", borrower_account]`
- **Purpose**: Liquidation auction for defaulted loans
- **Contains**: Auction details, bidding information

---

## 🛒 **MARKETPLACE PROGRAM PDAs**

### **1. Marketplace Listing (Per NFT Sale)**
- **Seeds**: `[b"listing", seller_wallet, nft_mint]`
- **Purpose**: NFT sale listing details
- **Contains**: Price, seller, NFT mint
- **Authority**: PDA itself

### **2. Escrow Token Account (Per Listing)**
- **Seeds**: `[b"escrow", listing_pda]`
- **Purpose**: Holds NFT during sale
- **Authority**: Listing PDA
- **Contains**: 1 NFT token until sale completion

---

## 🔗 **CRITICAL CROSS-PROGRAM CONNECTIONS**

### **1. Revenue Flow Architecture**
```
NFT Mint → WHISKEY Payment → Whiskey Program Vault → Jupiter Swap → USDC Vault V2 → Lending Capital
```

### **2. Global Market References**
The Lending Program's Global Market PDA contains:
- **`capital_vault_usdc`**: Points to Whiskey Program's USDC Vault V2
- **`treasury_wallet`**: Admin wallet for all fee collection
- **`collection_registry`**: Approved collections for collateral

### **3. Treasury Wallet Usage**
- **Whiskey Program**: Receives 20% of mint revenue as WHISKEY
- **Lending Program**: Receives transaction fees as USDC
- **Marketplace Program**: Receives trading fees as WHISKEY
- **All programs use same admin wallet**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`

### **4. Collection Registry Synchronization**
- **Whiskey Program**: Creates NFT collections
- **Lending Program**: Must approve collections for collateral
- **Admin must sync**: Collections created in Whiskey → Approved in Lending

---

## 🎯 **INITIALIZATION ORDER (CRITICAL)**

### **Phase 1: Token Mints**
1. Create WHISKEY token mint (or use existing)
2. Create USDC token mint (devnet) or use mainnet USDC

### **Phase 2: Whiskey Program**
1. Initialize Program Super Admin
2. Initialize Lending Pool Config
3. Create WHISKEY Vault V2
4. Create USDC Vault V2
5. Create initial NFT collections

### **Phase 3: Lending Program**
1. Initialize Global Market (references Whiskey Program vaults)
2. Initialize Collection Registry V2
3. Add approved collections to registry

### **Phase 4: Marketplace Program**
1. No initialization required (stateless except for listings)

### **Phase 5: Fund Vaults**
1. Fund USDC Vault V2 with lending capital
2. Mint test WHISKEY for testing (devnet only)

---

## ⚠️ **CRITICAL DEPENDENCIES**

### **Lending Program MUST Reference Whiskey Program Vaults**
- **Wrong**: Using lending program's own capital vault
- **Correct**: Using whiskey program's USDC vault V2
- **Why**: Revenue flows through whiskey program first

### **All Programs MUST Use Same Admin Wallet**
- **Treasury operations**: Fee collection, profit withdrawal
- **Administrative functions**: Config updates, collection approvals
- **Emergency functions**: Pause, upgrade, recovery

### **Collection Registry Synchronization Required**
- **Whiskey Program**: Creates collections
- **Lending Program**: Must approve same collections
- **Manual sync required**: Admin must add collections to lending registry

---

## 🚀 **ENVIRONMENT VARIABLES MAPPING**

### **Critical Shared Variables**
```env
NEXT_PUBLIC_ADMIN_WALLET=2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk
NEXT_PUBLIC_TREASURY_WALLET=2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk
NEXT_PUBLIC_WHISKEY_TOKEN_MINT=FuXejqzRAWWkoAcNrDU8L2i6cXXmB5NwqAVp2daN456j
NEXT_PUBLIC_USDC_TOKEN_MINT=5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR
```

### **Whiskey Program PDAs**
```env
NEXT_PUBLIC_LENDING_POOL_CONFIG=<derived:[b"lending_pool"]>
NEXT_PUBLIC_LENDING_POOL_WHISKEY_VAULT=<derived:[b"lending_pool", b"whiskey_vault_v2"]>
NEXT_PUBLIC_LENDING_POOL_USDC_VAULT=<derived:[b"lending_pool", b"usdc_vault_v2"]>
```

### **Lending Program PDAs**
```env
NEXT_PUBLIC_GLOBAL_MARKET_PDA=<derived:[b"global_market"]>
NEXT_PUBLIC_COLLECTION_REGISTRY_V2=<derived:[b"collection_registry_v2"]>
```

This architecture ensures proper separation of concerns while maintaining necessary cross-program communication for the complete NFT ecosystem.
