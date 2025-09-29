// Mobile Image Debug Utility
// This utility helps debug image loading issues on mobile devices

export interface ImageLoadingDebugInfo {
  originalUrl: string;
  processedUrl: string;
  userAgent: string;
  isMobile: boolean;
  networkType?: string;
  loadStartTime: number;
  loadEndTime?: number;
  errorMessage?: string;
  success: boolean;
}

class MobileImageDebugger {
  private static instance: MobileImageDebugger;
  private debugLog: ImageLoadingDebugInfo[] = [];
  private maxLogEntries = 100;

  static getInstance(): MobileImageDebugger {
    if (!MobileImageDebugger.instance) {
      MobileImageDebugger.instance = new MobileImageDebugger();
    }
    return MobileImageDebugger.instance;
  }

  isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    
    const userAgent = window.navigator.userAgent;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return mobileRegex.test(userAgent);
  }

  getNetworkType(): string {
    if (typeof window === 'undefined') return 'unknown';
    
    // @ts-ignore - navigator.connection is experimental
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      return connection.effectiveType || connection.type || 'unknown';
    }
    
    return 'unknown';
  }

  logImageLoadStart(originalUrl: string, processedUrl: string): string {
    const debugInfo: ImageLoadingDebugInfo = {
      originalUrl,
      processedUrl,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      isMobile: this.isMobileDevice(),
      networkType: this.getNetworkType(),
      loadStartTime: Date.now(),
      success: false
    };

    this.debugLog.push(debugInfo);
    
    // Keep log size manageable
    if (this.debugLog.length > this.maxLogEntries) {
      this.debugLog = this.debugLog.slice(-this.maxLogEntries);
    }

    const logId = `img_${debugInfo.loadStartTime}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[MobileImageDebug] ${logId} - Load started:`, {
      originalUrl,
      processedUrl,
      isMobile: debugInfo.isMobile,
      networkType: debugInfo.networkType
    });

    return logId;
  }

  logImageLoadSuccess(logId: string): void {
    const entry = this.findLogEntry(logId);
    if (entry) {
      entry.loadEndTime = Date.now();
      entry.success = true;
      
      const loadTime = entry.loadEndTime - entry.loadStartTime;
      console.log(`[MobileImageDebug] ${logId} - Load successful in ${loadTime}ms`);
    }
  }

  logImageLoadError(logId: string, errorMessage: string): void {
    const entry = this.findLogEntry(logId);
    if (entry) {
      entry.loadEndTime = Date.now();
      entry.success = false;
      entry.errorMessage = errorMessage;
      
      const loadTime = entry.loadEndTime - entry.loadStartTime;
      console.error(`[MobileImageDebug] ${logId} - Load failed in ${loadTime}ms:`, errorMessage);
    }
  }

  private findLogEntry(logId: string): ImageLoadingDebugInfo | undefined {
    const timestamp = logId.split('_')[1];
    return this.debugLog.find(entry => 
      entry.loadStartTime.toString() === timestamp
    );
  }

  getDebugSummary(): {
    totalAttempts: number;
    successRate: number;
    averageLoadTime: number;
    mobileIssues: number;
    commonErrors: string[];
  } {
    const completedLoads = this.debugLog.filter(entry => entry.loadEndTime);
    const successfulLoads = completedLoads.filter(entry => entry.success);
    const mobileLoads = completedLoads.filter(entry => entry.isMobile);
    const mobileFailures = mobileLoads.filter(entry => !entry.success);
    
    const loadTimes = successfulLoads.map(entry => 
      entry.loadEndTime! - entry.loadStartTime
    );
    
    const averageLoadTime = loadTimes.length > 0 
      ? loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length 
      : 0;

    const errors = this.debugLog
      .filter(entry => entry.errorMessage)
      .map(entry => entry.errorMessage!)
      .reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const commonErrors = Object.entries(errors)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);

    return {
      totalAttempts: this.debugLog.length,
      successRate: completedLoads.length > 0 ? (successfulLoads.length / completedLoads.length) * 100 : 0,
      averageLoadTime,
      mobileIssues: mobileFailures.length,
      commonErrors
    };
  }

  exportDebugLog(): string {
    return JSON.stringify(this.debugLog, null, 2);
  }

  clearDebugLog(): void {
    this.debugLog = [];
    console.log('[MobileImageDebug] Debug log cleared');
  }
}

export const mobileImageDebugger = MobileImageDebugger.getInstance();

// Helper function to test image URL accessibility
export async function testImageUrl(url: string): Promise<{
  accessible: boolean;
  loadTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });
    
    const loadTime = Date.now() - startTime;
    
    return {
      accessible: response.ok,
      loadTime,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error) {
    const loadTime = Date.now() - startTime;
    return {
      accessible: false,
      loadTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
