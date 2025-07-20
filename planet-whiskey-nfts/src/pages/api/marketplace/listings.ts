import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import MarketplaceListing from '../../../models/MarketplaceListing';
import NftCollection from '@/models/NftCollection';
import { getMarketplaceProgram } from '@/lib/solanaUtils';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

const ipfsToPinataUrl = (uri: string): string => {
  if (!uri || typeof uri !== 'string') return ''; // Return empty string for invalid input
  if (uri.startsWith('http')) return uri; // Return as-is if it's already a URL
  if (!uri.startsWith('ipfs://')) {
    return uri; // Return original if not an IPFS URI
  }
  const hash = uri.substring(7);
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
};

async function verifyListingExistsOnChain(
  connection: Connection, 
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
    const listingAccount = await program.account.marketplaceListing.fetch(listingPda);
    return !!listingAccount;
  } catch (error) {
    return false;
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { collectionMint } = req.query;

  await dbConnect();
  
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return res.status(500).json({ success: false, message: 'Server configuration error: SOLANA_RPC_URL is not set.' });
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const metaplex = Metaplex.make(connection);

  if (method === 'GET') {
    if (collectionMint) {
      try {
        const listings = await MarketplaceListing.find({ 
          listingStatus: 'active',
          collectionMintAddress: collectionMint as string 
        }).sort({ createdAt: -1 }).lean();

        const collection = await NftCollection.findOne({ collectionMintAddress: collectionMint as string }).lean();

        const augmentedListings = await Promise.all(
          listings.map(async (listing) => {
            try {
              const onChainExists = await verifyListingExistsOnChain(connection, listing.sellerWalletAddress, listing.nftMintAddress);
              if (!onChainExists) return null;
              
              const nftMint = new PublicKey(listing.nftMintAddress);
              const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint });
              
              let loadedJson = nft.json;
              if (!loadedJson) {
                // Use the conversion ONLY to fetch the metadata
                const metadataUrl = ipfsToPinataUrl(nft.uri);
                const response = await fetch(metadataUrl);
                if (response.ok) loadedJson = await response.json();
              }

              return {
                ...listing,
                _id: listing._id.toString(),
                nftName: loadedJson?.name || 'Unknown NFT',
                nftImageUrl: loadedJson?.image || '/placeholder-image.svg',
                collectionName: collection?.name || loadedJson?.collection?.name || 'Unknown',
              };
            } catch (e) {
              console.error(`Error loading NFT metadata for ${listing.nftMintAddress}:`, e);
              return null;
            }
          })
        );

        const validListings = augmentedListings.filter(listing => listing !== null);
        
        let collectionImageUrl;
        if (collection?.metadataUri) {
            // Use the conversion ONLY to fetch the metadata
            const metadataResponse = await fetch(ipfsToPinataUrl(collection.metadataUri));
            if (metadataResponse.ok) {
                const collectionJson = await metadataResponse.json();
                collectionImageUrl = collectionJson.image || ''; // Use the image URL directly
            }
        }
        
        res.status(200).json({ 
          success: true, 
          data: {
            listings: validListings,
            collectionInfo: {
              name: collection?.name,
              imageUrl: collectionImageUrl || '/placeholder-image.svg'
            }
          } 
        });
      } catch (error) {
        res.status(400).json({ success: false, message: "Could not fetch collection listings." });
      }
    } else {
      try {
        const allActiveListings = await MarketplaceListing.find({ listingStatus: 'active' }).lean();
        
        const verifiedCollectionCounts = new Map<string, number>();
        for (const listing of allActiveListings) {
          const onChainExists = await verifyListingExistsOnChain(connection, listing.sellerWalletAddress, listing.nftMintAddress);
          if (onChainExists) {
            const currentCount = verifiedCollectionCounts.get(listing.collectionMintAddress) || 0;
            verifiedCollectionCounts.set(listing.collectionMintAddress, currentCount + 1);
          }
        }
        
        const collectionsWithVerifiedListings = [];
        for (const [collectionMintAddress, count] of verifiedCollectionCounts.entries()) {
          const collectionDetails = await NftCollection.findOne({ collectionMintAddress: collectionMintAddress }).lean();
          if (collectionDetails) {
            collectionsWithVerifiedListings.push({
              collectionMintAddress,
              name: collectionDetails.name,
              metadataUri: collectionDetails.metadataUri,
              listingCount: count,
            });
          }
        }

        const augmentedCollections = await Promise.all(collectionsWithVerifiedListings.map(async (col) => {
            let imageUrl;
            if (col.metadataUri) {
                // Use the conversion ONLY to fetch the metadata
                const metadataResponse = await fetch(ipfsToPinataUrl(col.metadataUri));
                if (metadataResponse.ok) {
                    const collectionJson = await metadataResponse.json();
                    imageUrl = collectionJson.image || ''; // Use the image URL directly
                }
            }
            return { ...col, imageUrl: imageUrl || '/placeholder-image.svg' };
        }));

        res.status(200).json({ success: true, data: augmentedCollections });
      } catch (error) {
        res.status(400).json({ success: false, message: "Could not fetch collections." });
      }
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}

export default handler; 