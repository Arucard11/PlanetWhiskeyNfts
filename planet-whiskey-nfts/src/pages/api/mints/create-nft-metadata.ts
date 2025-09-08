import { NextApiRequest, NextApiResponse } from 'next';
import PinataClient from '@pinata/sdk';

const pinata = new PinataClient(process.env.PINATA_API_KEY!, process.env.PINATA_SECRET_API_KEY!);

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
      return res.status(400).json({ message: 'Missing required metadata fields' });
    }

    console.log('[CREATE_NFT_METADATA] Creating metadata for:', {
      nftName,
      collectionName,
      mintNumber,
      imageUrl: nftImageUrl
    });

    // Create the NFT metadata object following Metaplex standard
    const metadata: NFTMetadata = {
      name: nftName,
      symbol: nftSymbol,
      description: nftDescription,
      image: nftImageUrl,
      attributes: attributes || [],
      collection: {
        name: collectionName,
        family: collectionFamily || "Planet Whiskey NFTs"
      },
      properties: {
        files: [
          {
            uri: nftImageUrl,
            type: nftImageUrl.includes('.mp4') ? "video/mp4" : 
                  nftImageUrl.includes('.gif') ? "image/gif" : "image/png"
          }
        ],
        category: "image",
        creators: [
          {
            address: creatorAddress || process.env.NEXT_PUBLIC_ADMIN_WALLET || "2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk", // Default admin wallet
            share: 100
          }
        ]
      }
    };

    console.log('[CREATE_NFT_METADATA] Creating metadata for NFT:', nftName);

    // Upload metadata to IPFS via Pinata
    const pinataResponse = await pinata.pinJSONToIPFS(metadata, {
      pinataMetadata: {
        name: `${nftName}_metadata.json`,
        keyvalues: {
          collection: collectionName,
          type: 'nft_metadata',
          mintNumber: mintNumber?.toString() || 'unknown',
          timestamp: mintTimestamp?.toString() || Date.now().toString()
        }
      }
    });

    const metadataUri = `ipfs://${pinataResponse.IpfsHash}`;
    
    console.log('[CREATE_NFT_METADATA] Metadata uploaded to IPFS:', metadataUri);

    return res.status(200).json({
      success: true,
      metadataUri,
      ipfsHash: pinataResponse.IpfsHash,
      metadata
    });

  } catch (error: any) {
    console.error('[CREATE_NFT_METADATA] Error creating NFT metadata:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create NFT metadata',
      error: error.message
    });
  }
}
