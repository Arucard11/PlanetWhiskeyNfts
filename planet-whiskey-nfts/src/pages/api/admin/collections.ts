import type { NextApiRequest, NextApiResponse } from 'next';
import {promises as fs} from 'fs';
import path from 'path';
import formidable from 'formidable'; // Use 'formidable' instead of 'formidable-serverless'
import { Writable, Readable } from 'stream';
// REMOVED: Server-side admin wallet operations - All admin operations now require client-side wallet signing
import { Keypair, PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY, sendAndConfirmTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAnchorProvider, getSolanaConnection, getSolanaProgram } from '@/lib/solanaUtils';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { BN, Program } from '@coral-xyz/anchor';
import { Whiskeyprogram as SolanaProgram } from '../../../lib/idl/whiskeyprogram';
import PinataClient from '@pinata/sdk';
import connectToDatabase from '../../../lib/mongodb';
import Company from '../../../models/Company';
import NftCollection from '../../../models/NftCollection';
// Removed convertUsdToWhiskeyTokens import - conversion now happens at mint time

// console.log("DEBUG: PINATA_API_KEY from env:", process.env.PINATA_API_KEY); // Removed
// console.log("DEBUG: PINATA_SECRET_API_KEY from env:", process.env.PINATA_SECRET_API_KEY); // Removed
const pinata = new PinataClient(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to parse form data
const parseForm = (req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: true });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
};


// Helper to convert a formidable File to a ReadableStream for Pinata
async function formidableFileToReadableStream(file: formidable.File | formidable.File[]): Promise<{ stream: Readable, path: string }> {
  const singleFile = Array.isArray(file) ? file[0] : file;
  if (!singleFile || !singleFile.filepath) {
    throw new Error('File path is undefined.');
  }
  const buffer = await fs.readFile(singleFile.filepath);
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null); // Signifies end of stream
  
  // Pinata SDK's pinFileToIPFS needs a path for the content, even if it's from a stream.
  // We can use the original filename or a generic name.
  const filePathForPinata = singleFile.originalFilename || 'uploaded-file';
  return { stream, path: filePathForPinata };
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      await connectToDatabase();
      
      const collections = await NftCollection.find({}).populate('companyId', 'name').lean();
      
      const collectionsWithCompanyNames = collections.map(collection => ({
        _id: collection._id,
        name: collection.name,
        symbol: collection.symbol,
        mintPriceWhiskeyTokens: collection.mintPriceWhiskeyTokens,
        mintPriceUsd: collection.mintPriceUsd, // NEW: Include USD price
        itemLimit: collection.itemLimit,
        itemsMintedOnChain: collection.itemsMintedOnChain,
        companyId: collection.companyId,
        companyName: collection.companyId?.name || 'Unknown',
        createdAt: collection.createdAt,
        isActive: collection.isActive
      }));

      res.status(200).json({ 
        success: true, 
        collections: collectionsWithCompanyNames 
      });
    } catch (error) {
      console.error('Error fetching collections:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch collections',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // console.log("[ADMIN_CREATE_COLLECTION] Received POST request to /api/admin/collections"); // Removed
    const { fields, files } = await parseForm(req);
    
    // Log the entire fields object to see what the server received
    console.log("[ADMIN_CREATE_COLLECTION] All fields received from form:", JSON.stringify(fields, null, 2));

    // console.log("[ADMIN_CREATE_COLLECTION] Raw files object from formidable:", JSON.stringify(files, null, 2)); // Removed
    // console.log("[ADMIN_CREATE_COLLECTION] Raw files.collectionImageFile details:", JSON.stringify(files.collectionImageFile, null, 2)); // Removed
    // console.log("[ADMIN_CREATE_COLLECTION] Raw files.nftBaseImageFile details:", JSON.stringify(files.nftBaseImageFile, null, 2)); // Removed

    const {
      collectionName,
      collectionSymbol,
      collectionDescription,
      mintPriceWhiskey,
      mintPriceUsd, // NEW: USD price field
      itemLimit,
      companyId,
      nftBaseName, // e.g., "Whiskey Barrel #{ID}"
      nftBaseDescription,
      adminWalletAddress, // NEW: Admin wallet address from frontend
      // Attributes will be an array of { trait_type: string, value: string }
      // It needs to be parsed from JSON string if sent as such
    } = fields;

    // Handle potential string[] from formidable, ensure single string values
    const sName = Array.isArray(collectionName) ? collectionName[0] : collectionName;
    const sSymbol = Array.isArray(collectionSymbol) ? collectionSymbol[0] : collectionSymbol;
    const sDescription = Array.isArray(collectionDescription) ? collectionDescription[0] : collectionDescription;
    const sMintPriceWhiskey = Array.isArray(mintPriceWhiskey) ? mintPriceWhiskey[0] : mintPriceWhiskey;
    const sMintPriceUsd = Array.isArray(mintPriceUsd) ? mintPriceUsd[0] : mintPriceUsd; // NEW: Handle USD price
    const sItemLimit = Array.isArray(itemLimit) ? itemLimit[0] : itemLimit;
    const sCompanyId = Array.isArray(companyId) ? companyId[0] : companyId;
    const sNftBaseName = (Array.isArray(nftBaseName) ? nftBaseName[0] : nftBaseName) ?? '' as string;
    const sNftBaseDescription = (Array.isArray(nftBaseDescription) ? nftBaseDescription[0] : nftBaseDescription) ?? '' as string;
    const sAdminWalletAddress = Array.isArray(adminWalletAddress) ? adminWalletAddress[0] : adminWalletAddress;
    const attributesString = (Array.isArray(fields.attributes) ? fields.attributes[0] : fields.attributes) ?? '' as string;

    let attributes: Array<{ trait_type: string, value: string }> = [];
    if (attributesString) {
        try {
            attributes = JSON.parse(attributesString);
        } catch (error) {
            console.error("[ADMIN_CREATE_COLLECTION] Error parsing attributes JSON:", error);
            // Optionally return a 400 error if attributes are malformed
            // return res.status(400).json({ message: 'Invalid attributes JSON format.' });
        }
    }
    
    // console.log("[ADMIN_CREATE_COLLECTION] Starting input validation..."); // Removed
    // Log the actual values being validated - KEEPING THIS ONE as it's concise
    console.log("[ADMIN_CREATE_COLLECTION] Validating fields:", {
        sName,
        sSymbol,
        sDescription,
        sMintPriceUsd,
        sItemLimit,
        sCompanyId,
        sNftBaseName,
        sNftBaseDescription
    });

    // Basic Validations - now requiring USD price instead of WHISKEY price
    if (!sName || !sSymbol || !sDescription || !sMintPriceUsd || !sItemLimit || !sCompanyId || !sNftBaseName || !sNftBaseDescription || !sAdminWalletAddress) {
      return res.status(400).json({ message: 'Missing required fields. Ensure name, symbol, description, USD mint price, item limit, company ID, NFT base name, NFT base description, and admin wallet address are provided.' });
    }

    console.log("[ADMIN_CREATE_COLLECTION] Checking uploaded files. collectionImage:", files.collectionImage ? 'Found' : 'Missing');

    if (!files.collectionImage) {
        return res.status(400).json({ message: 'Missing collection image.' });
    }
    // console.log("[ADMIN_CREATE_COLLECTION] Input validation passed for basic fields."); // Removed

    const collectionImageFile = (Array.isArray(files.collectionImage) ? files.collectionImage[0] : files.collectionImage) as formidable.File;
    // Use the same image for both collection and NFT base for simplicity
    const nftBaseImageFile = collectionImageFile;

    // --- 0. DB Checks ---
    // console.log("[ADMIN_CREATE_COLLECTION] Connecting to DB for company check..."); // Removed
    await connectToDatabase();
    const company = await Company.findById(sCompanyId as string);
    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }
    // console.log("[ADMIN_CREATE_COLLECTION] Company found:", company.name); // Removed

    // --- 1. Upload images to IPFS via Pinata ---
    // console.log("[ADMIN_CREATE_COLLECTION] Uploading collection image to Pinata...", collectionImageFile.originalFilename); // Removed
    const collectionImageStream = await formidableFileToReadableStream(collectionImageFile);
    const collectionImageResult = await pinata.pinFileToIPFS(collectionImageStream.stream, {
        pinataMetadata: { name: collectionImageFile.originalFilename || `collection_${sName}` }
    });
    const uploadedCollectionImageUrl = `ipfs://${collectionImageResult.IpfsHash}`;
    // console.log('[ADMIN_CREATE_COLLECTION] Collection image uploaded to:', uploadedCollectionImageUrl); // Removed

    // console.log("[ADMIN_CREATE_COLLECTION] Uploading NFT base image to Pinata...", nftBaseImageFile.originalFilename); // Removed
    const nftBaseImageStream = await formidableFileToReadableStream(nftBaseImageFile);
    const nftBaseImageResult = await pinata.pinFileToIPFS(nftBaseImageStream.stream, {
        pinataMetadata: { name: nftBaseImageFile.originalFilename || `nft_base_${sName}` }
    });
    const uploadedNftBaseImageUrl = `ipfs://${nftBaseImageResult.IpfsHash}`;
    // console.log('[ADMIN_CREATE_COLLECTION] NFT base image uploaded to:', uploadedNftBaseImageUrl); // Removed


    // --- 2. Prepare and upload JSON metadata to IPFS via Pinata ---
    // console.log("[ADMIN_CREATE_COLLECTION] Constructing collection metadata JSON..."); // Removed
    const collectionMetadata = {
      name: sName as string,
      symbol: sSymbol as string,
      description: sDescription as string,
      image: uploadedCollectionImageUrl,
      // Add any other collection-level metadata here if needed by standards like Metaplex UAU
      // external_url: "https://yourwebsite.com/collections/" + name, 
      // attributes: [{trait_type: "Type", value: "Whiskey NFT Collection"}],
      // properties: { creators: [{address: adminKeypair.publicKey.toBase58(), share: 100}] } // Example
    };
    
    // console.log('[ADMIN_CREATE_COLLECTION] Uploading collection JSON metadata to Pinata...'); // Removed
    const collectionMetadataResult = await pinata.pinJSONToIPFS(collectionMetadata, {
        pinataMetadata: { name: `collection_meta_${(sName as string).replace(/\s+/g, '_')}_${Date.now()}.json` }
    });
    const uploadedCollectionMetadataUri = `ipfs://${collectionMetadataResult.IpfsHash}`;
    // console.log('[ADMIN_CREATE_COLLECTION] Collection JSON metadata uploaded to:', uploadedCollectionMetadataUri); // Removed
    
    // console.log('[ADMIN_CREATE_COLLECTION] Uploading NFT base JSON metadata template to Pinata...'); // Removed
    const nftBaseMetadata = {
      name: sNftBaseName as string, // e.g., "Whiskey Barrel #0001" - placeholder, will be replaced by program
      symbol: sSymbol as string,
      description: sNftBaseDescription as string,
      image: uploadedNftBaseImageUrl, // Base image for all NFTs in this collection
      attributes: attributes, // Array of {trait_type, value} from form
      // collection: { name: name, family: name }, // Optional: Metaplex collection grouping
      // properties: {
      //   files: [{ uri: uploadedNftBaseImageUrl, type: "image/png" }], // Or appropriate mime type
      //   category: "image",
      //   creators: [{ address: adminKeypair.publicKey.toBase58(), share: 100 }] // Payer/admin is creator
      // }
    };

    console.log('[ADMIN_CREATE_COLLECTION] NFT base metadata template:', {
        name: nftBaseMetadata.name,
        description: nftBaseMetadata.description,
        image: nftBaseMetadata.image
    });

    // console.log('[ADMIN_CREATE_COLLECTION] Uploading NFT base JSON metadata template to Pinata...'); // Removed
    const nftBaseMetadataResult = await pinata.pinJSONToIPFS(nftBaseMetadata, { 
        pinataMetadata: { name: `NFT Base Template for ${sName as string}` } 
    });
    const uploadedNftBaseMetadataUri = `ipfs://${nftBaseMetadataResult.IpfsHash}`;
    console.log('[ADMIN_CREATE_COLLECTION] NFT base JSON metadata template uploaded to:', uploadedNftBaseMetadataUri);

    // --- 3. Prepare Solana Transaction for Client-Side Signing ---
    const connection = getSolanaConnection();
    
    // Use the admin wallet address from the frontend
    const adminWalletPublicKey = new PublicKey(sAdminWalletAddress as string);

    // Validate that the provided admin wallet address matches the expected admin wallet
    const expectedAdminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET || "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X";
    if (adminWalletPublicKey.toBase58() !== expectedAdminWallet) {
      console.error("[ADMIN_CREATE_COLLECTION] Unauthorized: Provided wallet is not the admin wallet");
      return res.status(403).json({ message: 'Unauthorized: Only the admin wallet can create collections.' });
    }

    // Create a temporary keypair for program interaction (will be replaced by client wallet)
    const tempKeypair = Keypair.generate();
    const provider = getAnchorProvider(tempKeypair);
    const program = getSolanaProgram(provider);
    
    // Debug: Check program ID matching
    console.log('[DEBUG] Environment WHISKEY_PROGRAM_ID:', process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID);
    console.log('[DEBUG] Program ID from program:', program.programId.toString());
    console.log('[DEBUG] IDL address:', (program.idl as any).address);
    console.log('[DEBUG] Program IDs match:', program.programId.toString() === process.env.NEXT_PUBLIC_WHISKEY_PROGRAM_ID);

    // This keypair is for the *new collection's mint account itself*, NOT the fee payer.
    const collectionMintKeypair = Keypair.generate();

    // Log the public key of the admin wallet that will pay fees
    console.log("Admin wallet (fee payer) public key:", adminWalletPublicKey.toBase58());
    console.log("New Collection Mint public key:", collectionMintKeypair.publicKey.toBase58());

    // Derive PDAs
    console.log('[ADMIN_CREATE_COLLECTION] Deriving PDAs...');
    // UPDATED SEEDS for collectionConfigPDA to match the program
    const collectionSeedConstant = "collection"; 
    const collectionSeedConstantBuffer = Buffer.from(collectionSeedConstant);
    const collectionNameBuffer = Buffer.from(sName as string); // Use the actual collection name string

    console.log(`[DEBUG] collection_seed_constant: "${collectionSeedConstant}"`);
    console.log(`[DEBUG] collection_seed_constant_buffer_hex: ${collectionSeedConstantBuffer.toString('hex')}`);
    console.log(`[DEBUG] collection_name_for_seed: "${sName as string}"`);
    console.log(`[DEBUG] collection_name_buffer_for_seed_hex: ${collectionNameBuffer.toString('hex')}`);
    console.log(`[DEBUG] program_id_for_collection_config_pda: ${program.programId.toBase58()}`);

    const [collectionConfigPDA, collectionConfigBump] = await PublicKey.findProgramAddress(
        [collectionSeedConstantBuffer, collectionNameBuffer], // Use new seeds
        program.programId
    );
    console.log(`[DEBUG] client_derived_collection_config_pda: ${collectionConfigPDA.toBase58()}, client_derived_bump: ${collectionConfigBump}`);
    
    const [metadataAccountPDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          collectionMintKeypair.publicKey.toBuffer(),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
    );

    const [masterEditionAccountPDA] = await PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMintKeypair.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      MPL_TOKEN_METADATA_PROGRAM_ID
    );
    
    // This PDA is for the ATA that will hold the *collection NFT itself* for the program/collection config
    // This is NOT for individual user NFTs.
    // The owner of this ATA is the payer (adminWalletPublicKey).
    const [tokenAccountPDA] = await PublicKey.findProgramAddress(
        [
            adminWalletPublicKey.toBuffer(), // Corrected: Owner is the admin/payer
            TOKEN_PROGRAM_ID.toBuffer(),    // Token Program
            collectionMintKeypair.publicKey.toBuffer(), // Mint
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log('[ADMIN_CREATE_COLLECTION] PDAs derived:', 
        { collectionConfigPDA: collectionConfigPDA.toBase58(),
          metadataAccountPDA: metadataAccountPDA.toBase58(),
          masterEditionAccountPDA: masterEditionAccountPDA.toBase58(),
          tokenAccountPDA: tokenAccountPDA.toBase58()
        }
    );


    // Set SOL price to 0 since we only accept whiskey tokens
    const mintPriceLamports = new BN(0); // No SOL pricing
    
    // Convert USD price to microdollars (6 decimal places)
    const mintPriceUsdMicrodollars = new BN(parseFloat(sMintPriceUsd as string) * 1_000_000);
    
    // For collection creation, we'll set a placeholder WHISKEY price
    // The actual conversion will happen during minting when WHISKEY price is fetched
    const mintPriceWhiskeyTokens = new BN(1_000_000_000); // 1 WHISKEY token as placeholder
    console.log('[ADMIN_CREATE_COLLECTION] Using USD price:', mintPriceUsdMicrodollars.toString(), 'microdollars, placeholder WHISKEY price:', mintPriceWhiskeyTokens.toString());
    
    const itemLimitBN = new BN(parseInt(sItemLimit as string));
    console.log('[ADMIN_CREATE_COLLECTION] Set SOL price to 0 (whiskey tokens only), USD price to microdollars:', mintPriceUsdMicrodollars.toString(), 'itemLimit to BN:', itemLimitBN.toString());


    console.log('[ADMIN_CREATE_COLLECTION] Attempting to call program.methods.create_collection on-chain with URI:', uploadedCollectionMetadataUri); // Keep: important action
    
    console.log('[ADMIN_CREATE_COLLECTION] create_collection arguments:', { // Keep: important context
      name: sName as string,
      symbol: sSymbol as string,
      uploadedCollectionMetadataUri,
      mintPriceLamports,
      mintPriceWhiskeyTokens,
      mintPriceUsd: mintPriceUsdMicrodollars,
      itemLimitBN,
    });
    console.log('[ADMIN_CREATE_COLLECTION] create_collection accounts:', { // Keep: important context
      admin: adminWalletPublicKey.toBase58(),
      collectionConfig: collectionConfigPDA.toBase58(),
      collectionMint: collectionMintKeypair.publicKey.toBase58(),
      metadataAccount: metadataAccountPDA.toBase58(),
      masterEditionAccount: masterEditionAccountPDA.toBase58(),
      tokenAccount: tokenAccountPDA.toBase58(),
      tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
      tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID.toBase58(),
      systemProgram: SystemProgram.programId.toBase58(),
      rent: SYSVAR_RENT_PUBKEY.toBase58(),
    });

    // ------------- BEGINNING OF PUBKEY VALIDATION LOGS -------------
    console.log('!!!!!!!!!! VALIDATING PUBKEYS !!!!!!!!!!');
    console.log('admin.publicKey instanceof PublicKey:', adminWalletPublicKey instanceof PublicKey, 'Value:', adminWalletPublicKey?.toBase58());

    console.log('collectionConfigPDA instanceof PublicKey:', collectionConfigPDA instanceof PublicKey, 'Value:', collectionConfigPDA?.toBase58());
    console.log('collectionMintKeypair.publicKey instanceof PublicKey:', collectionMintKeypair.publicKey instanceof PublicKey, 'Value:', collectionMintKeypair.publicKey?.toBase58());
    console.log('metadataAccountPDA instanceof PublicKey:', metadataAccountPDA instanceof PublicKey, 'Value:', metadataAccountPDA?.toBase58());
    console.log('masterEditionAccountPDA instanceof PublicKey:', masterEditionAccountPDA instanceof PublicKey, 'Value:', masterEditionAccountPDA?.toBase58());
    console.log('tokenAccountPDA instanceof PublicKey:', tokenAccountPDA instanceof PublicKey, 'Value:', tokenAccountPDA?.toBase58());
    console.log('TOKEN_PROGRAM_ID instanceof PublicKey:', TOKEN_PROGRAM_ID instanceof PublicKey, 'Value:', TOKEN_PROGRAM_ID?.toBase58());
    console.log('ASSOCIATED_TOKEN_PROGRAM_ID instanceof PublicKey:', ASSOCIATED_TOKEN_PROGRAM_ID instanceof PublicKey, 'Value:', ASSOCIATED_TOKEN_PROGRAM_ID?.toBase58());
    console.log('TOKEN_METADATA_PROGRAM_ID instanceof PublicKey:', MPL_TOKEN_METADATA_PROGRAM_ID instanceof PublicKey, 'Value:', MPL_TOKEN_METADATA_PROGRAM_ID?.toBase58());
    console.log('SystemProgram.programId instanceof PublicKey:', SystemProgram.programId instanceof PublicKey, 'Value:', SystemProgram.programId?.toBase58());
    console.log('SYSVAR_RENT_PUBKEY instanceof PublicKey:', SYSVAR_RENT_PUBKEY instanceof PublicKey, 'Value:', SYSVAR_RENT_PUBKEY?.toBase58());
    console.log('program.programId instanceof PublicKey:', program.programId instanceof PublicKey, 'Value:', program.programId?.toBase58());
    console.log('!!!!!!!!!! FINISHED VALIDATING PUBKEYS !!!!!!!!!!');
    // ------------- END OF PUBKEY VALIDATION LOGS -------------

    console.log('[ADMIN_CREATE_COLLECTION] Manually constructing transaction...'); // Keep: important step
    
    let instruction;
    try {
      instruction = await program.methods
        .createCollection(
          sName as string,
          sSymbol as string,
          uploadedCollectionMetadataUri,
          mintPriceLamports,
          mintPriceWhiskeyTokens,
          mintPriceUsdMicrodollars,
          itemLimitBN
        )
        .accounts({
          admin: adminWalletPublicKey,
          collectionConfig: collectionConfigPDA,
          collectionMint: collectionMintKeypair.publicKey,
          metadataAccount: metadataAccountPDA,
          masterEditionAccount: masterEditionAccountPDA,
          tokenAccount: tokenAccountPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([collectionMintKeypair])
        .instruction();
    } catch (err: any) {
        console.error("[ADMIN_CREATE_COLLECTION] Error building instruction:", err);
        console.error("[ADMIN_CREATE_COLLECTION] Error stack:", err.stack);
        return res.status(500).json({ message: "Error building Solana transaction instruction", error: err.message, details: err.stack });
    }
    

    const transaction = new Transaction();

    // Add instruction to request more compute units
    transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })
    );

    // Add the main create_collection instruction
    transaction.add(instruction);

    transaction.feePayer = adminWalletPublicKey;

    console.log('[ADMIN_CREATE_COLLECTION] Transaction created, feePayer:', transaction.feePayer?.toBase58());

    // Get a fresh blockhash for the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    console.log('[ADMIN_CREATE_COLLECTION] Set recent blockhash:', blockhash);

    // Sign the transaction with the collection mint keypair (server-side signing)
    transaction.partialSign(collectionMintKeypair);
    console.log('[ADMIN_CREATE_COLLECTION] Transaction partially signed with collection mint keypair');

    // Serialize the transaction for the client to sign
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false, // Allow partial signing
      verifySignatures: false
    });

    // Prepare collection data for saving after successful transaction
    const collectionData = {
      name: sName as string,
      symbol: sSymbol as string,
      description: sDescription as string,
      collectionOnChainAddress: collectionConfigPDA.toBase58(),
      collectionMintAddress: collectionMintKeypair.publicKey.toBase58(),
      metadataUri: uploadedCollectionMetadataUri,
      nftBaseMetadataUri: uploadedNftBaseMetadataUri,
      nftBaseName: sNftBaseName as string,
      mintPriceLamports: mintPriceLamports.toNumber(),
      mintPriceUsd: parseFloat(sMintPriceUsd as string),
      itemLimit: parseInt(sItemLimit as string),
      companyId: company._id,
      isActive: true,
      authority: adminWalletPublicKey.toBase58(),
      collectionMintKeypair: Array.from(collectionMintKeypair.secretKey), // Include the keypair for re-signing
    };

    console.log("[ADMIN_CREATE_COLLECTION] Returning unsigned transaction for client signing");

    res.status(200).json({
      message: 'Transaction prepared successfully. Please sign with your wallet.',
      transaction: Buffer.from(serializedTransaction).toString('base64'),
      collectionData,
      collectionConfigPDA: collectionConfigPDA.toBase58(),
      needsWalletSignature: true,
      collectionMetadataUri: uploadedCollectionMetadataUri,
    });

  } catch (error: any) {
    console.error('[ADMIN_CREATE_COLLECTION] Error caught in POST handler.', error);
    console.error('[ADMIN_CREATE_COLLECTION] Full error object:', error);
    console.error('[ADMIN_CREATE_COLLECTION] Stack trace:', error.stack);
    res.status(500).json({ 
        message: 'Internal Server Error', 
        error: error.message, 
        details: error.toString(),
        stack: error.stack,
        errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)) // Attempt to serialize more error details
    });
  }
} 