import { NextApiRequest, NextApiResponse } from 'next';
import { withAdminAuth } from '@/lib/adminAuth';
import * as anchor from "@coral-xyz/anchor";
import { Connection, clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import fs from 'fs';
import path from 'path';

// Load deployment info
function loadDeploymentInfo() {
  try {
    const deploymentPath = path.join(process.cwd(), '../solana_program/project-constellation-deployment.json');
    if (fs.existsSync(deploymentPath)) {
      return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    }
    return null;
  } catch (error) {
    console.error('Error loading deployment info:', error);
    return null;
  }
}

// Load oracle keypair
function loadOracleKeypair() {
  try {
    const oracleKeypairPath = path.join(process.cwd(), 'solana_program', 'oracle-keypair.json');
    if (fs.existsSync(oracleKeypairPath)) {
      const oracleKeypairData = JSON.parse(fs.readFileSync(oracleKeypairPath, 'utf8'));
      return Keypair.fromSecretKey(new Uint8Array(oracleKeypairData));
    }
    return null;
  } catch (error) {
    console.error('Error loading oracle keypair:', error);
    return null;
  }
}

// Simulate fetching real-world asset prices
async function fetchAssetPrices() {
  // In production, you would fetch these from real APIs
  // For now, returning simulated values with some variation
  const baseValues = {
    btc: 45000,  // $45,000 per BTC
    gold: 2000,  // $2,000 per oz
    oil: 80,     // $80 per barrel
  };

  // Add some realistic variation (±5%)
  const variation = () => 1 + (Math.random() - 0.5) * 0.1;

  return {
    btcPrice: Math.round(baseValues.btc * variation()),
    goldPrice: Math.round(baseValues.gold * variation()),
    oilPrice: Math.round(baseValues.oil * variation()),
  };
}

// Calculate treasury values based on holdings
function calculateTreasuryValues(prices: any) {
  // These would be the actual holdings in the treasury
  // For simulation, using fixed amounts
  const holdings = {
    btcAmount: 1.5,      // 1.5 BTC
    goldOunces: 25,      // 25 oz of gold  
    oilBarrels: 500,     // 500 barrels of oil
  };

  const btcValue = Math.round(holdings.btcAmount * prices.btcPrice);
  const goldValue = Math.round(holdings.goldOunces * prices.goldPrice);
  const oilValue = Math.round(holdings.oilBarrels * prices.oilPrice);
  const totalValue = btcValue + goldValue + oilValue;

  return {
    btcValue,
    goldValue,
    oilValue,
    totalValue,
    prices,
    holdings,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  try {
    const deploymentInfo = loadDeploymentInfo();
    if (!deploymentInfo) {
      return res.status(500).json({ message: 'Lending program not deployed' });
    }

    const oracleKeypair = loadOracleKeypair();
    if (!oracleKeypair) {
      return res.status(500).json({ message: 'Oracle keypair not found' });
    }

    const connection = new Connection(process.env.RPC_URL || clusterApiUrl("devnet"), "confirmed");

    // Fetch current asset prices
    console.log('Fetching asset prices...');
    const prices = await fetchAssetPrices();
    
    // Calculate treasury values
    const treasuryValues = calculateTreasuryValues(prices);
    
    console.log('Treasury values calculated:', treasuryValues);

    // Setup Anchor program
    const wallet = new anchor.Wallet(oracleKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);

    // In production, you would call the update_treasury_values instruction
    /*
    const program = anchor.workspace.Lendingprogram as Program<Lendingprogram>;
    const globalMarketPda = new PublicKey(deploymentInfo.globalMarketPda);
    
    await program.methods
      .updateTreasuryValues(new anchor.BN(treasuryValues.totalValue))
      .accounts({
        globalMarket: globalMarketPda,
        oracleAuthority: oracleKeypair.publicKey,
      })
      .signers([oracleKeypair])
      .rpc();
    */

    // Simulate successful update
    console.log('Treasury values updated successfully');

    res.status(200).json({
      message: 'Treasury values updated successfully',
      treasuryValues: {
        btcValue: treasuryValues.btcValue,
        goldValue: treasuryValues.goldValue,
        oilValue: treasuryValues.oilValue,
        totalValue: treasuryValues.totalValue,
      },
      marketPrices: treasuryValues.prices,
      holdings: treasuryValues.holdings,
      timestamp: new Date().toISOString(),
      signature: 'mock_signature_' + Date.now(), // In production, return actual transaction signature
    });

  } catch (error) {
    console.error('Error updating treasury values:', error);
    res.status(500).json({ message: 'Failed to update treasury values' });
  }
}

export default withAdminAuth(handler);
