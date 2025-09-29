import type { NextApiRequest, NextApiResponse } from 'next';
import { mobileImageDebugger, testImageUrl } from '@/lib/mobileImageDebug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { action, url } = req.query;

    switch (action) {
      case 'summary':
        const summary = mobileImageDebugger.getDebugSummary();
        return res.status(200).json({
          success: true,
          data: summary
        });

      case 'log':
        const log = mobileImageDebugger.exportDebugLog();
        return res.status(200).json({
          success: true,
          data: JSON.parse(log)
        });

      case 'clear':
        mobileImageDebugger.clearDebugLog();
        return res.status(200).json({
          success: true,
          message: 'Debug log cleared'
        });

      case 'test':
        if (!url || typeof url !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'URL parameter is required for testing'
          });
        }

        try {
          const testResult = await testImageUrl(url);
          return res.status(200).json({
            success: true,
            data: {
              url,
              ...testResult
            }
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: 'Error testing URL',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use: summary, log, clear, or test'
        });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }
}
