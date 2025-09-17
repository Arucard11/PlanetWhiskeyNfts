// Liquidation Bot Manager - Auto-starts with the Next.js app
import { spawn, fork, ChildProcess } from 'child_process';
import path from 'path';

console.log('📦 Loading liquidation-bot-manager.ts module...');

class LiquidationBotManager {
  private botProcess: ChildProcess | null = null;
  private isRunning = false;
  private restartAttempts = 0;
  private maxRestartAttempts = 5;

  constructor() {
    // Auto-start bot when manager is initialized
    console.log('🤖 Initializing Liquidation Bot Manager...');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   AUTO_START_LIQUIDATION_BOT:', process.env.AUTO_START_LIQUIDATION_BOT);
    
    if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_LIQUIDATION_BOT === 'true') {
      console.log('🚀 Auto-starting liquidation bot...');
      this.start();
    } else {
      console.log('⏸️ Liquidation bot auto-start disabled');
    }
  }

  start() {
    if (this.isRunning) {
      console.log('🤖 Liquidation bot is already running');
      return;
    }

    try {
      console.log('🚀 Starting liquidation bot...');
      console.log('   Working Directory:', process.cwd());
      
      const botPath = path.join(process.cwd(), 'scripts/liquidation-bot-test.cjs');
      console.log('   Bot Script Path:', botPath);
      
      // Environment variables for the bot
      const env = {
        ...process.env,
        NEXT_PUBLIC_LENDING_PROGRAM_ID: process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID,
        SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      };

      // Fork the bot process (better for Node.js scripts)
      this.botProcess = fork(botPath, [], {
        env,
        cwd: process.cwd(),
        silent: true, // Capture stdout and stderr
      });

      this.isRunning = true;
      this.restartAttempts = 0;

      // Handle bot output
      this.botProcess.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`🤖 [LIQUIDATION BOT] ${output}`);
        }
      });

      this.botProcess.stderr?.on('data', (data) => {
        const error = data.toString().trim();
        if (error && !error.includes('DeprecationWarning')) {
          console.error(`🤖 [LIQUIDATION BOT ERROR] ${error}`);
        }
      });

      // Handle bot exit
      this.botProcess.on('exit', (code, signal) => {
        this.isRunning = false;
        this.botProcess = null;

        if (code === 0) {
          console.log('🤖 Liquidation bot stopped gracefully');
        } else {
          console.error(`🤖 Liquidation bot crashed with code ${code}, signal ${signal}`);
          this.handleCrash();
        }
      });

      // Handle bot errors
      this.botProcess.on('error', (error) => {
        console.error('🤖 Liquidation bot process error:', error);
        this.isRunning = false;
        this.handleCrash();
      });

      console.log(`🤖 Liquidation bot started with PID: ${this.botProcess.pid}`);
      console.log('   Environment Variables:');
      console.log('     LENDING_PROGRAM_ID:', process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID);
      console.log('     SOLANA_RPC_URL:', process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
      console.log('     LIQUIDATION_BOT_INTERVAL_MINUTES:', process.env.LIQUIDATION_BOT_INTERVAL_MINUTES || '5');
      console.log('✅ Liquidation bot is now monitoring for expired loans...');

    } catch (error) {
      console.error('🤖 Failed to start liquidation bot:', error);
      this.isRunning = false;
    }
  }

  private handleCrash() {
    if (this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.restartAttempts), 30000); // Exponential backoff, max 30s
      
      console.log(`🤖 Attempting to restart liquidation bot in ${delay/1000}s (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
      
      setTimeout(() => {
        this.start();
      }, delay);
    } else {
      console.error('🤖 Max restart attempts reached. Liquidation bot will not restart automatically.');
    }
  }

  stop() {
    if (!this.isRunning || !this.botProcess) {
      console.log('🤖 Liquidation bot is not running');
      return;
    }

    console.log('🛑 Stopping liquidation bot...');
    
    // Send SIGTERM for graceful shutdown
    this.botProcess.kill('SIGTERM');
    
    // Force kill after 10 seconds if not stopped
    setTimeout(() => {
      if (this.botProcess && !this.botProcess.killed) {
        console.log('🤖 Force killing liquidation bot...');
        this.botProcess.kill('SIGKILL');
      }
    }, 10000);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      pid: this.botProcess?.pid || null,
      restartAttempts: this.restartAttempts,
    };
  }

  restart() {
    console.log('🔄 Restarting liquidation bot...');
    this.stop();
    
    // Wait a bit before restarting
    setTimeout(() => {
      this.start();
    }, 2000);
  }
}

// Singleton instance
let botManager: LiquidationBotManager | null = null;

export function getLiquidationBotManager(): LiquidationBotManager {
  if (!botManager) {
    botManager = new LiquidationBotManager();
  }
  return botManager;
}

// Auto-start the bot when this module is imported (server-side only)
if (typeof window === 'undefined') {
  getLiquidationBotManager();
}
