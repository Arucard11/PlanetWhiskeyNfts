# 🚀 COMPLETE MAINNET DEPLOYMENT GUIDE

This guide provides step-by-step instructions for deploying the entire Planet Whiskey NFT ecosystem to Solana mainnet.

## ⚠️ CRITICAL WARNINGS

- **MAINNET = REAL MONEY**: All operations use real SOL and tokens
- **IRREVERSIBLE**: Mainnet transactions cannot be undone
- **SECURITY**: Keep all keypairs secure and never share private keys
- **TESTING**: Thoroughly test on devnet before mainnet deployment

## 📋 Prerequisites

### Required Tools
- Solana CLI (latest version)
- Anchor CLI (0.31.1+)
- Node.js (18+)
- Git
- Text editor

### Required Funds
- **Minimum 10 SOL** for deployment and account initialization
- **Additional USDC** for initial liquidity (recommended: 10,000+ USDC)
- **WHISKEY tokens** for testing swaps

### Required Information
- **USDC Mint**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **WHISKEY Mint**: `9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph`
- **RPC URL**: `https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90`
- **Admin Wallet**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`

## 🔧 Phase 1: Environment Setup

### Step 1: Configure Solana CLI
```bash
# Set Solana CLI to mainnet
solana config set --url https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90

# Verify configuration
solana config get

# Create deployment keypair (if not exists)
solana-keygen new --outfile ~/.config/solana/mainnet-deploy-keypair.json

# Check balance (should have 10+ SOL)
solana balance
```

### Step 2: Verify Repository
```bash
# Clone and navigate to repository
git clone <repository-url>
cd WhiskeyPlanetNfts/solana_program

# Verify all files are present
ls -la programs/
ls -la scripts/
```

### Step 3: Update Configuration Files
All configuration files have been pre-configured with mainnet addresses:
- ✅ `programs/solana_program/src/lib.rs` - Updated with mainnet token mints
- ✅ `programs/lendingprogram/src/lib.rs` - Updated with mainnet addresses  
- ✅ `programs/marketplaceprogram/src/lib.rs` - Updated with mainnet addresses
- ✅ `Anchor.toml` - Configured for mainnet deployment

## 🚀 Phase 2: Program Deployment

### Step 4: Build Programs
```bash
# Build all programs
anchor build

# Verify build artifacts
ls -la target/deploy/
```

### Step 5: Deploy Programs
```bash
# Run the automated deployment script
chmod +x scripts/mainnet-deployment.js
node scripts/mainnet-deployment.js
```

**OR deploy manually:**
```bash
# Deploy Whiskey Program
solana program deploy target/deploy/whiskeyprogram.so

# Deploy Marketplace Program  
solana program deploy target/deploy/marketplaceprogram.so

# Deploy Lending Program
solana program deploy target/deploy/lendingprogram.so
```

### Step 6: Record Program IDs
After deployment, update these files with the new Program IDs:
- `Anchor.toml` - [programs.mainnet] section
- `mainnet-environment.env` - NEXT_PUBLIC_*_PROGRAM_ID variables
- Frontend `env.mainnet` file

## 🏗️ Phase 3: Account Initialization

### Step 7: Initialize Core Accounts
```bash
# Run the automated account initialization script
chmod +x scripts/mainnet-initialize-accounts.js
node scripts/mainnet-initialize-accounts.js
```

This script initializes:
- ✅ Collection Registry V2
- ✅ Capital Vault (USDC)
- ✅ Global Market
- ✅ Lending Pool Config
- ✅ WHISKEY Vault
- ✅ USDC Vault

### Step 8: Fund Capital Vault
```bash
# Transfer initial USDC liquidity to capital vault
# This requires manual transaction - see lending admin panel
```

### Step 9: Configure NFT Collections
```bash
# Add approved NFT collections to registry
# Use the lending admin panel or create a script
```

## 🌐 Phase 4: Frontend Deployment

### Step 10: Configure Frontend Environment
```bash
cd ../planet-whiskey-nfts

# Copy mainnet environment file
cp env.mainnet .env.local

# Update with actual deployed Program IDs and PDAs
# (These will be automatically updated by the scripts)
```

### Step 11: Build and Deploy Frontend
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test locally first
npm run start

# Deploy to your hosting provider (Vercel, Netlify, etc.)
```

## 🤖 Phase 5: Bot Deployment

### Step 12: Deploy Liquidation Bot
```bash
# Copy liquidation keypair to bot server
scp scripts/liquidation-keypair.json user@bot-server:/path/to/bot/

# On bot server:
npm run bot-only
```

## 🔍 Phase 6: Verification & Testing

### Step 13: Verify All Components
```bash
# Check program deployments
solana program show <PROGRAM_ID>

# Check account initialization
solana account <ACCOUNT_ADDRESS>

# Test frontend functionality
curl https://your-domain.com/api/health
```

### Step 14: Test Core Functionality
1. **Minting**: Test NFT minting with Jupiter swap
2. **Marketplace**: Test listing/buying NFTs
3. **Lending**: Test deposit/borrow/repay cycle
4. **Liquidation**: Test bot liquidation process

## 📊 Deployed Addresses Reference

### Token Mints
- **USDC**: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- **WHISKEY**: `9UNqoPEXXxEnEphmyYsZYdL5dnmAUtdiKRUchpnUF5Ph`

### Program IDs (Update after deployment)
- **Whiskey Program**: `Y5ZTxmgfR51njNPjHRm9WYzbmvoG4uptaQnHupdKbFM`
- **Marketplace Program**: `E9rdfVCukatP1LxyMun3mnw28pprwpTJtzkqtw1YVQ7n`
- **Lending Program**: `4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6`

### Key Wallets
- **Admin**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`
- **Treasury**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`
- **Liquidation Authority**: `2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk`

### Jupiter Integration
- **Jupiter Program**: `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`
- **Swap Feature**: Enabled in whiskey program with atomic CPI calls

## 🔧 Jupiter CPI Implementation

The whiskey program includes a complete Jupiter V6 CPI implementation for atomic WHISKEY → USDC swaps during NFT minting:

### Features
- ✅ Real Jupiter V6 program integration
- ✅ Atomic swap execution via CPI
- ✅ Slippage protection (1% default)
- ✅ Route plan support for optimal pricing
- ✅ Error handling and fallbacks
- ✅ Mainnet-ready configuration

### How It Works
1. User pays WHISKEY tokens to mint NFT
2. 80% of WHISKEY goes to lending pool
3. Lending pool automatically swaps WHISKEY → USDC via Jupiter
4. USDC is deposited into capital vault for lending
5. 20% of WHISKEY goes to treasury

## 🚨 Security Checklist

### Pre-Deployment
- [ ] All private keys secured
- [ ] Environment variables reviewed
- [ ] Program code audited
- [ ] Test transactions executed on devnet
- [ ] Backup procedures in place

### Post-Deployment
- [ ] Program IDs verified
- [ ] Account initializations confirmed
- [ ] Initial funding completed
- [ ] Frontend functionality tested
- [ ] Bot monitoring active
- [ ] Error logging configured

## 📈 Monitoring & Maintenance

### Key Metrics to Monitor
- Capital vault liquidity levels
- Active loans and collateral ratios
- Jupiter swap success rates
- Bot liquidation performance
- Frontend error rates

### Regular Tasks
- Monitor and refill capital vault liquidity
- Update NFT collection values
- Review and adjust lending parameters
- Monitor bot performance and logs
- Security updates and patches

## 🆘 Troubleshooting

### Common Issues

**Program Deployment Fails**
- Check SOL balance (need 2-5 SOL per program)
- Verify RPC endpoint connectivity
- Ensure programs build successfully

**Account Initialization Fails**
- Verify program IDs are correct
- Check admin keypair permissions
- Ensure sufficient SOL for rent

**Jupiter Swaps Fail**
- Verify Jupiter program ID is correct
- Check WHISKEY/USDC mint addresses
- Ensure sufficient liquidity exists

**Frontend Issues**
- Verify all environment variables are set
- Check RPC endpoint accessibility
- Confirm program IDs match deployed versions

### Emergency Procedures
1. **Program Issues**: Use upgrade authority to fix critical bugs
2. **Liquidity Crisis**: Emergency funding procedures
3. **Security Breach**: Immediate account freezing procedures
4. **Bot Failure**: Manual liquidation procedures

## 📞 Support

For deployment issues or questions:
- Check logs first: `solana logs` 
- Review transaction details on Solana Explorer
- Consult Solana and Anchor documentation
- Review Jupiter integration docs

---

**🎉 Congratulations on your mainnet deployment!**

Remember: Mainnet is live with real value. Monitor closely and maintain security best practices.
