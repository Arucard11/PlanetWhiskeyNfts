import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { withAdminAuth } from '@/lib/adminAuth';

// Pinata configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

// Disable Next.js body parser to handle formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50MB
    keepExtensions: true,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

async function formidableFileToReadableStream(file: formidable.File | formidable.File[]): Promise<{ stream: Readable, path: string }> {
  const singleFile = Array.isArray(file) ? file[0] : file;
  
  if (!singleFile || !singleFile.filepath) {
    throw new Error('Invalid file');
  }

  const stream = fs.createReadStream(singleFile.filepath);
  return { stream, path: singleFile.filepath };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse form data
    const { fields, files } = await parseForm(req);
    
    const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
    const symbol = Array.isArray(fields.symbol) ? fields.symbol[0] : fields.symbol;
    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
    const requiredWhiskeyAmount = Array.isArray(fields.requiredWhiskeyAmount) ? fields.requiredWhiskeyAmount[0] : fields.requiredWhiskeyAmount;
    const itemLimit = Array.isArray(fields.itemLimit) ? fields.itemLimit[0] : fields.itemLimit;
    const image = files.image;

    if (!name || !symbol || !description || !requiredWhiskeyAmount || !itemLimit || !image) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    console.log('🚀 Creating whiskey-gated collection:', { name, symbol, requiredWhiskeyAmount, itemLimit });

    // Upload image to Pinata
    console.log('📤 Uploading image to Pinata...');
    const { stream } = await formidableFileToReadableStream(image);
    
    const formData = new FormData();
    const buffer = await streamToBuffer(stream);
    const blob = new Blob([buffer]);
    formData.append('file', blob);
    formData.append('pinataMetadata', JSON.stringify({ name: `${name} Collection Image` }));

    const imageUploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY!,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY!,
      },
      body: formData,
    });

    if (!imageUploadResponse.ok) {
      throw new Error('Failed to upload image to Pinata');
    }

    const imageResult = await imageUploadResponse.json();
    const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageResult.IpfsHash}`;
    console.log('✅ Image uploaded:', imageUrl);

    // Create collection metadata
    const collectionMetadata = {
      name,
      symbol,
      description,
      image: imageUrl,
      attributes: [
        {
          trait_type: "Collection Type",
          value: "Whiskey-Gated"
        },
        {
          trait_type: "Required WHISKEY Tokens",
          value: requiredWhiskeyAmount
        }
      ],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: "image"
          }
        ],
        category: "image"
      }
    };

    // Upload metadata to Pinata
    console.log('📤 Uploading metadata to Pinata...');
    const metadataUploadResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'pinata_api_key': PINATA_API_KEY!,
        'pinata_secret_api_key': PINATA_SECRET_API_KEY!,
      },
      body: JSON.stringify({
        pinataContent: collectionMetadata,
        pinataMetadata: {
          name: `${name} Collection Metadata`
        }
      }),
    });

    if (!metadataUploadResponse.ok) {
      throw new Error('Failed to upload metadata to Pinata');
    }

    const metadataResult = await metadataUploadResponse.json();
    const metadataUri = `https://gateway.pinata.cloud/ipfs/${metadataResult.IpfsHash}`;
    console.log('✅ Metadata uploaded:', metadataUri);

    // Create Solana transaction for whiskey-gated collection
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com');
    
    // Get admin wallet address from environment (no private key needed)
    const adminWallet = new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET || '2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk');

    // Load Whiskey Program
    const whiskeyProgramId = new PublicKey(process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID!);
    
    // Create a temporary provider for transaction building (no signing)
    const tempKeypair = Keypair.generate();
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(tempKeypair), {});
    
    // Load IDL
    const idlPath = path.join(process.cwd(), 'src/lib/idl/whiskeyprogram.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    const program = new anchor.Program(idl, provider);

    // Generate collection mint keypair
    const collectionMintKeypair = Keypair.generate();
    const collectionMint = collectionMintKeypair.publicKey;

    // Derive collection config PDA
    const [collectionConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), Buffer.from(name)],
      whiskeyProgramId
    );

    // Derive metadata account
    const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Derive master edition account
    const [masterEditionAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.toBuffer(),
        Buffer.from('edition'),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Derive token account
    const [tokenAccount] = PublicKey.findProgramAddressSync(
      [
        adminWallet.toBuffer(),
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA').toBuffer(),
        collectionMint.toBuffer(),
      ],
      new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
    );

    console.log('🔑 Creating whiskey-gated collection transaction...');
    console.log('Collection Mint:', collectionMint.toString());
    console.log('Collection Config PDA:', collectionConfigPda.toString());

    // Create the transaction
    const transaction = await program.methods
      .createWhiskeyGatedCollection(
        name,
        symbol,
        metadataUri,
        new anchor.BN(requiredWhiskeyAmount),
        new anchor.BN(itemLimit)
      )
      .accounts({
        admin: adminWallet,
        collectionConfig: collectionConfigPda,
        collectionMint: collectionMint,
        metadataAccount: metadataAccount,
        masterEditionAccount: masterEditionAccount,
        tokenAccount: tokenAccount,
        tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([collectionMintKeypair])
      .transaction();

    // Set recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = adminWallet;

    // Only sign with the collection mint keypair (server-generated)
    // The admin signature will be added client-side
    transaction.partialSign(collectionMintKeypair);

    // Serialize transaction for client-side signing
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    console.log('✅ Whiskey-gated collection transaction created');

    res.status(200).json({
      success: true,
      message: 'Whiskey-gated collection transaction created',
      transactionData: Buffer.from(serializedTransaction).toString('base64'),
      collectionMint: collectionMint.toString(),
      collectionConfig: collectionConfigPda.toString(),
      metadataUri,
      imageUrl,
      requiredWhiskeyAmount,
      itemLimit
    });

  } catch (error) {
    console.error('Error creating whiskey-gated collection:', error);
    res.status(500).json({ 
      message: 'Failed to create whiskey-gated collection', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
