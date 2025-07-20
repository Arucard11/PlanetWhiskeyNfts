import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import MarketplaceListing from '@/models/MarketplaceListing';
import NftCollection from '@/models/NftCollection';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

// Multiple IPFS gateways as fallbacks
const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',  // Primary gateway
  'https://ipfs.io/ipfs/',              // Public IPFS gateway
  'https://cloudflare-ipfs.com/ipfs/',  // Cloudflare IPFS gateway
  'https://dweb.link/ipfs/',            // Protocol Labs gateway
];

const ipfsToPinataUrl = (uri: string): string => {
  if (!uri || !uri.startsWith('ipfs://')) {
    return uri;
  }
  const hash = uri.substring(7);
  return `${IPFS_GATEWAYS[0]}${hash}`;  // Use primary gateway
};

// Try multiple IPFS gateways if one fails
const fetchMetadataWithFallback = async (uri: string): Promise<any | null> => {
  if (!uri || !uri.startsWith('ipfs://')) {
    try {
      const response = await fetch(uri);
      if (response.ok) return await response.json();
    } catch (error) {
      console.error(`Failed to fetch non-IPFS metadata: ${uri}`, error);
    }
    return null;
  }

  const hash = uri.substring(7);
  
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gatewayUrl = `${IPFS_GATEWAYS[i]}${hash}`;
    try {
      console.log(`[my-listings] Trying gateway ${i + 1}/${IPFS_GATEWAYS.length}: ${gatewayUrl}`);
      const response = await fetch(gatewayUrl, {
        headers: {
          'Accept': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[my-listings] Successfully fetched metadata from gateway ${i + 1}`);
        return data;
      }
    } catch (error) {
      console.warn(`[my-listings] Gateway ${i + 1} failed for ${uri}:`, error);
      continue;
    }
  }
  
  console.error(`[my-listings] All gateways failed for ${uri}`);
  return null;
};

// Function to verify if a listing still exists on-chain
async function verifyListingExistsOnChain(
  sellerAddress: string, 
  nftMintAddress: string
): Promise<boolean> {
  try {
    const program = getMarketplaceProgram();
    const seller = new PublicKey(sellerAddress);
    const nftMint = new PublicKey(nftMintAddress);
    
    const [listingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), seller.toBuffer(), nftMint.toBuffer()],
      program.programId
    );
    
    await program.account.marketplaceListing.fetch(listingPda);
    return true;
  } catch (error) {
    return false;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  const { walletAddress } = req.query;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return res.status(400).json({ success: false, message: 'Wallet address is required.' });
  }

  console.log(`[my-listings] Fetching listings for wallet: ${walletAddress}`);

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ success: false, message: 'Server configuration error: SOLANA_RPC_URL is not set.' });
  }

  try {
    await dbConnect();

    const connection = new Connection(rpcUrl, 'confirmed');
    const metaplex = Metaplex.make(connection);

    // Get all active listings for this wallet
    const listings = await MarketplaceListing.find({ 
      sellerWalletAddress: walletAddress,
      listingStatus: 'active'
    }).sort({ createdAt: -1 }).lean();

    console.log(`[my-listings] Found ${listings.length} active listings in database`);

    // Verify each listing still exists on-chain and get NFT metadata
    const verifiedListings = await Promise.all(
      listings.map(async (listing) => {
        try {
          // Verify the listing still exists on-chain
          const onChainExists = await verifyListingExistsOnChain(
            listing.sellerWalletAddress, 
            listing.nftMintAddress
          );

          if (!onChainExists) {
            console.log(`[my-listings] Listing ${listing.nftMintAddress} no longer exists on-chain, skipping`);
            // Optionally update the database to mark as cancelled
            await MarketplaceListing.findByIdAndUpdate(
              listing._id,
              { listingStatus: 'cancelled' }
            );
            return null;
          }

          // Get NFT metadata
          const nftMint = new PublicKey(listing.nftMintAddress);
          const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint });
          
          let loadedJson = nft.json;
          if (!loadedJson) {
            loadedJson = await fetchMetadataWithFallback(nft.uri);
          }

          // Get collection info
          const collection = await NftCollection.findOne({ 
            collectionMintAddress: listing.collectionMintAddress 
          }).lean();

          return {
            ...listing,
            _id: listing._id.toString(),
            nftName: loadedJson?.name || 'Unknown NFT',
            nftImageUrl: loadedJson?.image || '',
            collectionName: collection?.name || 'Unknown Collection',
            priceInWhiskey: listing.priceInWhiskey,
          };
        } catch (error) {
          console.error(`[my-listings] Error processing listing ${listing.nftMintAddress}:`, error);
          return null;
        }
      })
    );

    const validListings = verifiedListings.filter(listing => listing !== null);
    
    console.log(`[my-listings] Returning ${validListings.length} verified listings`);

    res.status(200).json({ 
      success: true, 
      data: validListings
    });

  } catch (error: any) {
    console.error(`[my-listings] Error fetching listings for wallet ${walletAddress}:`, error);
    res.status(500).json({ success: false, message: 'Failed to fetch listings.', error: error.message });
  }
}

export default handler; 