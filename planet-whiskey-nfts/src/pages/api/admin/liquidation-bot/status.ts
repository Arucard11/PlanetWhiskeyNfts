import { NextApiRequest, NextApiResponse } from 'next';
import { getLiquidationBotManager } from '../../../../lib/liquidation-bot-manager';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const botManager = getLiquidationBotManager();
    const status = botManager.getStatus();

    if (req.method === 'GET') {
      // Get bot status
      res.status(200).json({
        success: true,
        data: status
      });
    } else if (req.method === 'POST') {
      // Control bot (start/stop/restart)
      const { action } = req.body;

      switch (action) {
        case 'start':
          botManager.start();
          break;
        case 'stop':
          botManager.stop();
          break;
        case 'restart':
          botManager.restart();
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid action. Use: start, stop, or restart'
          });
      }

      // Wait a moment for status to update
      setTimeout(() => {
        const newStatus = botManager.getStatus();
        res.status(200).json({
          success: true,
          message: `Bot ${action} command sent`,
          data: newStatus
        });
      }, 1000);
    } else {
      res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Error in liquidation bot API:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
