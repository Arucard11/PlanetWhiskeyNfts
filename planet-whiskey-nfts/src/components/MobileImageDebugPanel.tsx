"use client";

import React, { useState, useEffect } from 'react';
import { mobileImageDebugger } from '@/lib/mobileImageDebug';

interface DebugSummary {
  totalAttempts: number;
  successRate: number;
  averageLoadTime: number;
  mobileIssues: number;
  commonErrors: string[];
}

const MobileImageDebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<DebugSummary | null>(null);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Get debug summary when panel opens
      const debugSummary = mobileImageDebugger.getDebugSummary();
      setSummary(debugSummary);
    }
  }, [isOpen]);

  const handleTestUrl = async () => {
    if (!testUrl) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/debug/mobile-images?action=test&url=${encodeURIComponent(testUrl)}`);
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLog = async () => {
    try {
      await fetch('/api/debug/mobile-images?action=clear');
      setSummary(mobileImageDebugger.getDebugSummary());
    } catch (error) {
      console.error('Error clearing debug log:', error);
    }
  };

  // Only show in development or if explicitly enabled
  if (process.env.NODE_ENV === 'production' && !window.location.search.includes('debug=true')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-700 transition-colors"
          title="Mobile Image Debug Panel"
        >
          🔍 Debug
        </button>
      ) : (
        <div className="bg-slate-900 text-white p-6 rounded-lg shadow-2xl max-w-md max-h-96 overflow-y-auto border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Mobile Image Debug</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {summary && (
            <div className="mb-4 space-y-2 text-sm">
              <div>Total Attempts: <span className="text-amber-400">{summary.totalAttempts}</span></div>
              <div>Success Rate: <span className="text-green-400">{summary.successRate.toFixed(1)}%</span></div>
              <div>Avg Load Time: <span className="text-blue-400">{summary.averageLoadTime.toFixed(0)}ms</span></div>
              <div>Mobile Issues: <span className="text-red-400">{summary.mobileIssues}</span></div>
              
              {summary.commonErrors.length > 0 && (
                <div>
                  <div className="font-semibold mt-2">Common Errors:</div>
                  <ul className="text-xs text-red-300 ml-2">
                    {summary.commonErrors.slice(0, 3).map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Test image URL..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
              />
              <button
                onClick={handleTestUrl}
                disabled={isLoading || !testUrl}
                className="w-full mt-2 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {isLoading ? 'Testing...' : 'Test URL'}
              </button>
            </div>

            {testResult && (
              <div className="bg-slate-800 p-3 rounded text-xs">
                <div className="font-semibold mb-1">Test Result:</div>
                {testResult.success ? (
                  <div className="space-y-1">
                    <div>Accessible: <span className={testResult.data.accessible ? 'text-green-400' : 'text-red-400'}>
                      {testResult.data.accessible ? 'Yes' : 'No'}
                    </span></div>
                    <div>Load Time: <span className="text-blue-400">{testResult.data.loadTime}ms</span></div>
                    {testResult.data.error && (
                      <div>Error: <span className="text-red-400">{testResult.data.error}</span></div>
                    )}
                  </div>
                ) : (
                  <div className="text-red-400">Error: {testResult.message || testResult.error}</div>
                )}
              </div>
            )}

            <div className="flex space-x-2">
              <button
                onClick={handleClearLog}
                className="flex-1 bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700 text-sm"
              >
                Clear Log
              </button>
              <button
                onClick={() => {
                  const debugSummary = mobileImageDebugger.getDebugSummary();
                  setSummary(debugSummary);
                }}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileImageDebugPanel;
