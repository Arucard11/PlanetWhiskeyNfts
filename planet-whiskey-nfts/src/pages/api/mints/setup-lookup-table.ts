import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, Keypair, Transaction, sendAndConfirmTransaction, PublicKey } from '@solana/web3.js';
import { 
  createMintingLookupTable, 
  extendMintingLookupTable, 
  fetchLookupTable,
  debugLookupTable,
  MINTING_COMMON_ADDRESSES
} from '../../../lib/addressLookupTable';

// Load admin keypair for creating lookup tables
function getAdminKeypair(): Keypair {
  // In production, this should be loaded from a secure environment variable
  // For now, we'll use the swap keypair as admin
  const swapKeypairJson = process.env.SWAP_KEYPAIR_JSON;
  if (!swapKeypairJson) {
    throw new Error('SWAP_KEYPAIR_JSON not found in environment');
  }
  
  const secretKey = JSON.parse(swapKeypairJson);
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  try {
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
    const adminKeypair = getAdminKeypair();

    switch (action) {
      case 'create': {
        console.log('🔧 Creating new minting lookup table...');
        
        // Create the lookup table
        const { instruction: createInstruction, address: lookupTableAddress } = 
          await createMintingLookupTable(connection, adminKeypair);
        
        // Create transaction with the create instruction
        const createTransaction = new Transaction().add(createInstruction);
        
        // Send and confirm the create transaction
        const createSignature = await sendAndConfirmTransaction(
          connection, 
          createTransaction, 
          [adminKeypair]
        );
        
        console.log('✅ Lookup table created:', lookupTableAddress.toBase58());
        console.log('📝 Create transaction:', createSignature);
        
        // Wait a bit for the table to be available
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Extend the lookup table with common addresses
        const extendInstruction = extendMintingLookupTable(
          lookupTableAddress,
          adminKeypair.publicKey,
          adminKeypair.publicKey
        );
        
        const extendTransaction = new Transaction().add(extendInstruction);
        
        // Send and confirm the extend transaction
        const extendSignature = await sendAndConfirmTransaction(
          connection, 
          extendTransaction, 
          [adminKeypair]
        );
        
        console.log('✅ Lookup table extended with common addresses');
        console.log('📝 Extend transaction:', extendSignature);
        
        // Debug the created table
        await debugLookupTable(connection, lookupTableAddress);
        
        return res.status(200).json({
          success: true,
          lookupTableAddress: lookupTableAddress.toBase58(),
          createSignature,
          extendSignature,
          addressesAdded: MINTING_COMMON_ADDRESSES.length,
          message: 'Lookup table created and extended successfully'
        });
      }

      case 'debug': {
        const { lookupTableAddress } = req.body;
        
        if (!lookupTableAddress) {
          return res.status(400).json({ error: 'lookupTableAddress is required for debug action' });
        }
        
        console.log('🔍 Debugging lookup table:', lookupTableAddress);
        await debugLookupTable(connection, new PublicKey(lookupTableAddress));
        
        const lookupTableAccount = await fetchLookupTable(connection, new PublicKey(lookupTableAddress));
        
        if (!lookupTableAccount) {
          return res.status(404).json({ error: 'Lookup table not found' });
        }
        
        return res.status(200).json({
          success: true,
          lookupTable: {
            address: lookupTableAccount.key.toBase58(),
            authority: lookupTableAccount.state.authority?.toBase58(),
            deactivationSlot: lookupTableAccount.state.deactivationSlot,
            lastExtendedSlot: lookupTableAccount.state.lastExtendedSlot,
            addressCount: lookupTableAccount.state.addresses.length,
            addresses: lookupTableAccount.state.addresses.map(addr => addr.toBase58())
          }
        });
      }

      case 'extend': {
        const { lookupTableAddress, additionalAddresses } = req.body;
        
        if (!lookupTableAddress) {
          return res.status(400).json({ error: 'lookupTableAddress is required for extend action' });
        }
        
        const addresses = additionalAddresses || [];
        const publicKeyAddresses = addresses.map((addr: string) => new PublicKey(addr));
        
        console.log('🔧 Extending lookup table with additional addresses...');
        
        const extendInstruction = extendMintingLookupTable(
          new PublicKey(lookupTableAddress),
          adminKeypair.publicKey,
          adminKeypair.publicKey,
          publicKeyAddresses
        );
        
        const transaction = new Transaction().add(extendInstruction);
        
        const signature = await sendAndConfirmTransaction(
          connection, 
          transaction, 
          [adminKeypair]
        );
        
        console.log('✅ Lookup table extended');
        console.log('📝 Transaction:', signature);
        
        return res.status(200).json({
          success: true,
          signature,
          addressesAdded: addresses.length,
          message: 'Lookup table extended successfully'
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action. Use: create, debug, or extend' });
    }

  } catch (error) {
    console.error('Error managing lookup table:', error);
    return res.status(500).json({ 
      error: 'Failed to manage lookup table',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
