# 🏛️ CORRECTED VAULT ARCHITECTURE

## 🚨 CRITICAL FIX: Lending Program Must Own Its Capital Vault

### **PROBLEM IDENTIFIED**
- Whiskey program owned the USDC vault PDA
- Lending program couldn't control the vault to loan money
- Cross-program permission issues

### **CORRECT SOLUTION**
- **Lending program owns the capital vault PDA**
- **Whiskey program sends USDC TO the lending program's vault**
- **Clear separation of concerns with proper control**

---

## 📋 **CORRECTED SHARED ADDRESSES**

### **USDC Capital Vault (LENDING PROGRAM OWNED)**
- **Address**: `He84QophgrA8GCQTGjkLkUi5qjKCF5Qmrb4Q6Nrt3jL9`
- **Seeds**: `[b"capital_vault_usdc"]`
- **Program Owner**: **LENDING PROGRAM** 
- **Authority**: Lending Program's Global Market PDA
- **Used By**: 
  - **Lending Program**: Controls vault for loan disbursement
  - **Whiskey Program**: Sends converted USDC TO this vault
- **Why Correct**: Lending program needs control to loan money

### **WHISKEY USDC Vault V2 (WHISKEY PROGRAM OWNED)**  
- **Address**: `GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm`
- **Seeds**: `[b"lending_pool", b"usdc_vault_v2"]`
- **Program Owner**: **WHISKEY PROGRAM**
- **Authority**: Whiskey Program's Lending Pool Config PDA
- **Purpose**: **Intermediate vault** - receives USDC from swaps, then transfers to lending

---

## 🔄 **CORRECTED REVENUE FLOW**

```
NFT Mint Payment (WHISKEY)
    ↓
Whiskey Program WHISKEY Vault V2
    ↓  
Jupiter Swap (WHISKEY → USDC)
    ↓
Whiskey Program USDC Vault V2 (Intermediate)
    ↓
Transfer TO Lending Program Capital Vault ← **NEW STEP**
    ↓
Lending Program Capital Vault (FINAL DESTINATION)
    ↓
Loan Disbursement (Lending Program Controls)
```

---

## 🔧 **REQUIRED CHANGES**

### **1. Lending Program Changes**
- Keep existing `capital_vault_usdc` PDA owned by lending program
- Global Market references its own capital vault
- Full control over loan disbursement

### **2. Whiskey Program Changes**  
- Add instruction to transfer USDC from its vault to lending program's vault
- Periodic or triggered transfers of accumulated USDC
- Keep intermediate vault for swap operations

### **3. Environment Variables**
```env
# Lending Program's Capital Vault (MAIN LENDING CAPITAL)
NEXT_PUBLIC_LENDING_CAPITAL_VAULT=He84QophgrA8GCQTGjkLkUi5qjKCF5Qmrb4Q6Nrt3jL9

# Whiskey Program's Intermediate USDC Vault  
NEXT_PUBLIC_LENDING_POOL_USDC_VAULT=GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm
```

This ensures proper separation of concerns and control!
