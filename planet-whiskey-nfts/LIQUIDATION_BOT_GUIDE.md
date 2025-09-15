# 🤖 Liquidation Bot Guide

The liquidation bot monitors expired loans and automatically liquidates them by burning the collateral NFTs.

## ✅ **Fixed Issues**

- **Timing Issue**: Bot now properly runs every 5 minutes instead of every second
- **Process Management**: Simplified startup to avoid runaway processes
- **Stability**: Added proper error handling and graceful shutdown

## 🚀 **How to Run**

### Option 1: Run Both Services Together (Recommended)
```bash
./run-with-liquidation-bot.sh
```

### Option 2: Run Separately
```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start liquidation bot
npm run liquidation-bot
```

### Option 3: Test Bot Once
```bash
npm run liquidation-bot -- --once
```

## 📊 **Bot Status**

When running, the bot will show:
- ✅ **Current time** and **next check time** (5 minutes later)
- ✅ **Process ID** for identification
- ✅ **Wallet balance** check
- ✅ **Loan scanning** results
- ✅ **Liquidation actions** (if any expired loans found)

## 🔧 **Configuration**

The bot runs with these settings:
- **Interval**: 5 minutes (300,000ms)
- **RPC**: Devnet Solana RPC
- **Authority**: Uses liquidation keypair from `scripts/liquidation-keypair.json`
- **Program**: Lending program ID from environment

## 📝 **Logs**

The bot provides detailed logging:
```
🚀 Starting Liquidation Bot (PID: 12345) at 2025-09-15T07:45:02.239Z
📍 Current time: 2025-09-15T07:45:02.276Z
⏰ Next check will be at: 2025-09-15T07:50:02.276Z
💰 Liquidation wallet balance: 1.1000 SOL
🔍 Scanning for expired loans...
✅ No expired loans found - all loans are healthy
```

## 🛑 **Stopping the Bot**

- Press `Ctrl+C` in the terminal
- Bot will gracefully shut down and clean up resources

## 🔍 **Monitoring**

- Bot logs show exactly when the next check will occur
- Process ID is displayed for system monitoring
- Each check shows current wallet balance and loan status
