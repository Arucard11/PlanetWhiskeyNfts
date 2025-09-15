# 🚀 Mainnet Deployment Guide - Planet Whiskey NFTs

## 📋 Pre-Deployment Checklist

### ✅ Jupiter Integration Status
- [x] Jupiter CPI implementation completed
- [x] Manual CPI approach to avoid dependency conflicts
- [x] Environment-aware execution (devnet vs mainnet)
- [x] Build scripts for both environments
- [x] Real USDC mint addresses configured

### ✅ Program Verification
- [x] All programs build successfully
- [x] Devnet build tested
- [x] Mainnet build tested
- [x] No dependency conflicts

## 🔧 Environment Setup

### 1. Create Mainnet Environment File

Create `mainnet-environment.env`:

```bash
# Mainnet Environment Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet

# Mainnet Token Addresses
NEXT_PUBLIC_WHISKEY_TOKEN_MINT=<YOUR_MAINNET_WHISKEY_MINT>
NEXT_PUBLIC_USDC_TOKEN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
NEXT_PUBLIC_ADMIN_WALLET=<YOUR_MAINNET_ADMIN_WALLET>
NEXT_PUBLIC_TREASURY_WALLET=<YOUR_MAINNET_TREASURY_WALLET>
NEXT_PUBLIC_LIQUIDATION_AUTHORITY=<YOUR_MAINNET_LIQUIDATION_AUTHORITY>

# Mainnet Program IDs (will be generated during deployment)
NEXT_PUBLIC_LENDING_PROGRAM_ID=<TO_BE_DEPLOYED>
NEXT_PUBLIC_WHISKEY_PROGRAM_ID=<TO_BE_DEPLOYED>
NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID=<TO_BE_DEPLOYED>

# Jupiter Configuration
JUPITER_PROGRAM_ID=JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4

# Database (use production MongoDB)
MONGODB_URI=<YOUR_PRODUCTION_MONGODB_URI>

# API Keys (production)
PINATA_API_KEY=<YOUR_PRODUCTION_PINATA_KEY>
PINATA_SECRET_API_KEY=<YOUR_PRODUCTION_PINATA_SECRET>
NEXT_COINGECKO_API_KEY=<YOUR_PRODUCTION_COINGECKO_KEY>
```

### 2. Mainnet Wallet Setup

```bash
# Create mainnet admin wallet (if not exists)
solana-keygen new --outfile ~/.config/solana/mainnet-admin-keypair.json

# Create mainnet liquidation authority
solana-keygen new --outfile ~/.config/solana/mainnet-liquidation-keypair.json

# Set Solana CLI to mainnet
solana config set --url https://api.mainnet-beta.solana.com
solana config set --keypair ~/.config/solana/mainnet-admin-keypair.json
```

## 🏗️ Deployment Steps

### Step 1: Build for Mainnet

```bash
cd solana_program
./build-mainnet.sh
```

### Step 2: Deploy Programs

```bash
# Deploy all programs to mainnet
anchor deploy --provider.cluster mainnet

# Note the deployed program IDs and update your environment file
```

### Step 3: Create Mainnet Tokens

```bash
# Create WHISKEY token on mainnet
spl-token create-token --decimals 6

# Create initial supply (adjust amount as needed)
spl-token mint <WHISKEY_TOKEN_MINT> 1000000000 # 1B tokens with 6 decimals

# Update NEXT_PUBLIC_WHISKEY_TOKEN_MINT in environment
```

### Step 4: Initialize Programs

```bash
# Source mainnet environment
source mainnet-environment.env

# Initialize global market (lending program)
node scripts/complete-system-initialization.js

# Initialize lending pool (whiskey program)
# (Run appropriate initialization scripts)
```

### Step 5: Configure Collections

```bash
# Add your NFT collections to the lending registry
# Set appropriate USD values for each collection
# Enable collections for lending collateral
```

## 🧪 Testing Strategy

### Phase 1: Smoke Tests
1. Deploy to mainnet with minimal amounts
2. Test basic NFT minting (small quantities)
3. Verify Jupiter swap integration
4. Test lending with small amounts

### Phase 2: Jupiter Swap Verification
1. Mint NFT with small WHISKEY amount
2. Verify WHISKEY → USDC swap occurs
3. Check swap ratios and slippage
4. Monitor transaction costs

### Phase 3: Lending System Tests
1. Deposit small-value NFT as collateral
2. Take small loan
3. Repay loan
4. Withdraw NFT
5. Test liquidation bot

### Phase 4: Integration Tests
1. Full user flow testing
2. Marketplace transactions
3. Multi-user scenarios
4. Edge case handling

## 🔒 Security Considerations

### Critical Verifications
- [ ] All token mint addresses are correct
- [ ] Jupiter program ID is official
- [ ] Admin wallet is secure and backed up
- [ ] Liquidation authority is properly configured
- [ ] All program IDs match deployed versions

### Monitoring Setup
- [ ] Transaction monitoring alerts
- [ ] Balance monitoring for key accounts
- [ ] Error logging and alerting
- [ ] Jupiter swap success/failure tracking

## 📊 Jupiter Integration Details

### How It Works
1. **Environment Detection**: Program detects mainnet vs devnet via feature flags
2. **Automatic Swaps**: 80% of mint revenue automatically swaps WHISKEY → USDC
3. **Manual CPI**: Uses manual CPI to avoid dependency conflicts
4. **Slippage Protection**: 1% slippage tolerance with conservative estimates

### Jupiter Configuration
- **Program ID**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- **Swap Route**: WHISKEY → USDC (direct or via SOL)
- **Platform Fee**: 0.5% (50 basis points)
- **Slippage**: 1% (100 basis points)

### Swap Process
1. User mints NFT with WHISKEY tokens
2. 80% of WHISKEY goes to lending pool
3. Program automatically swaps WHISKEY → USDC via Jupiter
4. USDC stays in lending pool for loans
5. 20% WHISKEY goes to treasury (no swap)

## 🚨 Emergency Procedures

### If Jupiter Swap Fails
1. Check Jupiter program status
2. Verify token mint addresses
3. Check account balances and permissions
4. Review slippage settings
5. Consider manual intervention

### If Deployment Issues
1. Verify program build with mainnet features
2. Check Solana CLI configuration
3. Ensure sufficient SOL for deployment
4. Verify anchor configuration

### Rollback Plan
1. Keep devnet version running
2. Document all mainnet changes
3. Have quick rollback scripts ready
4. Monitor first 24 hours closely

## 📈 Post-Deployment Monitoring

### Key Metrics to Track
- Jupiter swap success rate
- Average swap slippage
- Transaction costs
- User adoption
- Lending utilization
- Liquidation events

### Alerts to Set Up
- Failed Jupiter swaps
- High slippage events
- Unusual lending activity
- Low liquidation wallet balance
- Program errors

## 🔄 Maintenance

### Regular Tasks
- Monitor Jupiter swap performance
- Update token prices if needed
- Manage liquidation wallet balance
- Review and update slippage tolerances
- Monitor for Jupiter program updates

### Upgrades
- Test all upgrades on devnet first
- Use program upgrade authority carefully
- Coordinate with Jupiter for major updates
- Maintain backward compatibility

---

## 🎯 Success Criteria

- [ ] All programs deployed successfully
- [ ] Jupiter swaps working correctly
- [ ] NFT minting with automatic WHISKEY→USDC conversion
- [ ] Lending system operational
- [ ] Liquidation bot running
- [ ] Marketplace functional
- [ ] All monitoring in place

## 📞 Support Contacts

- **Jupiter Support**: [Jupiter Discord](https://discord.gg/jup)
- **Solana Support**: [Solana Discord](https://discord.gg/solana)
- **Metaplex Support**: [Metaplex Discord](https://discord.gg/metaplex)

---

**⚠️ REMEMBER**: Start with small amounts, monitor closely, and have rollback plans ready!
