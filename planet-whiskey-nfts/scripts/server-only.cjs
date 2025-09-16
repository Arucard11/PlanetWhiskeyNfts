#!/usr/bin/env node

/**
 * Next.js Server Only - Standalone Script
 * 
 * This script runs ONLY the Next.js server without the liquidation bot
 * Perfect for running the web application on a separate server
 */

const { spawn } = require('child_process');

console.log('🌐 Starting Next.js Server (Standalone Mode)');
console.log('📍 Current directory:', process.cwd());
console.log('⏰ Started at:', new Date().toISOString());

// Determine if we're in development or production
const isDevelopment = process.env.NODE_ENV !== 'production';
const command = isDevelopment ? 'dev' : 'start';

console.log('🔧 Environment:', isDevelopment ? 'Development' : 'Production');
console.log('🚀 Running command:', `npm run ${command}`);

// Start Next.js server
const serverProcess = spawn('npm', ['run', command], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
  shell: true
});

// Handle server process events
serverProcess.on('spawn', () => {
  console.log('✅ Next.js server process started successfully');
  console.log('🆔 Server PID:', serverProcess.pid);
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start Next.js server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  console.log(`🛑 Next.js server exited with code ${code} and signal ${signal}`);
  process.exit(code || 0);
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down Next.js server...');
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!serverProcess.killed) {
        console.log('⚡ Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down Next.js server...');
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM');
  }
  process.exit(0);
});

console.log('🚀 Next.js Server Manager is running...');
console.log('💡 Press Ctrl+C to stop the server');

if (isDevelopment) {
  console.log('🔧 Development server will be available at http://localhost:3000');
} else {
  console.log('🏭 Production server starting...');
}
