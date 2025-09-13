# NFT Liquidation System

This document explains the new simplified NFT liquidation system that replaces the old auction-based liquidation.

## How It Works

### 🕐 **Loan Timeline**
1. **Loan Period**: User has 1, 2, or 3 months to repay their loan
2. **Grace Period**: Additional 2 days after loan expiration
3. **Liquidation**: After grace period expires, NFT can be burned as penalty

### 🔥 **NFT Burning Process**
When a loan expires (after grace period):
- The collateral NFT is permanently burned
- No auction system - immediate destruction
- Borrower loses their NFT as penalty for defaulting

### ⚠️ **UI Warning System**
The frontend now shows progressive warnings:
- **🟢 Safe**: More than 7 days remaining
- **🟡 Warning**: 3-7 days remaining  
- **🟠 Urgent**: 1-3 days remaining
- **🔴 Critical**: Less than 1 day remaining
- **🚨 Expired**: Loan has expired, NFT at risk of burning

## Technical Implementation

### Smart Contract Changes
- Removed `NftAuction` account structure
- Removed `AuctionStatus` enum
- Removed `LiquidationReason` enum
- Added `liquidate_expired_loan` instruction
- Simplified liquidation to direct NFT burning

### Frontend Changes
- Updated `my-loans` page with urgency status indicators
- Removed liquidation button from user interface
- Added dual payment breakdown (USDC + WHISKEY)
- Enhanced loan countdown display

### Backend API
- **New**: `/api/lending/liquidate-loan.ts` - Admin-only liquidation endpoint
- **Updated**: `/api/lending/repay-loan.ts` - Fixed dual payment system

### Automated Liquidation
- **Liquidation Bot**: `solana_program/bots/liquidation-bot.ts`
- Automatically scans for expired loans every 5 minutes
- Burns NFTs from defaulted loans
- Admin-operated for security

## Running the Liquidation Bot

```bash
# Navigate to the bots directory
cd solana_program/bots

# Install dependencies (if needed)
npm install

# Set environment variables
export SOLANA_RPC_URL="https://api.devnet.solana.com"
export NEXT_PUBLIC_LENDING_PROGRAM_ID="your_program_id"

# Run the bot
ts-node liquidation-bot.ts
```

## Security Features

1. **Admin-Only Liquidation**: Only admin wallet can trigger liquidations
2. **Grace Period**: 2-day buffer before liquidation is possible  
3. **Automatic Scanning**: Bot continuously monitors for expired loans
4. **Permanent Burning**: No recovery possible once NFT is burned

## User Experience

### Before Expiration
- Clear countdown timers
- Progressive warning colors
- Dual payment breakdown showing exact amounts needed

### After Expiration  
- No user-initiated liquidation
- Admin/bot handles liquidation automatically
- NFT is permanently destroyed as penalty

## Benefits of New System

1. **Simplified**: No complex auction mechanics
2. **Immediate**: No waiting for auction periods
3. **Clear Consequences**: Users know NFT will be burned if they don't repay
4. **Automated**: Reduces manual intervention needed
5. **Gas Efficient**: Single transaction to burn NFT

## Migration Notes

- Old auction-related code has been removed
- Users can no longer trigger their own liquidations
- All liquidations are now admin-controlled
- NFT burning is irreversible - no recovery mechanism

## Monitoring

The liquidation bot provides detailed logging:
- Scans for expired loans every 5 minutes
- Reports found expired loans
- Logs successful liquidations
- Warns about low admin wallet balance
- Graceful shutdown on SIGINT/SIGTERM
