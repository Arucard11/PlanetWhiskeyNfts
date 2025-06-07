import { NextApiRequest, NextApiResponse } from 'next';
import PinataClient from '@pinata/sdk';

// Initialize Pinata
const pinata = new PinataClient(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

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
      attributes = [],
      collectionName,
      collectionFamily,
      mintNumber 
    } = req.body;

    // Validate required fields
    if (!nftName || !nftSymbol || !nftDescription || !nftImageUrl) {
      return res.status(400).json({ 
        message: 'Missing required fields: nftName, nftSymbol, nftDescription, nftImageUrl' 
      });
    }

    console.log(`[CREATE_NFT_METADATA] Creating metadata for ${nftName}...`);

    // Determine the image URL - if nftImageUrl looks like a metadata URI, fetch it to get the image
    let finalImageUrl = nftImageUrl;
    
    // If the provided URL looks like it might be a metadata URI (contains ipfs:// or ends with .json), 
    // try to fetch it to extract the actual image URL
    if (nftImageUrl.includes('ipfs://') && (nftImageUrl.endsWith('.json') || !nftImageUrl.includes('.'))) {
      try {
        console.log(`[CREATE_NFT_METADATA] Attempting to extract image from metadata URI: ${nftImageUrl}`);
        const baseMetadataUrl = nftImageUrl.startsWith('ipfs://') 
          ? nftImageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
          : nftImageUrl;
          
        console.log(`[CREATE_NFT_METADATA] Fetching metadata from gateway URL: ${baseMetadataUrl}`);
        const baseMetadataResponse = await fetch(baseMetadataUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (baseMetadataResponse.ok) {
          const baseMetadata = await baseMetadataResponse.json();
          console.log(`[CREATE_NFT_METADATA] Successfully fetched base metadata:`, baseMetadata);
          
          if (baseMetadata.image) {
            finalImageUrl = baseMetadata.image;
            console.log(`[CREATE_NFT_METADATA] ✅ Successfully extracted image URL: ${finalImageUrl}`);
          } else {
            console.warn(`[CREATE_NFT_METADATA] ⚠️ No 'image' field found in base metadata. Available fields:`, Object.keys(baseMetadata));
            console.log(`[CREATE_NFT_METADATA] Using original URL as image: ${nftImageUrl}`);
          }
        } else {
          console.warn(`[CREATE_NFT_METADATA] ⚠️ Failed to fetch base metadata: ${baseMetadataResponse.status} ${baseMetadataResponse.statusText}`);
          console.log(`[CREATE_NFT_METADATA] Using original URL as image: ${nftImageUrl}`);
        }
      } catch (error) {
        console.error(`[CREATE_NFT_METADATA] ❌ Error fetching base metadata:`, error);
        console.log(`[CREATE_NFT_METADATA] Using original URL as image: ${nftImageUrl}`);
      }
    } else {
      console.log(`[CREATE_NFT_METADATA] URL appears to be a direct image URL, using as-is: ${nftImageUrl}`);
    }

    // Ensure the final image URL uses a reliable IPFS gateway for better wallet compatibility
    if (finalImageUrl.startsWith('ipfs://')) {
      finalImageUrl = finalImageUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
      console.log(`[CREATE_NFT_METADATA] Converted IPFS URL to gateway URL: ${finalImageUrl}`);
    }

    // Detect file type based on URL extension
    const getFileType = (url: string): string => {
      const ext = url.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'png':
          return 'image/png';
        case 'gif':
          return 'image/gif';
        case 'webp':
          return 'image/webp';
        case 'svg':
          return 'image/svg+xml';
        default:
          return 'image/png'; // Default fallback
      }
    };

    // Create Metaplex-compliant metadata JSON following the standard format
    const nftMetadata = {
      name: nftName,
      symbol: nftSymbol,
      description: nftDescription,
      image: finalImageUrl,
      external_url: "", // Optional: website URL
      attributes: attributes,
      properties: {
        files: [
          {
            uri: finalImageUrl,
            type: getFileType(finalImageUrl)
          }
        ],
        category: "image",
        creators: [] // Will be populated by the Solana program
      }
    };

    // Add collection info if provided (this helps with wallet grouping)
    if (collectionName) {
      nftMetadata.collection = {
        name: collectionName,
        family: collectionFamily || collectionName
      };
    }

    console.log(`[CREATE_NFT_METADATA] Final metadata structure:`, JSON.stringify(nftMetadata, null, 2));

    // Verify image accessibility before uploading metadata
    try {
      console.log(`[CREATE_NFT_METADATA] Verifying image accessibility: ${finalImageUrl}`);
      const imageResponse = await fetch(finalImageUrl, { method: 'HEAD' });
      if (!imageResponse.ok) {
        console.warn(`[CREATE_NFT_METADATA] Warning: Image URL may not be accessible (${imageResponse.status}): ${finalImageUrl}`);
      } else {
        console.log(`[CREATE_NFT_METADATA] ✅ Image URL is accessible`);
      }
    } catch (error) {
      console.warn(`[CREATE_NFT_METADATA] Warning: Could not verify image accessibility:`, error.message);
    }

    console.log(`[CREATE_NFT_METADATA] Uploading metadata to IPFS...`);

    // Upload metadata JSON to IPFS
    const result = await pinata.pinJSONToIPFS(nftMetadata, {
      pinataMetadata: { 
        name: `${nftName.replace(/\s+/g, '_')}_metadata_${Date.now()}.json` 
      }
    });

    const metadataUri = `ipfs://${result.IpfsHash}`;

    console.log(`[CREATE_NFT_METADATA] Metadata uploaded successfully: ${metadataUri}`);
    console.log(`[CREATE_NFT_METADATA] Accessible via gateway: https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);

    return res.status(200).json({
      success: true,
      metadataUri,
      ipfsHash: result.IpfsHash,
      metadata: nftMetadata,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
    });

  } catch (error: any) {
    console.error('[CREATE_NFT_METADATA] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to create NFT metadata',
      error: error.message 
    });
  }
} 