# Separate Server Deployment Guide

This guide explains how to run the Next.js web server and the liquidation bot on separate servers or instances.

## Overview

Instead of running both the web application and the liquidation bot together, you can now run them independently:

- **Server 1**: Next.js web application only
- **Server 2**: Liquidation bot only

## Server 1: Web Application Only

### Development Mode
```bash
npm run server-only
```

### Production Mode
```bash
# Build the application first
npm run build

# Set environment to production
export NODE_ENV=production

# Start the server
npm run server-only
```

### Alternative: Direct Next.js Commands
```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

## Server 2: Liquidation Bot Only

### Prerequisites
Make sure you have these files on the bot server:
- `scripts/liquidation-bot.cjs`
- `scripts/liquidation-keypair.json`
- `src/lib/idl/lendingprogram.json`
- `.env` or `.env.local` with all required environment variables

### Environment Variables Required for Bot
```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_LENDING_PROGRAM_ID=4WbpwjHn44TZmcd6m8Ee2hktgEgVNBx6imCqfjZyxNg6

# Optional: Bot configuration
BOT_CHECK_INTERVAL_MINUTES=5
```

### Run the Bot
```bash
npm run bot-only
```

### Alternative: Direct Bot Command
```bash
npm run liquidation-bot
```

## Features

### Bot-Only Script (`scripts/bot-only.cjs`)
- ✅ Runs only the liquidation bot
- ✅ Auto-restart on crash
- ✅ Graceful shutdown handling
- ✅ Detailed logging
- ✅ 5-minute check intervals
- ✅ Process management

### Server-Only Script (`scripts/server-only.cjs`)
- ✅ Runs only Next.js server
- ✅ Supports both dev and production modes
- ✅ Graceful shutdown handling
- ✅ Environment detection
- ✅ Clean process management

## Deployment Examples

### Using PM2 (Recommended for Production)

#### Server 1: Web Application
```bash
# Install PM2 globally
npm install -g pm2

# Start the web server
pm2 start npm --name "whiskey-web" -- run server-only

# Or for production
NODE_ENV=production pm2 start npm --name "whiskey-web" -- run start
```

#### Server 2: Liquidation Bot
```bash
# Start the bot
pm2 start npm --name "whiskey-bot" -- run bot-only

# Monitor logs
pm2 logs whiskey-bot
```

### Using Docker

#### Dockerfile for Web Server
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "server-only"]
```

#### Dockerfile for Bot
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY scripts/ ./scripts/
COPY src/lib/idl/ ./src/lib/idl/
COPY .env ./
CMD ["npm", "run", "bot-only"]
```

### Using systemd (Linux)

#### Web Server Service
```ini
# /etc/systemd/system/whiskey-web.service
[Unit]
Description=Whiskey NFT Web Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/planet-whiskey-nfts
ExecStart=/usr/bin/npm run server-only
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Bot Service
```ini
# /etc/systemd/system/whiskey-bot.service
[Unit]
Description=Whiskey NFT Liquidation Bot
After=network.target

[Service]
Type=simple
User=whiskey-bot
WorkingDirectory=/path/to/planet-whiskey-nfts
ExecStart=/usr/bin/npm run bot-only
Restart=always

[Install]
WantedBy=multi-user.target
```

## Monitoring

### Bot Logs
The bot provides detailed logging:
```
🤖 Starting Liquidation Bot (Standalone Mode)
📍 Current directory: /path/to/project
⏰ Started at: 2024-01-15T10:30:00.000Z
✅ Liquidation bot process started successfully
🆔 Bot PID: 12345
🚀 Liquidation Bot Manager is running...
💡 Press Ctrl+C to stop the bot
📊 Bot will check for expired loans every 5 minutes
🔄 Bot will auto-restart if it crashes
```

### Health Checks
You can check if processes are running:
```bash
# Check if bot is running
ps aux | grep liquidation-bot

# Check if web server is running
ps aux | grep next

# With PM2
pm2 status
```

## Troubleshooting

### Bot Issues
1. **Check environment variables** are set correctly
2. **Verify keypair file** exists and has correct permissions
3. **Check IDL file** is present and valid
4. **Monitor logs** for specific error messages

### Web Server Issues
1. **Check port availability** (default: 3000)
2. **Verify build completed** successfully
3. **Check database connection** if applicable
4. **Monitor Next.js logs** for errors

## Benefits of Separate Deployment

1. **Scalability**: Scale web server and bot independently
2. **Reliability**: If one fails, the other continues running
3. **Resource Management**: Allocate resources based on needs
4. **Maintenance**: Update/restart services independently
5. **Security**: Isolate bot credentials from web server
6. **Monitoring**: Separate logging and monitoring per service
