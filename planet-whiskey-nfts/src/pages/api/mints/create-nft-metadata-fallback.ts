import { NextApiRequest, NextApiResponse } from 'next';

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
      return res.status(400).json({ message: 'Missing required metadata fields. All fields including nftImageUrl are required.' });
    }

    // Validate that we have a real image URL, not a local placeholder
    if (nftImageUrl === '/placeholder-image.svg') {
      return res.status(400).json({ message: 'Cannot create NFT metadata with local placeholder image. A real image URL is required.' });
    }

    console.log('[CREATE_NFT_METADATA_FALLBACK] Creating metadata for:', {
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
            address: creatorAddress || process.env.NEXT_PUBLIC_ADMIN_WALLET || "F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X",
            share: 100
          }
        ]
      }
    };

    // Generate a unique metadata hash based on content
    const metadataString = JSON.stringify(metadata);
    const hash = Buffer.from(metadataString).toString('base64url').substring(0, 46);
    
    // Create a data URI with the metadata (temporary solution)
    const dataUri = `data:application/json;base64,${Buffer.from(metadataString).toString('base64')}`;
    
    console.log('[CREATE_NFT_METADATA_FALLBACK] ⚠️ Using fallback metadata storage');
    console.log('[CREATE_NFT_METADATA_FALLBACK] Metadata hash:', hash);

    return res.status(200).json({
      success: true,
      metadataUri: dataUri,
      ipfsHash: hash,
      metadata,
      fallback: true,
      warning: 'Using temporary metadata storage. This is not suitable for production.'
    });

  } catch (error: any) {
    console.error('[CREATE_NFT_METADATA_FALLBACK] Error creating NFT metadata:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to create fallback metadata',
      error: error.message
    });
  }
}
