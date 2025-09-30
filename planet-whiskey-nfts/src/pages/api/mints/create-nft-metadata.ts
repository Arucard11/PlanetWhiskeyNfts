import { NextApiRequest, NextApiResponse } from 'next';
import PinataClient from '@pinata/sdk';
import { getBestNftImageUri, isWalletCompatibleImageUrl, testImageAccessibility } from '@/lib/imageUrlUtils';

// Check if Pinata environment variables are available
if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
  console.error('[CREATE_NFT_METADATA] Missing Pinata environment variables');
}

const pinata = new PinataClient(process.env.PINATA_API_KEY!, process.env.PINATA_SECRET_KEY!);

interface NFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  collection: {
    name: string;
    family: string;
  };
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check Pinata configuration first
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_KEY) {
    console.error('[CREATE_NFT_METADATA] Missing Pinata environment variables');
    return res.status(500).json({
      success: false,
      message: 'Image storage service not configured',
      error: 'Missing Pinata API credentials'
    });
  }

  try {
    const {
      nftName,
      nftSymbol,
      nftDescription,
      nftImageUrl,
      attributes,
      collectionName,
      collectionFamily,
      mintNumber,
      mintTimestamp,
      creatorAddress
    } = req.body;

    if (!nftName || !nftSymbol || !nftDescription || !nftImageUrl || !collectionName) {
      return res.status(400).json({ message: 'Missing required metadata fields. All fields including nftImageUrl are required.' });
    }

    // Convert proxy URL to wallet-compatible IPFS URI
    let walletCompatibleImageUri = getBestNftImageUri(nftImageUrl, nftName);
    
    console.log('[CREATE_NFT_METADATA] Image URI conversion:', {
      original: nftImageUrl,
      walletCompatible: walletCompatibleImageUri,
      isCompatible: isWalletCompatibleImageUrl(walletCompatibleImageUri)
    });
    
    // Validate that we have a wallet-compatible image URI
    if (!isWalletCompatibleImageUrl(walletCompatibleImageUri)) {
      return res.status(400).json({ 
        message: 'Image URI is not compatible with wallets like Phantom. Please provide an IPFS URI (ipfs://) or public HTTP/HTTPS URL.',
        details: {
          providedUrl: nftImageUrl,
          convertedUri: walletCompatibleImageUri,
          isCompatible: false
        }
      });
    }

    // Test image accessibility (only for HTTP URLs, IPFS URIs are handled by wallets)
    if (walletCompatibleImageUri.startsWith('http')) {
      try {
        const isAccessible = await testImageAccessibility(walletCompatibleImageUri);
        if (!isAccessible) {
          console.warn('[CREATE_NFT_METADATA] HTTP image may not be accessible:', walletCompatibleImageUri);
          // Don't fail here, just warn - the image might still work in wallets
        }
      } catch (error) {
        console.warn('[CREATE_NFT_METADATA] Could not test HTTP image accessibility:', error);
      }
    }

    console.log('[CREATE_NFT_METADATA] Creating metadata for:', {
      nftName,
      collectionName,
      mintNumber,
      originalImageUrl: nftImageUrl,
      walletCompatibleImageUri: walletCompatibleImageUri
    });

    // Create the NFT metadata object following Metaplex standard
    const metadata: NFTMetadata = {
      name: nftName,
      symbol: nftSymbol,
      description: nftDescription,
      image: walletCompatibleImageUri, // Use wallet-compatible IPFS URI
      attributes: attributes || [],
      collection: {
        name: collectionName,
        family: collectionFamily || "Planet Whiskey NFTs"
      },
      properties: {
        files: [
          {
            uri: walletCompatibleImageUri, // Use wallet-compatible IPFS URI
            type: walletCompatibleImageUri.includes('.mp4') ? "video/mp4" : 
                  walletCompatibleImageUri.includes('.gif') ? "image/gif" : "image/png"
          }
        ],
        category: "image",
        creators: [
          {
            address: creatorAddress || process.env.NEXT_PUBLIC_ADMIN_WALLET || "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X", // Default admin wallet
            share: 100
          }
        ]
      }
    };

    console.log('[CREATE_NFT_METADATA] Creating metadata for NFT:', nftName);
    console.log('[CREATE_NFT_METADATA] Full metadata object:', JSON.stringify(metadata, null, 2));

    // Upload metadata to IPFS via Pinata
    console.log('[CREATE_NFT_METADATA] Uploading to Pinata...');
    const pinataResponse = await pinata.pinJSONToIPFS(metadata, {
      pinataMetadata: {
        name: `${nftName}_metadata.json`
      }
    });

    const metadataUri = `ipfs://${pinataResponse.IpfsHash}`;
    
    console.log('[CREATE_NFT_METADATA] Pinata response:', JSON.stringify(pinataResponse, null, 2));
    console.log('[CREATE_NFT_METADATA] Metadata uploaded to IPFS:', metadataUri);
    
    // Test if the uploaded metadata is immediately accessible
    try {
      console.log('[CREATE_NFT_METADATA] Testing immediate access via Pinata gateway...');
      const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud';
      const testUrl = `${pinataGateway}/ipfs/${pinataResponse.IpfsHash}`;
      const testResponse = await fetch(testUrl);
      console.log('[CREATE_NFT_METADATA] Test fetch status:', testResponse.status);
      if (testResponse.ok) {
        const testData = await testResponse.json();
        console.log('[CREATE_NFT_METADATA] ✅ Metadata immediately accessible via Pinata gateway');
      } else {
        console.log('[CREATE_NFT_METADATA] ⚠️ Metadata not immediately accessible via Pinata gateway');
      }
    } catch (testError) {
      console.log('[CREATE_NFT_METADATA] ❌ Error testing immediate access:', testError);
    }

    return res.status(200).json({
      success: true,
      metadataUri,
      ipfsHash: pinataResponse.IpfsHash,
      metadata
    });

  } catch (error: any) {
    console.error('[CREATE_NFT_METADATA] Error creating NFT metadata:', error);
    
    // Check if this is a Pinata usage limit issue - if so, try fallback
    if (error.reason === 'FORBIDDEN' && error.details?.includes('Account blocked')) {
      console.log('[CREATE_NFT_METADATA] Pinata blocked - attempting fallback method...');
      
      try {
        // Use fallback method - create metadata without IPFS
        const metadata = {
          name: req.body.nftName,
          symbol: req.body.nftSymbol,
          description: req.body.nftDescription,
          image: req.body.nftImageUrl,
          attributes: req.body.attributes || [],
          collection: {
            name: req.body.collectionName,
            family: req.body.collectionFamily || "Planet Whiskey NFTs"
          },
          properties: {
            files: [
              {
                uri: req.body.nftImageUrl,
                type: req.body.nftImageUrl.includes('.mp4') ? "video/mp4" : 
                      req.body.nftImageUrl.includes('.gif') ? "image/gif" : "image/png"
              }
            ],
            category: "image",
            creators: [
              {
                address: req.body.creatorAddress || process.env.NEXT_PUBLIC_ADMIN_WALLET || "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X",
                share: 100
              }
            ]
          }
        };

        // Generate a unique metadata hash
        const metadataString = JSON.stringify(metadata);
        const hash = Buffer.from(metadataString).toString('base64url').substring(0, 46);
        
        // Create a data URI with the metadata
        const dataUri = `data:application/json;base64,${Buffer.from(metadataString).toString('base64')}`;
        
        console.log('[CREATE_NFT_METADATA] ✅ Using fallback metadata storage');
        
        return res.status(200).json({
          success: true,
          metadataUri: dataUri,
          ipfsHash: hash,
          metadata,
          fallback: true,
          warning: 'Using temporary metadata storage due to service limits'
        });
        
      } catch (fallbackError) {
        console.error('[CREATE_NFT_METADATA] Fallback method also failed:', fallbackError);
      }
    }
    
    // Provide specific error messages for other cases
    let userMessage = 'Failed to create NFT metadata';
    if (error.reason === 'FORBIDDEN' && error.details?.includes('Account blocked')) {
      userMessage = 'Image storage service temporarily unavailable due to usage limits';
      console.error('[CREATE_NFT_METADATA] Pinata account blocked due to usage limits');
    } else if (error.message?.includes('API key') || error.message?.includes('unauthorized')) {
      userMessage = 'Image storage service unavailable';
      console.error('[CREATE_NFT_METADATA] Pinata API key issue');
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      userMessage = 'Network error - try again';
    } else if (error.message?.includes('timeout')) {
      userMessage = 'Upload timeout - try again';
    }
    
    return res.status(500).json({
      success: false,
      message: userMessage,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
