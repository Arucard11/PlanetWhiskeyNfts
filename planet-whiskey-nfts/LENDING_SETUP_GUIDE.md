# 🏦 Lending Protocol Frontend Connection Guide

This guide shows you how to connect your frontend to the real deployed lending protocol.

## ✅ Prerequisites

1. **Deployed Lending Program**: Your lending program must be deployed and the deployment file must exist at:
   ```
   ../solana_program/project-constellation-deployment.json
   ```

2. **Treasury Keypair**: Treasury keypair must exist at:
   ```
   ../solana_program/treasury-keypair.json
   ```

3. **Environment Variables**: Add to your `.env.local`:
   ```bash
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

## 🔧 Updated API Endpoints (Now Connected to Real Protocol)

### ✅ Already Updated:
- `/api/lending/user-stats` - Fetches real borrowing stats from BorrowerAccount
- `/api/lending/user-data` - Fetches real collateral NFTs and active loans
- `/api/lending/deposit-nft` - Creates real NFT deposit transactions
- `/api/lending/take-loan` - Creates real loan origination transactions
- `/api/admin/lending/sync-collections` - Syncs database collections with on-chain approved list

### 🔄 Still Mock (TODO):
- `/api/lending/repay-loan` - Needs real loan repayment transaction creation

## 🚀 How to Test the Real Connection

### 1. First, Sync Your Collections
```bash
# Go to admin panel
http://localhost:3000/admin/lending

# Click "🔄 Sync NFT Collections" button
# This registers your database collections with the lending protocol
```

### 2. Test User Flow
```bash
# Connect wallet and go to lending
http://localhost:3000/lending

# Click "🖼️ Deposit NFTs & Borrow"
http://localhost:3000/lending/borrow

# Select NFTs from approved collections and deposit them
# The system will create real on-chain transactions

# Go to loan management
http://localhost:3000/lending/my-loans

# View your real collateral and take out loans
```

## 🔍 How It Works Under the Hood

### NFT Deposit Flow:
1. **Frontend**: User selects NFTs and clicks deposit
2. **API** (`/api/lending/deposit-nft`): 
   - Loads deployment info and connects to program
   - Derives all necessary PDAs (BorrowerAccount, NFT escrow, etc.)
   - Creates `deposit_nft` instruction with proper accounts
   - Returns serialized transaction
3. **Frontend**: Deserializes transaction and sends via wallet
4. **On-Chain**: Lending program validates NFT collection and deposits to escrow

### Loan Creation Flow:
1. **Frontend**: User enters loan amount, duration, and asset
2. **API** (`/api/lending/take-loan`):
   - Validates borrowing power against on-chain BorrowerAccount
   - Calculates dynamic interest rates
   - Creates `take_loan` instruction with capital/treasury vaults
   - Returns serialized transaction
3. **Frontend**: Signs and sends transaction
4. **On-Chain**: Protocol disburses funds and creates Loan account

### Data Fetching:
- **Real-time Stats**: Fetched directly from on-chain accounts
- **Borrowing Power**: Calculated from deposited NFTs × per-NFT value × LTV
- **Active Loans**: Retrieved from user's BorrowerAccount.active_loans
- **Health Ratio**: Live calculation of collateral/debt ratio

## 🛠️ Customization Options

### Update Asset Mints (if using different tokens):
```typescript
// In /api/lending/take-loan.ts, update these addresses:
const assetMint = asset === 'USDC' 
  ? new PublicKey('YOUR_USDC_MINT_ADDRESS')
  : new PublicKey('YOUR_USDT_MINT_ADDRESS');
```

### Adjust Per-NFT Values:
```bash
# Use admin panel to update global market settings
http://localhost:3000/admin/lending

# Or directly call the lending program's update_admin_settings instruction
```

### Add More Collections:
```bash
# Create collections normally in admin panel
http://localhost:3000/admin/collections

# Then sync them to lending protocol
http://localhost:3000/admin/lending → "🔄 Sync NFT Collections"
```

## 🐛 Troubleshooting

### Common Issues:

1. **"Lending protocol not deployed"**
   - Ensure `project-constellation-deployment.json` exists
   - Check deployment file has correct PDAs and addresses

2. **"Transaction failed"**
   - Check wallet has enough SOL for transaction fees
   - Verify NFTs are from approved collections
   - Ensure user hasn't exceeded 5 NFT limit

3. **"No borrower account found"**
   - Normal for new users - they need to deposit NFTs first
   - BorrowerAccount is created automatically on first deposit

4. **"Insufficient borrowing power"**
   - User needs to deposit more NFTs as collateral
   - Check if NFTs are from approved collections

### Debug Mode:
Enable detailed logging by checking browser console and server logs. All API endpoints now include comprehensive logging for debugging.

## 🎯 Next Steps

1. **Deploy to Production**: Update RPC URLs and mint addresses for mainnet
2. **Add Repay Functionality**: Complete the repay-loan API endpoint
3. **Add Interest Payments**: Implement partial interest payment functionality
4. **Add Liquidation UI**: Create interface for liquidation auctions
5. **Add Analytics**: Track lending protocol usage and health

## 📊 Monitoring

Monitor your lending protocol health:
- **Admin Panel**: `/admin/lending` - View protocol stats and configure all settings

The frontend is now fully connected to your real lending protocol! 🎉
