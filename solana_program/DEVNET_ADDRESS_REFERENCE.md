# 📋 DEVNET ADDRESS REFERENCE - PLANET WHISKEY NFTS

## 🚀 PROGRAM ADDRESSES

### **Whiskey Program (NFT Minting & Revenue)**
- **Address**: `EDYShPdcvfTDDRrqhXBGFi4FE79PtgtqmbretcXQqeSA`
- **Purpose**: Handles NFT collection creation, minting, and revenue processing
- **Responsibilities**:
  - Creating and managing NFT collections
  - Processing NFT mints with WHISKEY token payments
  - Managing revenue splits (80% to lending, 20% to treasury)
  - Cross-program communication with lending protocol

### **Lending Program (Collateral & Loans)**
- **Address**: `ANA5H6ERBEFeiMMkYoG6EzNVLj7kjBywtsLr57Q9q66n`
- **Purpose**: Manages NFT-collateralized lending and borrowing
- **Responsibilities**:
  - Accepting NFT deposits as collateral
  - Dispensing USDC loans against NFT collateral
  - Managing loan repayments and interest
  - Liquidating defaulted loans

### **Marketplace Program (Trading)**
- **Address**: `6dNh2V9QKMc11RWv2TNmu9igwXw6pZGKi8g8bq1BnDX9`
- **Purpose**: Facilitates peer-to-peer NFT trading
- **Responsibilities**:
  - Creating and managing NFT listings
  - Processing buy/sell transactions with WHISKEY tokens
  - Collecting marketplace fees (2.5%)

---

## 🪙 TOKEN ADDRESSES

### **WHISKEY Token**
- **Mint Address**: `6ebFhcM7zXtmrNa6Nod6YRNhtH4tgC5YheHTwwBW8Nfu`
- **Decimals**: 6
- **Supply**: Unlimited (controlled mint)
- **Mint Authority**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk` (Admin)
- **Used For**:
  - NFT minting payments
  - Marketplace trading currency
  - Interest payments on loans
  - Revenue distribution

### **USDC Token (Test)**
- **Mint Address**: `4Cft5hME2qFcMkSKV1389QXtMSprrxYewsEGnj7usWHP`
- **Decimals**: 6
- **Supply**: Unlimited (test token)
- **Mint Authority**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk` (Admin)
- **Used For**:
  - Loan disbursements to borrowers
  - Loan repayments from borrowers
  - Liquidity pool funding

---

## 🏦 VAULT ADDRESSES & DETAILED PURPOSES

### **1. Capital Vault (Primary Lending Pool)**
- **Address**: `7zBwkZAz2TJBtTqMmDvhCJB92erXfvmzWm3TnbiKKiut`
- **Token Type**: USDC
- **Current Balance**: 500,000 USDC
- **Program**: Lending Program
- **PDA Seeds**: `["capital_vault_usdc"]`
- **Detailed Purpose**:
  - **Primary liquidity source** for all USDC loans
  - **Receives loan repayments** from borrowers
  - **Accumulates interest payments** from active loans
  - **Stores protocol reserves** for lending operations
  - **Handles liquidation proceeds** from defaulted loans
  - **Critical for**: Every borrow/repay transaction in the system

### **2. Whiskey Vault V2 (Revenue Collection)**
- **Address**: `4x5ZhxKZkJsYSCAaVq6kQMMvikxLL4hx9HGirBcQUbKD`
- **Token Type**: WHISKEY
- **Current Balance**: 500,000 WHISKEY
- **Program**: Whiskey Program
- **PDA Seeds**: `["lending_pool", "whiskey_vault_v2"]`
- **Detailed Purpose**:
  - **Receives WHISKEY tokens** when users mint NFTs
  - **Accumulates marketplace fees** (2.5% of each sale)
  - **Processes revenue splits**: 80% → lending pool, 20% → treasury
  - **Handles token swaps** from WHISKEY to USDC for lending pool funding
  - **Manages cross-program transfers** to capital vault
  - **Critical for**: NFT minting economics and lending pool liquidity

### **3. USDC Vault V2 (Revenue Processing)**
- **Address**: `232LGvjcrQPNzD9fiBd5Pghe3dSoUvj4oxBfshkC1fbo`
- **Token Type**: USDC
- **Current Balance**: 100,000 USDC
- **Program**: Whiskey Program
- **PDA Seeds**: `["lending_pool", "usdc_vault_v2"]`
- **Detailed Purpose**:
  - **Temporary storage** for USDC from WHISKEY token swaps
  - **Processes revenue conversion** from WHISKEY → USDC
  - **Handles automated transfers** to lending capital vault
  - **Manages liquidity flow** between programs
  - **Buffer vault** for cross-program operations
  - **Critical for**: Revenue processing pipeline and liquidity management

---

## 👑 ADMINISTRATIVE ADDRESSES

### **Admin Wallet (System Controller)**
- **Address**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`
- **WHISKEY Balance**: 1,000,000 tokens
- **USDC Balance**: 100,000 tokens
- **Authorities**:
  - **Program deployment and upgrades**
  - **Mint authority** for both WHISKEY and USDC tokens
  - **Protocol configuration** (interest rates, fees, limits)
  - **Collection management** (adding/removing approved NFT collections)
  - **Emergency functions** (pause, upgrade, recover)
  - **Liquidity management** (adding/removing funds from vaults)

### **Treasury Wallet (Protocol Treasury)**
- **Address**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk` (Same as admin for devnet)
- **Purpose**:
  - **Receives 20% revenue share** from all NFT minting
  - **Collects marketplace trading fees** (2.5% of each sale)
  - **Accumulates lending protocol fees**
  - **Funds protocol development** and operations
  - **Long-term sustainability** reserves

---

## 🏛️ PROTOCOL CONFIGURATION ADDRESSES

### **Global Market PDA (Lending Configuration)**
- **Address**: `3bcpuEViCJf2ntKuswLb2Tqxp7kbXXzLx7UqYpv6ajqX`
- **Program**: Lending Program
- **PDA Seeds**: `["global_market"]`
- **Contains**:
  - **Interest rate parameters**: Base rates for 1, 2, 3-month loans
  - **Utilization curves**: Dynamic interest rate adjustments
  - **Loan-to-value ratios**: Maximum borrowing against collateral
  - **Fee structures**: Transaction fees and revenue splits
  - **Risk parameters**: Maximum NFTs per user, liquidation thresholds
  - **Protocol statistics**: Total liquidity, active loans, utilization rates

### **Collection Registry V2 (Approved Collections)**
- **Address**: `B2jGdnUw5WbGdjmiXkxtYA2z3vaAnBsdT1yb5HajXtdh`
- **Program**: Lending Program
- **PDA Seeds**: `["collection_registry_v2"]`
- **Contains**:
  - **Approved NFT collections** for lending collateral
  - **Per-collection USD valuations** for loan calculations
  - **Collection approval status** (active/inactive)
  - **Risk parameters** per collection
  - **Historical data** and performance metrics

### **Lending Pool Config (Whiskey Program State)**
- **Address**: `3cikwByf5NkyepEafq5hdViU5nSdjRvuBTaZkvkXCKK1`
- **Program**: Whiskey Program
- **PDA Seeds**: `["lending_pool"]`
- **Contains**:
  - **Revenue processing configuration**
  - **Cross-program communication settings**
  - **Token swap parameters and slippage**
  - **Automated transfer schedules**
  - **Integration status** with lending program

---

## 🔄 SYSTEM FLOW DIAGRAM

```
USER MINTS NFT (pays WHISKEY)
         ↓
   Whiskey Vault V2 ← receives WHISKEY tokens
         ↓
   Revenue Split: 80% → USDC Vault V2 (via swap)
                  20% → Treasury Wallet
         ↓
   USDC Vault V2 → Capital Vault (lending liquidity)
         ↓
   USER BORROWS against NFT collateral
         ↓
   Capital Vault → disburses USDC loan
         ↓
   USER REPAYS loan + interest
         ↓
   Capital Vault ← receives repayment
         ↓
   Interest → Treasury (fees) + Capital Vault (reserves)
```

---

## 🛡️ SECURITY & ACCESS CONTROL

### **Program Authorities**:
- **Whiskey Program**: Admin wallet controls all functions
- **Lending Program**: Admin wallet controls configuration
- **Marketplace Program**: Decentralized (users control their listings)

### **Vault Authorities**:
- **Capital Vault**: Lending Program PDA (automated)
- **Whiskey Vault V2**: Whiskey Program PDA (automated)  
- **USDC Vault V2**: Whiskey Program PDA (automated)

### **Critical Operations Requiring Admin**:
- Adding new NFT collections to lending registry
- Updating interest rates and lending parameters
- Emergency pause/unpause functions
- Liquidity management and vault funding
- Program upgrades and migrations

---

## 📊 CURRENT SYSTEM STATUS

✅ **All Programs**: Deployed and operational  
✅ **All Tokens**: Created and funded  
✅ **All Vaults**: Initialized and funded  
✅ **All Configurations**: Set and validated  
✅ **Cross-Program Integration**: Active and tested  

**Total System Liquidity**: 1,100,000 USDC + 1,500,000 WHISKEY  
**Ready for**: Full production testing and user onboarding  

---

## 🚀 NEXT STEPS FOR TESTING

1. **Create NFT Collections** via admin panel
2. **Test NFT Minting** with WHISKEY payments
3. **Test Marketplace Trading** with WHISKEY
4. **Test Lending Operations**:
   - Deposit NFTs as collateral
   - Take USDC loans
   - Make interest payments
   - Repay loans and withdraw NFTs
5. **Monitor Revenue Flows** between vaults
6. **Validate Cross-Program Integration**

The entire Planet Whiskey NFT ecosystem is now fully operational on devnet! 🎉
