# Liquidation Bot Deployment Guide

## Overview
The liquidation bot monitors all active loans and automatically burns NFT collateral when loans expire past their grace period.

## Deployment Options

### 1. **Always Running (Recommended for Production)**
```bash
# Run continuously with 5-minute intervals
cd /home/arucard/WhiskeyPlanetNfts/solana_program
export NEXT_PUBLIC_LENDING_PROGRAM_ID=4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6
export SOLANA_RPC_URL=https://api.devnet.solana.com
node bots/liquidation-bot-test.js
```

**Characteristics:**
- ✅ Monitors loans 24/7
- ✅ 1-minute check intervals (configurable)
- ✅ Automatic liquidation of expired loans
- ✅ Graceful shutdown with Ctrl+C
- ⚠️ Requires server/VPS to keep running

### 2. **Process Manager (PM2) - Best for Production**
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot with PM2
cd /home/arucard/WhiskeyPlanetNfts/solana_program
pm2 start bots/liquidation-bot-test.js --name "liquidation-bot" --env production

# Monitor the bot
pm2 status
pm2 logs liquidation-bot
pm2 restart liquidation-bot
pm2 stop liquidation-bot
```

**Benefits:**
- ✅ Auto-restart if bot crashes
- ✅ Runs in background
- ✅ Logs management
- ✅ Easy start/stop/restart

### 3. **Systemd Service (Linux)**
Create a systemd service for automatic startup:

```bash
# Create service file
sudo nano /etc/systemd/system/liquidation-bot.service
```

```ini
[Unit]
Description=Liquidation Bot for Planet Whiskey NFTs
After=network.target

[Service]
Type=simple
User=arucard
WorkingDirectory=/home/arucard/WhiskeyPlanetNfts/solana_program
Environment=NEXT_PUBLIC_LENDING_PROGRAM_ID=4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6
Environment=SOLANA_RPC_URL=https://api.devnet.solana.com
ExecStart=/usr/bin/node bots/liquidation-bot-test.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable liquidation-bot
sudo systemctl start liquidation-bot
sudo systemctl status liquidation-bot
```

### 4. **Cron Job (Periodic Checks)**
For less frequent monitoring:

```bash
# Edit crontab
crontab -e

# Add line to run every 10 minutes
*/10 * * * * cd /home/arucard/WhiskeyPlanetNfts/solana_program && /usr/bin/node bots/liquidation-bot-test.js --once >> /var/log/liquidation-bot.log 2>&1
```

**Characteristics:**
- ✅ Lower resource usage
- ✅ Runs only when needed
- ⚠️ Less responsive (10-minute delays)

## Configuration Options

### Monitoring Intervals
You can adjust the monitoring frequency by modifying the bot:

```javascript
// In liquidation-bot-test.js, line 280
await bot.start(5); // 5-minute intervals (default)
await bot.start(1); // 1-minute intervals (more responsive)
await bot.start(10); // 10-minute intervals (less resource usage)
```

### Balance Monitoring
The bot automatically checks the liquidation wallet balance:
- ✅ Warns if balance < 0.1 SOL
- ✅ Displays current balance on each run
- ⚠️ Ensure wallet has sufficient SOL for transactions

## Security Considerations

### Liquidation Keypair Security
- 🔐 Store `liquidation-keypair.json` securely
- 🔐 Restrict file permissions: `chmod 600 liquidation-keypair.json`
- 🔐 Regular backup of keypair file
- 🔐 Monitor wallet balance regularly

### RPC Endpoint
- 🌐 Use reliable RPC endpoint (Helius, QuickNode, etc.)
- 🌐 Have backup RPC endpoints
- 🌐 Monitor RPC rate limits

## Monitoring & Alerts

### Log Monitoring
```bash
# Real-time logs with PM2
pm2 logs liquidation-bot --lines 100

# Check for errors
pm2 logs liquidation-bot | grep "ERROR\|❌"
```

### Health Checks
Create a health check script:

```bash
#!/bin/bash
# health-check.sh
RESPONSE=$(curl -s http://localhost:3000/api/health || echo "FAILED")
if [[ "$RESPONSE" == "FAILED" ]]; then
    echo "Bot is down, restarting..."
    pm2 restart liquidation-bot
fi
```

## Testing

### Manual Testing
```bash
# Test once
node bots/liquidation-bot-test.js --once

# Test with specific environment
SOLANA_RPC_URL=https://api.devnet.solana.com node bots/liquidation-bot-test.js --once
```

### Dry Run Mode
You could modify the bot to add a dry-run mode that logs what it would do without actually liquidating:

```javascript
// Add to constructor
this.dryRun = process.env.DRY_RUN === 'true';

// In liquidateExpiredLoan method
if (this.dryRun) {
  console.log('🧪 DRY RUN: Would liquidate loan:', loanInfo.publicKey.toString());
  return;
}
```

## Recommended Production Setup

For production, I recommend:

1. **PM2 Process Manager** for reliability
2. **5-minute intervals** for good responsiveness
3. **Dedicated server/VPS** for 24/7 operation
4. **Multiple RPC endpoints** for redundancy
5. **Monitoring alerts** for failures
6. **Regular balance checks** for liquidation wallet

Would you like me to help you set up any of these deployment options?
