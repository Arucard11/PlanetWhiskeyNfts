# Lending Program Redeployment Analysis

## ⚠️ CRITICAL FINDINGS

### 1. **Program Upgrade vs Redeploy**

**YES, you need to redeploy** because we changed the program logic (removed fee calculation).

**However, you have TWO options:**

#### Option A: **UPGRADE Existing Program** (RECOMMENDED)
- Keep the same program ID: `CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1`
- All PDAs stay the same
- No address changes needed
- **Requires upgrade authority keypair**

#### Option B: **Redeploy New Program** (More Complex)
- New program ID will be generated
- **ALL PDAs will change** (they're derived from program ID)
- Requires updating Whiskey program hardcoded address
- Requires updating all environment variables

---

## 🔗 Critical Dependencies

### 1. **Whiskey Program → Lending Program**
The Whiskey program (`9HCie1czuSrxHYZ97uxH7WnyBA8bqV1SVjn64VZmCp6q`) has:
- **Hardcoded Lending Program ID**: `CcpYcpSKnCRvhv8xb8RkGKw7BGDCdrcNdzNjpSpFbpC1`
- **Hardcoded Capital Vault Address**: `BnceBJj5HUaaxwZ4e42ympVG1VstGoNMfnXhQsM8YXwo`

**Location**: `solana_program/programs/solana_program/src/lib.rs:32-35`

If you redeploy with a new ID, you MUST:
1. Update the Whiskey program's hardcoded lending program ID
2. Update the Whiskey program's hardcoded capital vault address
3. Redeploy the Whiskey program too

### 2. **PDAs That Depend on Lending Program ID**

All these PDAs are derived from the lending program ID:

```rust
// Seeds used in lending program
- global_market: [b"global_market"] + lending_program_id
- borrower_account: [b"borrower_account", user_wallet] + lending_program_id  
- loan: [b"loan", user_wallet, loan_counter] + lending_program_id
- collateral_escrow: [b"collateral_escrow"] + lending_program_id
- capital_vault_usdc: [b"capital_vault_usdc"] + lending_program_id
- collection_registry: [b"collection_registry_v2"] + lending_program_id
```

**If program ID changes, ALL these addresses change!**

---

## 📋 What Needs Updating (If Redeploying)

### 1. **Rust Programs**
- `solana_program/programs/lendingprogram/src/lib.rs:8` - `declare_id!()` 
- `solana_program/programs/solana_program/src/lib.rs:32` - `LENDING_PROGRAM_ID`
- `solana_program/programs/solana_program/src/lib.rs:35` - `CAPITAL_VAULT_USDC` (new PDA address)

### 2. **Environment Variables**
- `NEXT_PUBLIC_LENDING_PROGRAM_ID` (in `.env.local` and `env.example`)
- `NEXT_PUBLIC_GLOBAL_MARKET` (new PDA)
- `NEXT_PUBLIC_COLLECTION_REGISTRY` (new PDA)
- `NEXT_PUBLIC_CAPITAL_VAULT_PDA` (new PDA)

### 3. **Frontend Code**
All files using `process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID` will automatically pick up the new value from env vars (31 files found)

### 4. **IDL Files**
- `planet-whiskey-nfts/src/lib/idl/lendingprogram.json` - Update address field
- `planet-whiskey-nfts/src/lib/idl/lendingprogram.ts` - Update address field
- `planet-whiskey-nfts/src/types/lendingprogram.ts` - Update address field

---

## 💰 Closing Old Program & Recovering SOL

### To Close the Old Program:
```bash
# 1. Close the program account (requires upgrade authority)
solana program close <PROGRAM_ID> --bypass-warning

# 2. This will:
#    - Close the program account
#    - Return rent SOL to the upgrade authority
#    - Make the program ID unusable
```

**⚠️ WARNING**: Once closed, you CANNOT upgrade it anymore. The program ID is permanently closed.

### Better Approach: **UPGRADE Instead of Close**
```bash
# Upgrade the existing program (keeps same ID)
anchor upgrade target/deploy/lendingprogram.so \
  --program-id <UPGRADE_AUTHORITY_KEYPAIR> \
  --provider.cluster mainnet
```

---

## ✅ RECOMMENDED APPROACH: Program Upgrade

### Steps:
1. **Build the updated program**
   ```bash
   cd solana_program
   anchor build
   ```

2. **Upgrade the existing program** (keeps same ID)
   ```bash
   anchor upgrade target/deploy/lendingprogram.so \
     --program-id <YOUR_UPGRADE_AUTHORITY_KEYPAIR> \
     --provider.cluster mainnet
   ```

3. **No environment variable changes needed** ✅
4. **No PDA address changes needed** ✅
5. **No Whiskey program changes needed** ✅

### Benefits:
- ✅ Same program ID
- ✅ Same PDA addresses
- ✅ No frontend changes
- ✅ No Whiskey program changes
- ✅ Existing loans continue to work
- ✅ Existing borrower accounts continue to work

---

## 🔄 If You Must Redeploy (New Program ID)

### Steps:
1. **Deploy new lending program** → Get new program ID
2. **Calculate new PDAs** using new program ID
3. **Update Whiskey program**:
   - Change `LENDING_PROGRAM_ID` constant
   - Change `CAPITAL_VAULT_USDC` constant to new PDA
   - Redeploy Whiskey program
4. **Initialize all accounts** on new program:
   - Global Market
   - Collection Registry
   - Capital Vault (and fund it)
5. **Update environment variables**
6. **Update IDL files**
7. **Migrate data** (if any stored off-chain)

### ⚠️ Major Issues:
- ❌ All existing loans become invalid
- ❌ All existing borrower accounts become invalid
- ❌ Users lose access to their collateral
- ❌ Need to migrate all data
- ❌ Need to update Whiskey program
- ❌ Capital vault needs to be re-funded

---

## 🎯 FINAL RECOMMENDATION

**USE PROGRAM UPGRADE, NOT REDEPLOYMENT**

The change we made (removing fee calculation) is a simple logic change that can be upgraded in-place. This is the safest and simplest approach.

