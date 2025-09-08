# 🏦 Global Market Initialization Guide

This guide explains how to initialize the Global Market account for the lending protocol.

## 📋 Prerequisites

1. **Admin Keypair**: Ensure you have `admin-keypair.json` in the root directory
2. **Solana CLI**: Make sure Solana CLI is installed and configured for devnet
3. **Sufficient Balance**: Admin wallet needs at least 2 SOL for initialization
4. **Program Deployed**: Lending program must be deployed to devnet

## 🚀 Quick Start

### Option 1: Simple Initialization (Recommended)

```bash
cd solana_program
pnpm run initialize:global-market-simple
```

### Option 2: Manual Initialization

```bash
cd solana_program
pnpm run initialize:global-market
```

## 🔧 What the Scripts Do

### 1. **Create Vault Accounts**
- **USDC Capital Vault**: Stores lending capital (USDC)
- **USDC Treasury Vault**: Stores transaction fees (USDC)
- **WHISKEY Treasury Vault**: Stores mint revenue (WHISKEY)

### 2. **Initialize Global Market**
- Sets maximum staked NFTs: **1,000**
- Sets default NFT value: **$100 USD**
- Sets base interest rates:
  - 1 Month: **3%**
  - 3 Months: **5%**
  - 6 Months: **8%**
- Sets transaction fee: **2.5%**
- Sets revenue split: **80% lending, 20% treasury**

### 3. **Save Deployment Info**
- Creates `global-market-deployment.json` with all addresses
- Records transaction signatures
- Saves network and timestamp information

## 📊 Default Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| Max Staked NFTs | 1,000 | Global collateral limit |
| Per NFT Value | $100 | Default USD value per NFT |
| Base 1M Rate | 3% | Interest rate for 1-month loans |
| Base 3M Rate | 5% | Interest rate for 3-month loans |
| Base 6M Rate | 8% | Interest rate for 6-month loans |
| Transaction Fee | 2.5% | Fee on all operations |
| Lending Share | 80% | Mint revenue to lending pool |
| Treasury Share | 20% | Mint revenue to treasury |

## 🔍 Verification

After initialization, verify the account was created:

```bash
solana account <GLOBAL_MARKET_PDA> --url devnet
```

## 🚨 Troubleshooting

### Common Issues:

1. **Insufficient Balance**
   ```
   ❌ Insufficient balance. Need at least 2 SOL for initialization.
   ```
   **Solution**: Airdrop SOL to admin wallet or transfer from another wallet

2. **Program Not Found**
   ```
   ❌ Program not found
   ```
   **Solution**: Ensure lending program is deployed to devnet

3. **Account Already Exists**
   ```
   ⚠️ Global Market already initialized!
   ```
   **Solution**: Account already exists, no action needed

4. **Invalid Instruction Data**
   ```
   ❌ Error: Invalid instruction data
   ```
   **Solution**: Use the simple version script instead

## 📁 Output Files

### `global-market-deployment.json`
```json
{
  "globalMarketPda": "Global Market PDA address",
  "usdcCapitalVault": "USDC Capital Vault address",
  "usdcTreasuryVault": "USDC Treasury Vault address",
  "whiskeyTreasuryVault": "WHISKEY Treasury Vault address",
  "maxStakedNfts": 1000,
  "perNftValueUsd": 100,
  "network": "Devnet",
  "timestamp": "2024-01-XX...",
  "transactionSignature": "Transaction signature"
}
```

## 🚀 Next Steps

After successful initialization:

1. **Add NFT Collections**: Use admin settings to approve collections
2. **Deposit Liquidity**: Add USDC to the capital vault for lending
3. **Test Functionality**: Try depositing NFTs and taking loans
4. **Monitor Activity**: Watch for any errors or issues

## 🔗 Related Commands

```bash
# Check admin balance
solana balance <ADMIN_PUBKEY> --url devnet

# View Global Market account
solana account <GLOBAL_MARKET_PDA> --url devnet

# Check transaction status
solana confirm <TX_SIGNATURE> --url devnet
```

## 📞 Support

If you encounter issues:

1. Check the console output for specific error messages
2. Verify admin wallet has sufficient SOL
3. Ensure program is deployed to devnet
4. Check network connectivity to devnet

---

**Note**: The Global Market account is a critical component. Only initialize once and ensure proper security measures are in place for production use.
