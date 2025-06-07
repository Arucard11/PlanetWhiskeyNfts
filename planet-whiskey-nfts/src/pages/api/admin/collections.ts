import type { NextApiRequest, NextApiResponse } from 'next';
import {promises as fs} from 'fs';
import path from 'path';
import formidable from 'formidable'; // Use 'formidable' instead of 'formidable-serverless'
import { Writable, Readable } from 'stream';
import { getAdminSolanaProgram, adminKeypair as actualAdminKeypair } from '../../../lib/solanaUtils'; // Assuming adminKeypair is exported for payer
import { Keypair, PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY, sendAndConfirmTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { BN, Program } from '@coral-xyz/anchor';
import { Whiskeyprogram as SolanaProgram } from '../../../lib/idl/solana_program';
import PinataClient from '@pinata/sdk';
import connectToDatabase from '../../../lib/mongodb';
import Company from '../../../models/Company';
import NftCollection from '../../../models/NftCollection';

// console.log("DEBUG: PINATA_API_KEY from env:", process.env.PINATA_API_KEY); // Removed
// console.log("DEBUG: PINATA_SECRET_API_KEY from env:", process.env.PINATA_SECRET_API_KEY); // Removed
const pinata = new PinataClient(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

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
      name,
      symbol,
      collectionDescription,
      mintPriceSOL,
      itemLimit,
      companyId,
      nftBaseName, // e.g., "Whiskey Barrel #{ID}"
      nftBaseDescription,
      // Attributes will be an array of { trait_type: string, value: string }
      // It needs to be parsed from JSON string if sent as such
    } = fields;

    // Handle potential string[] from formidable, ensure single string values
    const sName = Array.isArray(name) ? name[0] : name;
    const sSymbol = Array.isArray(symbol) ? symbol[0] : symbol;
    const sDescription = Array.isArray(collectionDescription) ? collectionDescription[0] : collectionDescription;
    const sMintPriceSOL = Array.isArray(mintPriceSOL) ? mintPriceSOL[0] : mintPriceSOL;
    const sItemLimit = Array.isArray(itemLimit) ? itemLimit[0] : itemLimit;
    const sCompanyId = Array.isArray(companyId) ? companyId[0] : companyId;
    const sNftBaseName = (Array.isArray(nftBaseName) ? nftBaseName[0] : nftBaseName) ?? '' as string;
    const sNftBaseDescription = (Array.isArray(nftBaseDescription) ? nftBaseDescription[0] : nftBaseDescription) ?? '' as string;
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
        sMintPriceSOL,
        sItemLimit,
        sCompanyId,
        sNftBaseName,
        sNftBaseDescription
    });

    // Basic Validations
    if (!sName || !sSymbol || !sDescription || !sMintPriceSOL || !sItemLimit || !sCompanyId || !sNftBaseName || !sNftBaseDescription) {
      return res.status(400).json({ message: 'Missing required fields. Ensure name, symbol, description, mint price, item limit, company ID, NFT base name, and NFT base description are provided.' });
    }

    // console.log("[ADMIN_CREATE_COLLECTION] Checking uploaded files. collectionImageFile:", files.collectionImageFile); // Removed
    // console.log("[ADMIN_CREATE_COLLECTION] nftBaseImageFile:", files.nftBaseImageFile); // Removed

    if (!files.collectionImageFile || !files.nftBaseImageFile) {
        return res.status(400).json({ message: 'Missing collection image or NFT base image.' });
    }
    // console.log("[ADMIN_CREATE_COLLECTION] Input validation passed for basic fields."); // Removed

    const collectionImageFile = (Array.isArray(files.collectionImageFile) ? files.collectionImageFile[0] : files.collectionImageFile) as formidable.File;
    const nftBaseImageFile = (Array.isArray(files.nftBaseImageFile) ? files.nftBaseImageFile[0] : files.nftBaseImageFile) as formidable.File;

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

    // --- 3. Interact with Solana Program ---
    const program = getAdminSolanaProgram();

    console.log("ACTUAL PROGRAM ID BEING USED BY API:", program.programId.toBase58());

    if (!program.provider.wallet) {
      console.error("[ADMIN_CREATE_COLLECTION] Critical error: Provider wallet is not initialized. Check solanaUtils.ts and provider setup.");
      return res.status(500).json({ message: 'Provider wallet not available. Server configuration issue.' });
    }
    const adminWalletPublicKey = program.provider.wallet.publicKey; // This is the public key of the admin

    // Ensure the actualAdminKeypair (the one that will sign) is available
    if (!actualAdminKeypair) {
      console.error("[ADMIN_CREATE_COLLECTION] Critical error: Admin keypair is not loaded. Check ADMIN_WALLET_PRIVATE_KEY env var.");
      return res.status(500).json({ message: 'Admin keypair not available. Server configuration issue.' });
    }

    // This keypair is for the *new collection's mint account itself*, NOT the fee payer.
    const collectionMintKeypair = Keypair.generate();

    // Log the public key of the admin wallet that will pay fees
    console.log("Admin wallet (fee payer) public key:", adminWalletPublicKey.toBase58());
    console.log("New Collection Mint public key:", collectionMintKeypair.publicKey.toBase58());

    // Derive PDAs
    console.log('[ADMIN_CREATE_COLLECTION] Deriving PDAs...');
    const programAdminConfigSeedString = "program_super_admin";
    const programAdminConfigSeedBuffer = Buffer.from(programAdminConfigSeedString);
    // console.log(`[DEBUG] Seed for programAdminConfigPDA: "${programAdminConfigSeedString}", Buffer:`, programAdminConfigSeedBuffer.toString('hex')); // Optional: if program_admin_config was an issue

    const [programAdminConfigPDA] = await PublicKey.findProgramAddress(
        [programAdminConfigSeedBuffer],
        program.programId
    );
    // console.log(`[DEBUG] programAdminConfigPDA: ${programAdminConfigPDA.toBase58()}`);


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
        { programAdminConfigPDA: programAdminConfigPDA.toBase58(), 
          collectionConfigPDA: collectionConfigPDA.toBase58(),
          metadataAccountPDA: metadataAccountPDA.toBase58(),
          masterEditionAccountPDA: masterEditionAccountPDA.toBase58(),
          tokenAccountPDA: tokenAccountPDA.toBase58()
        }
    );


    const mintPriceLamports = new BN(parseFloat(sMintPriceSOL as string) * 1_000_000_000); // Convert SOL to lamports
    const itemLimitBN = new BN(parseInt(sItemLimit as string));
    console.log('[ADMIN_CREATE_COLLECTION] Converted mintPriceSOL to lamports:', mintPriceLamports.toString(), 'itemLimit to BN:', itemLimitBN.toString());


    console.log('[ADMIN_CREATE_COLLECTION] Attempting to call program.methods.create_collection on-chain with URI:', uploadedCollectionMetadataUri); // Keep: important action
    
    console.log('[ADMIN_CREATE_COLLECTION] create_collection arguments:', { // Keep: important context
      name: sName as string,
      symbol: sSymbol as string,
      uploadedCollectionMetadataUri,
      mintPriceLamports,
      itemLimitBN,
    });
    console.log('[ADMIN_CREATE_COLLECTION] create_collection accounts:', { // Keep: important context
      payer: adminWalletPublicKey.toBase58(),
      programAdminConfig: programAdminConfigPDA.toBase58(),
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
    console.log('payer.publicKey instanceof PublicKey:', adminWalletPublicKey instanceof PublicKey, 'Value:', adminWalletPublicKey?.toBase58());
    console.log('programAdminConfigPDA instanceof PublicKey:', programAdminConfigPDA instanceof PublicKey, 'Value:', programAdminConfigPDA?.toBase58());
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
          itemLimitBN
        )
        .accounts({
          payer: adminWalletPublicKey,
          programAdminConfig: programAdminConfigPDA,
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
        .signers([actualAdminKeypair, collectionMintKeypair])
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
    const connection = program.provider.connection;

    console.log('[ADMIN_CREATE_COLLECTION] Transaction created, feePayer:', transaction.feePayer?.toBase58());

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [actualAdminKeypair, collectionMintKeypair],
      { commitment: 'confirmed' } 
    );

    // --- 4. Save collection to MongoDB ---
    const newCollection = new NftCollection({
      name: sName as string,
      symbol: sSymbol as string,
      collectionOnChainAddress: collectionConfigPDA.toBase58(), // This is the CollectionConfig PDA
      collectionMintAddress: collectionMintKeypair.publicKey.toBase58(),    // This is the actual Collection NFT Mint address
      metadataUri: uploadedCollectionMetadataUri,              // Schema field: metadataUri
      nftBaseMetadataUri: uploadedNftBaseMetadataUri,       // Schema field: nftBaseMetadataUri
      mintPriceLamports: mintPriceLamports.toNumber(),   // Schema field: mintPriceLamports (Number)
      itemLimit: parseInt(sItemLimit as string),             // Schema field: itemLimit
      companyId: company._id,                            // Schema field: companyId (ObjectId)
      isActive: true,                                    // Schema field: isActive
      authority: adminWalletPublicKey.toBase58(), // Added authority field
    });
    await newCollection.save();

    console.log("[ADMIN_CREATE_COLLECTION] Transaction Signature for on-chain creation:", signature);

    res.status(201).json({
      message: 'Collection created successfully on-chain and in DB.',
      collectionId: newCollection._id,
      onChainAddress: collectionMintKeypair.publicKey.toBase58(), // Return the actual Collection NFT mint address to the client
      transactionSignature: signature,
      collectionMetadataUri: uploadedCollectionMetadataUri, // Add the metadata URI to the response
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