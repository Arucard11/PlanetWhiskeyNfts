#!/usr/bin/env node

// Start both Next.js and the liquidation bot concurrently
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Planet Whiskey NFTs with Liquidation Bot...');

// Start Next.js development server
console.log('🌐 Starting Next.js development server...');
const nextProcess = spawn('npm', ['run', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env
});

// Start liquidation bot
console.log('🤖 Starting liquidation bot...');
const botProcess = spawn('node', ['scripts/liquidation-bot.cjs'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env
});

// Handle Next.js output
nextProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log(`[NEXT] ${output}`);
  }
});

nextProcess.stderr.on('data', (data) => {
  const error = data.toString().trim();
  if (error && !error.includes('DeprecationWarning')) {
    console.error(`[NEXT ERROR] ${error}`);
  }
});

// Handle liquidation bot output
botProcess.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output) {
    console.log(`[BOT] ${output}`);
  }
});

botProcess.stderr.on('data', (data) => {
  const error = data.toString().trim();
  if (error && !error.includes('DeprecationWarning')) {
    console.error(`[BOT ERROR] ${error}`);
  }
});

// Handle process exits
nextProcess.on('exit', (code, signal) => {
  console.log(`[NEXT] Process exited with code ${code}, signal ${signal}`);
  if (code !== 0) {
    console.log('🛑 Stopping liquidation bot due to Next.js exit...');
    botProcess.kill();
  }
});

botProcess.on('exit', (code, signal) => {
  console.log(`[BOT] Process exited with code ${code}, signal ${signal}`);
  if (code !== 0) {
    console.log('⚠️ Liquidation bot crashed, but Next.js will continue running...');
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  nextProcess.kill('SIGINT');
  botProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  nextProcess.kill('SIGTERM');
  botProcess.kill('SIGTERM');
  process.exit(0);
});

console.log('✅ Both processes started successfully!');
console.log('   - Next.js: http://localhost:3000');
console.log('   - Liquidation Bot: Running in background');
console.log('   - Press Ctrl+C to stop both processes');
