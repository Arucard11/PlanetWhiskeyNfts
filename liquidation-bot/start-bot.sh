#!/bin/bash

# Planet Whiskey Liquidation Bot Startup Script

echo "🤖 Starting Planet Whiskey Liquidation Bot..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📋 Please copy .env.example to .env and configure your settings:"
    echo "   cp .env.example .env"
    echo "   # Edit .env with your configuration"
    exit 1
fi

# Check if keypair exists
if [ ! -f keypairs/mainnet-liquidation-keypair.json ]; then
    echo "❌ Liquidation keypair not found!"
    echo "📋 Please ensure keypairs/mainnet-liquidation-keypair.json exists"
    exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the bot
echo "🚀 Starting liquidation bot..."
npm start
