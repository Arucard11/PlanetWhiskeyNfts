# Debugging Regular Mint Transaction Issues

## Overview
I've added comprehensive debugging tools to help identify why the regular mint transaction is failing. Here's how to use them:

## 🔍 Debug Panel
The debug panel appears automatically on regular (non-whiskey-gated) collection cards when your wallet is connected.

### How to Use:
1. **Connect your wallet** to the app
2. **Navigate to a regular collection** (not whiskey-gated)
3. **Look for the "🔍 Mint Debug Panel"** section below the mint button
4. **Click "Run Debug Checks"** to analyze your mint readiness

### What It Checks:
- ✅ **Wallet Balances**: SOL, WHISKEY, USDC
- ✅ **Account Status**: Collection config, capital vault, treasury accounts
- ✅ **RPC Health**: Connection to Solana network
- ✅ **NFT Limits**: Your current NFT count vs limits
- ✅ **Current Prices**: WHISKEY and SOL prices
- ✅ **Transaction Simulation**: Tests if transaction can be built

### Interpreting Results:
- **🟢 Green**: Ready to mint
- **🔴 Red**: Cannot mint (shows specific issues)
- **📊 Detailed Data**: Expand "Raw Debug Data" for technical details

## 📝 Enhanced Console Logging
I've added detailed logging to track the mint process:

### Step 1 Logs:
- `[STEP1_HANDLER]` - Validation and swap process
- `[STEP1]` - Raydium swap details

### Step 2 Logs:
- `[STEP2_HANDLER]` - Validation and mint process
- `[STEP2_ALT]` - NFT minting details

### How to View:
1. **Open browser developer tools** (F12)
2. **Go to Console tab**
3. **Try minting** and watch the logs
4. **Look for error messages** or failed steps

## 🚨 Common Issues & Solutions

### 1. Insufficient SOL Balance
**Error**: "Need at least 0.04 SOL for transaction fees"
**Solution**: Add SOL to your wallet

### 2. Insufficient WHISKEY Balance
**Error**: "Need X WHISKEY to swap for minting"
**Solution**: Get more WHISKEY tokens

### 3. Collection Config Not Found
**Error**: "Collection config not found"
**Solution**: Collection may not be properly initialized on-chain

### 4. RPC Connection Issues
**Error**: "RPC connection issues"
**Solution**: Try refreshing the page or switching networks

### 5. Wallet NFT Limit Reached
**Error**: "Wallet NFT limit reached"
**Solution**: You already have 5 NFTs from this collection

## 🔧 Advanced Debugging

### Check Transaction Simulation:
The debug panel tests if transactions can be built without sending them. If this fails, there's a fundamental issue with the transaction structure.

### Monitor Network Status:
- Check Solana network status
- Verify RPC endpoint is responding
- Look for network congestion

### Account Verification:
- Ensure collection config account exists
- Verify treasury and vault accounts are properly set up
- Check token accounts are created

## 📞 Getting Help

If the debug tools don't reveal the issue:

1. **Run the debug panel** and note all results
2. **Check console logs** during failed mint attempts
3. **Take screenshots** of error messages
4. **Note your wallet address** and collection name
5. **Share the debug data** for further analysis

## 🎯 Quick Checklist

Before minting, verify:
- [ ] Wallet is connected
- [ ] You have enough SOL (≥0.04)
- [ ] You have enough WHISKEY tokens
- [ ] Collection is not sold out
- [ ] You haven't reached NFT limit (5 max)
- [ ] RPC connection is healthy
- [ ] Collection config exists on-chain

## 🔄 Retry Process

If minting fails:
1. **Check debug panel** for specific issues
2. **Fix any balance/account issues**
3. **Wait a few minutes** for network stability
4. **Try again** with fresh transaction
5. **Use debug panel** to verify readiness

The debug tools should help identify exactly what's preventing the regular mint transaction from working.
