#!/usr/bin/env node

/**
 * Liquidation Bot Only - Standalone Script
 * 
 * This script runs ONLY the liquidation bot without Next.js
 * Perfect for running on a separate server or instance
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🤖 Starting Liquidation Bot (Standalone Mode)');
console.log('📍 Current directory:', process.cwd());
console.log('⏰ Started at:', new Date().toISOString());

// Path to the liquidation bot script
const botScriptPath = path.join(__dirname, 'liquidation-bot.cjs');

console.log('🔧 Bot script path:', botScriptPath);

// Start the liquidation bot
const botProcess = spawn('node', [botScriptPath], {
  stdio: 'inherit', // This will show all bot output in the console
  env: process.env,
  cwd: process.cwd()
});

// Handle bot process events
botProcess.on('spawn', () => {
  console.log('✅ Liquidation bot process started successfully');
  console.log('🆔 Bot PID:', botProcess.pid);
});

botProcess.on('error', (error) => {
  console.error('❌ Failed to start liquidation bot:', error);
  process.exit(1);
});

botProcess.on('exit', (code, signal) => {
  console.log(`🛑 Liquidation bot exited with code ${code} and signal ${signal}`);
  
  if (code !== 0) {
    console.log('⚠️  Bot exited with error, restarting in 10 seconds...');
    setTimeout(() => {
      console.log('🔄 Restarting liquidation bot...');
      // Restart by running this script again
      const restartProcess = spawn('node', [__filename], {
        stdio: 'inherit',
        env: process.env,
        cwd: process.cwd(),
        detached: true
      });
      restartProcess.unref();
      process.exit(0);
    }, 10000);
  }
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down liquidation bot...');
  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!botProcess.killed) {
        console.log('⚡ Force killing bot process...');
        botProcess.kill('SIGKILL');
      }
    }, 5000);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down liquidation bot...');
  if (botProcess && !botProcess.killed) {
    botProcess.kill('SIGTERM');
  }
  process.exit(0);
});

console.log('🚀 Liquidation Bot Manager is running...');
console.log('💡 Press Ctrl+C to stop the bot');
console.log('📊 Bot will check for expired loans every 5 minutes');
console.log('🔄 Bot will auto-restart if it crashes');
