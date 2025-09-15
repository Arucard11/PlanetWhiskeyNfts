#!/bin/bash

# Simple script to run Next.js and Liquidation Bot in separate terminals
# This avoids the complex process management issues we had before

echo "🚀 Starting Planet Whiskey NFTs with Liquidation Bot..."
echo ""
echo "This will start two processes:"
echo "1. Next.js development server (port 3000)"
echo "2. Liquidation bot (checks every 5 minutes)"
echo ""

# Start Next.js in the background
echo "🌐 Starting Next.js development server..."
npm run dev &
NEXT_PID=$!

# Wait a moment for Next.js to start
sleep 3

# Start liquidation bot in the background
echo "🤖 Starting liquidation bot..."
npm run liquidation-bot &
BOT_PID=$!

echo ""
echo "✅ Both processes started successfully!"
echo "   - Next.js (PID: $NEXT_PID): http://localhost:3000"
echo "   - Liquidation Bot (PID: $BOT_PID): Checking every 5 minutes"
echo ""
echo "📋 To monitor:"
echo "   - View Next.js logs: tail -f /proc/$NEXT_PID/fd/1"
echo "   - View bot logs: tail -f /proc/$BOT_PID/fd/1"
echo ""
echo "🛑 To stop both processes:"
echo "   - Press Ctrl+C or run: kill $NEXT_PID $BOT_PID"
echo ""

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Stopping all processes..."
    kill $NEXT_PID 2>/dev/null
    kill $BOT_PID 2>/dev/null
    echo "✅ All processes stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep the script running and wait for user to stop
echo "Press Ctrl+C to stop both processes..."
wait
