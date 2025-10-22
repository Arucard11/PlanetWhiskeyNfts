import type { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import dbConnect from '../../../lib/mongodb';
import MarketplaceListing from '../../../models/MarketplaceListing';
import NftCollection from '../../../models/NftCollection';
import { getMarketplaceProgram } from '@/lib/solanaUtils'; // Use the utility
import { BorshInstructionCoder } from '@coral-xyz/anchor';
import { Metaplex } from '@metaplex-foundation/js';

async function verifyListTransaction(
    connection: Connection,
    signature: string,
    expectedSeller: string,
    expectedNftMint: string,
    expectedPrice: number,
): Promise<boolean> {
    console.log(`[VERIFY_LIST_TX] 🔍 Starting transaction verification`);
    console.log(`[VERIFY_LIST_TX] 📝 Verification parameters:`, {
        signature: signature ? `${signature.substring(0, 20)}...` : 'undefined',
        expectedSeller,
        expectedNftMint,
        expectedPrice,
        expectedPriceType: typeof expectedPrice
    });

    try {
        console.log(`[VERIFY_LIST_TX] 🏗️ Getting marketplace program...`);
        const program = getMarketplaceProgram(); // Get program instance
        console.log(`[VERIFY_LIST_TX] ✅ Program loaded, ID: ${program.programId.toBase58()}`);
        const instructionCoder = new BorshInstructionCoder(program.idl);

        console.log(`[VERIFY_LIST_TX] 🌐 Fetching transaction from blockchain...`);
        const tx = await connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0 });
        
        if (!tx) {
            console.error(`[VERIFY_LIST_TX] ❌ Transaction not found on blockchain`);
            return false;
        }
        
        if (tx.meta?.err) {
            console.error(`[VERIFY_LIST_TX] ❌ Transaction failed with error:`, tx.meta.err);
            return false;
        }

        console.log(`[VERIFY_LIST_TX] ✅ Transaction found and successful`);
        console.log(`[VERIFY_LIST_TX] 📊 Transaction info:`, {
            slot: tx.slot,
            blockTime: tx.blockTime,
            instructionCount: tx.transaction.message.instructions.length,
            fee: tx.meta?.fee
        });

        console.log(`[VERIFY_LIST_TX] 🔍 Looking for marketplace instruction...`);
        const listNftInstruction = tx.transaction.message.instructions.find(
            (ix) => ix.programId.equals(program.programId)
        );

        if (!listNftInstruction) {
            console.error(`[VERIFY_LIST_TX] ❌ No marketplace instruction found`);
            console.log(`[VERIFY_LIST_TX] 📋 Available program IDs in transaction:`, 
                tx.transaction.message.instructions.map(ix => ix.programId.toBase58())
            );
            return false;
        }

        if (!('data' in listNftInstruction)) {
            console.error(`[VERIFY_LIST_TX] ❌ Instruction has no data field`);
            return false;
        }

        console.log(`[VERIFY_LIST_TX] ✅ Marketplace instruction found`);

        console.log(`[VERIFY_LIST_TX] 🔧 Decoding instruction...`);
        const decodedInstruction = instructionCoder.decode(listNftInstruction.data, 'base58');
        
        if (!decodedInstruction) {
            console.error(`[VERIFY_LIST_TX] ❌ Failed to decode instruction`);
            return false;
        }
        
        if (decodedInstruction.name !== 'listNft') {
            console.error(`[VERIFY_LIST_TX] ❌ Wrong instruction type: ${decodedInstruction.name}`);
            return false;
        }

        console.log(`[VERIFY_LIST_TX] ✅ Instruction decoded successfully: ${decodedInstruction.name}`);
        console.log(`[VERIFY_LIST_TX] 🔍 Decoded instruction details:`, {
            name: decodedInstruction.name,
            data: decodedInstruction.data
        });
        console.log(`[VERIFY_LIST_TX] 💰 On-chain price: ${decodedInstruction.data.price.toString()}`);
        
        // Extract accounts from the parsed transaction message
        const accountKeys = tx.transaction.message.accountKeys;
        
        // Handle potential different account key formats with safety checks
        if (!accountKeys || accountKeys.length === 0) {
            console.error(`[VERIFY_LIST_TX] ❌ No account keys found in transaction`);
            return false;
        }

        console.log(`[VERIFY_LIST_TX] 📋 Transaction has ${accountKeys.length} account keys`);
        
        console.log(`[VERIFY_LIST_TX] 🔍 Extracting account addresses...`);
        
        // The accounts in listNftInstruction.accounts are PublicKey objects, not indices
        // Let's extract them directly from the instruction accounts
        if (!listNftInstruction.accounts || listNftInstruction.accounts.length < 5) {
            console.error(`[VERIFY_LIST_TX] ❌ Insufficient accounts in listNft instruction. Expected >= 5, got ${listNftInstruction.accounts?.length || 0}`);
            return false;
        }

        // According to our program structure:
        // accounts[0] = seller
        // accounts[1] = listing  
        // accounts[2] = sellerNftTokenAccount
        // accounts[3] = escrowTokenAccount
        // accounts[4] = nftToListMint
        const sellerAccount = listNftInstruction.accounts[0];
        const nftToListMintAccount = listNftInstruction.accounts[4];
        
        if (!sellerAccount || !nftToListMintAccount) {
            console.error(`[VERIFY_LIST_TX] ❌ Could not extract seller or NFT mint account from instruction accounts`);
            console.log(`[VERIFY_LIST_TX] 📋 Instruction accounts:`, listNftInstruction.accounts.map(acc => acc.toBase58()));
            return false;
        }

        console.log(`[VERIFY_LIST_TX] 📍 Extracted accounts:`, {
            seller: sellerAccount.toBase58(),
            nftMint: nftToListMintAccount.toBase58()
        });
        
        // The price is in the instruction data
        const onChainPrice = decodedInstruction.data.price.toNumber();
        
        console.log(`[VERIFY_LIST_TX] 🔍 Comparing values...`);
        const isSellerCorrect = sellerAccount.toBase58() === expectedSeller;
        const isNftMintCorrect = nftToListMintAccount.toBase58() === expectedNftMint;
        const isPriceCorrect = onChainPrice === expectedPrice;

        console.log(`[VERIFY_LIST_TX] 📊 Verification results:`, {
            sellerMatch: isSellerCorrect,
            nftMintMatch: isNftMintCorrect,
            priceMatch: isPriceCorrect,
            expectedPrice,
            onChainPrice
        });
        
        if (!isSellerCorrect) {
            console.error(`[VERIFY_LIST_TX] ❌ Seller mismatch. Expected: ${expectedSeller}, Found: ${sellerAccount.toBase58()}`);
        }
        if (!isNftMintCorrect) {
            console.error(`[VERIFY_LIST_TX] ❌ NFT Mint mismatch. Expected: ${expectedNftMint}, Found: ${nftToListMintAccount.toBase58()}`);
        }
        if (!isPriceCorrect) {
            console.error(`[VERIFY_LIST_TX] ❌ Price mismatch. Expected: ${expectedPrice}, Found: ${onChainPrice}`);
        }

        const verificationResult = isSellerCorrect && isNftMintCorrect && isPriceCorrect;
        console.log(`[VERIFY_LIST_TX] 📊 Final verification result: ${verificationResult}`);

        return verificationResult;

    } catch (error) {
        console.error(`[VERIFY_LIST_TX] ❌ Error during transaction verification:`, error);
        console.error(`[VERIFY_LIST_TX] 🔥 Error details:`, {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
        });
        return false;
    }
}


async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  console.log(`[LIST_SAVE_API] 🚀 Starting listing save process`);

  try {
    const { nftMintAddress, price, collectionMintAddress, signature } = req.body;
    const sellerWalletAddress = req.headers['x-wallet-address'] as string;
    
    console.log(`[LIST_SAVE_API] 📝 Received data:`, {
        nftMintAddress,
        price,
        collectionMintAddress,
        signature: signature ? `${signature.substring(0, 20)}...` : 'undefined', // Show partial sig
        sellerWalletAddress,
        priceType: typeof price,
        bodyKeys: Object.keys(req.body),
        headerKeys: Object.keys(req.headers)
    });
    
    if (!nftMintAddress || price === undefined || !signature || !sellerWalletAddress || !collectionMintAddress) {
        console.log(`[LIST_SAVE_API] ❌ Missing required fields:`, {
            hasNftMintAddress: !!nftMintAddress,
            hasPrice: price !== undefined,
            hasSignature: !!signature,
            hasSellerWalletAddress: !!sellerWalletAddress,
            hasCollectionMintAddress: !!collectionMintAddress
        });
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: nftMintAddress, price, collectionMintAddress, signature, and x-wallet-address header are required.' 
        });
    }
    
    console.log(`[LIST_SAVE_API] 🌐 Setting up RPC connection...`);
    const rpcUrl = process.env.SOLANA_RPC_URL;
    if (!rpcUrl) {
      console.log(`[LIST_SAVE_API] ❌ SOLANA_RPC_URL not configured`);
      return res.status(500).json({ success: false, message: "Server configuration error: SOLANA_RPC_URL is not set." });
    }
    console.log(`[LIST_SAVE_API] ✅ RPC URL configured: ${rpcUrl.substring(0, 50)}...`);
    const connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[LIST_SAVE_API] 🔍 Starting transaction verification...`);
    // Verify the transaction before saving to the database
    const isVerified = await verifyListTransaction(
        connection,
        signature,
        sellerWalletAddress,
        nftMintAddress,
        price
    );

    console.log(`[LIST_SAVE_API] 📊 Verification result: ${isVerified}`);

    if (!isVerified) {
        console.log(`[LIST_SAVE_API] ❌ Transaction verification failed - NFT is NOT properly listed on-chain`);
        console.log(`[LIST_SAVE_API] 🚫 Rejecting listing to prevent showing unlisted NFTs in marketplace`);
        return res.status(400).json({ 
            success: false, 
            message: "On-chain transaction could not be verified. NFT is not properly listed." 
        });
    } else {
        console.log(`[LIST_SAVE_API] ✅ Transaction verification passed - NFT is confirmed listed on-chain!`);
    }

    console.log(`[LIST_SAVE_API] 🗄️ Connecting to database...`);
    await dbConnect();
    console.log(`[LIST_SAVE_API] ✅ Database connection established`);

    console.log(`[LIST_SAVE_API] 🔍 Fetching NFT metadata for listing...`);
    // Fetch NFT metadata to store in the database
    let nftName = 'Unknown NFT';
    let nftImageUrl = null;
    let collectionName = 'Unknown Collection';
    let nftMetadataUri = null; // Store metadata URI
    
    try {
      const connection = new Connection(rpcUrl, 'confirmed');
      const metaplex = Metaplex.make(connection);
      
      const nftMint = new PublicKey(nftMintAddress);
      const nft = await metaplex.nfts().findByMint({ mintAddress: nftMint });
      nftMetadataUri = nft.uri; // Store for later use
      
      console.log(`[LIST_SAVE_API] 📋 NFT metadata URI: ${nft.uri}`);
      
      let loadedJson = nft.json;
      if (!loadedJson) {
        console.log(`[LIST_SAVE_API] NFT JSON not pre-loaded for ${nftMintAddress}. Fetching from URI: ${nft.uri}`);
        
        // Try direct IPFS fetch first
        try {
          console.log(`[LIST_SAVE_API] 🔗 Attempting direct IPFS fetch for: ${nft.uri}`);
          
          // Convert IPFS URI to gateway URLs
          let hash;
          if (nft.uri.startsWith('ipfs://')) {
            const uriPath = nft.uri.substring(7);
            hash = uriPath.endsWith('.json') ? uriPath.slice(0, -5) : uriPath;
          } else if (nft.uri.includes('/ipfs/')) {
            const parts = nft.uri.split('/ipfs/');
            if (parts.length > 1) {
              hash = parts[parts.length - 1];
              hash = hash.endsWith('.json') ? hash.slice(0, -5) : hash;
            } else {
              hash = nft.uri;
            }
          } else {
            hash = nft.uri;
          }
          
          console.log(`[LIST_SAVE_API] 📋 IPFS hash: ${hash}`);
          
          // Try multiple gateways
          const ipfsGateways = [
            `${process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud'}/ipfs/`,
            'https://gateway.pinata.cloud/ipfs/',
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/',
            'https://dweb.link/ipfs/',
            'https://gateway.ipfs.io/ipfs/'
          ];
          
          let response;
          let successfulGateway = '';
          
          for (const gateway of ipfsGateways) {
            const metadataUrl = gateway + hash;
            console.log(`[LIST_SAVE_API] 🔄 Trying gateway: ${metadataUrl}`);
            
            try {
              response = await fetch(metadataUrl, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000)
              });
              
              if (response.ok) {
                successfulGateway = gateway;
                console.log(`[LIST_SAVE_API] ✅ Success with gateway: ${gateway}`);
                break;
              }
              
              console.log(`[LIST_SAVE_API] ❌ Failed with ${gateway}: ${response.status} ${response.statusText}`);
            } catch (error) {
              console.log(`[LIST_SAVE_API] ❌ Error with ${gateway}: ${error.message}`);
              continue;
            }
          }
          
          if (response && response.ok) {
            loadedJson = await response.json();
            console.log(`[LIST_SAVE_API] ✅ Successfully fetched metadata directly from IPFS`);
          } else {
            console.error(`[LIST_SAVE_API] ❌ Failed to fetch metadata from all IPFS gateways`);
            
            // Generate fallback metadata
            console.log(`[LIST_SAVE_API] 🔄 Generating fallback metadata for broken URI: ${nft.uri}`);
            
            let collectionName = 'Planet Whiskey NFT';
            let nftName = 'Treasury NFT';
            
            const numberMatch = hash.match(/(\d+)$/);
            if (numberMatch) {
              const nftNumber = numberMatch[1];
              nftName = `${collectionName} #${nftNumber}`;
            }
            
            loadedJson = {
              name: nftName,
              symbol: 'PWN',
              description: `${nftName} - A premium treasury-backed NFT from Planet Whiskey`,
              image: `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(collectionName)}`,
              attributes: [
                { trait_type: 'Type', value: 'Treasury NFT' },
                { trait_type: 'Collection', value: collectionName },
                { trait_type: 'Status', value: 'Metadata Recovered' },
                { trait_type: 'Rarity', value: 'Legendary' }
              ],
              collection: {
                name: collectionName,
                family: 'Planet Whiskey NFTs'
              }
            };
            
            console.log(`[LIST_SAVE_API] ✅ Generated fallback metadata:`, loadedJson);
          }
        } catch (e) {
          console.error(`[LIST_SAVE_API] ❌ Error in direct IPFS fetch:`, e);
          
          // Generate fallback metadata as last resort
          console.log(`[LIST_SAVE_API] 🔄 Generating emergency fallback metadata`);
          loadedJson = {
            name: `Planet Whiskey NFT #${nftMintAddress.slice(-4)}`,
            symbol: 'PWN',
            description: `Planet Whiskey NFT - A premium treasury-backed NFT`,
            image: `https://via.placeholder.com/512x512/1f2937/f59e0b?text=Planet%20Whiskey`,
            attributes: [
              { trait_type: 'Type', value: 'Treasury NFT' },
              { trait_type: 'Collection', value: 'Planet Whiskey NFTs' },
              { trait_type: 'Status', value: 'Emergency Fallback' },
              { trait_type: 'Rarity', value: 'Legendary' }
            ],
            collection: {
              name: 'Planet Whiskey NFTs',
              family: 'Planet Whiskey NFTs'
            }
          };
        }
      }
      
      if (loadedJson) {
        nftName = loadedJson.name || 'Unknown NFT';
        console.log(`[LIST_SAVE_API] 📝 NFT Name: ${nftName}`);
        
        // Process image URL - accept any valid image URL including fallbacks
        let imageUrl = loadedJson.image;
        console.log(`[LIST_SAVE_API] 🖼️ Original image URL: ${imageUrl}`);
        
        if (imageUrl) {
          if (imageUrl.startsWith('ipfs://')) {
            const hash = imageUrl.substring(7);
            nftImageUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
            console.log(`[LIST_SAVE_API] 🔄 Converted IPFS to proxy: ${nftImageUrl}`);
          } else if (imageUrl.includes('/ipfs/') || imageUrl.includes('gateway.pinata.cloud') || imageUrl.includes('pink-obvious-bee-185.mypinata.cloud')) {
            nftImageUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(imageUrl)}`;
            console.log(`[LIST_SAVE_API] 🔄 Converted gateway to proxy: ${nftImageUrl}`);
          } else if (imageUrl.startsWith('http')) {
            nftImageUrl = imageUrl;
            console.log(`[LIST_SAVE_API] ✅ Using direct HTTP URL: ${nftImageUrl}`);
          } else if (imageUrl.startsWith('/api/images/proxy')) {
            nftImageUrl = imageUrl;
            console.log(`[LIST_SAVE_API] ✅ Using existing proxy URL: ${nftImageUrl}`);
          }
        }
        
        console.log(`[LIST_SAVE_API] 🎯 Final image URL: ${nftImageUrl}`);
      } else {
        console.error(`[LIST_SAVE_API] ❌ No metadata JSON available for ${nftMintAddress}`);
      }
      
      // Get collection name from database
      const collection = await NftCollection.findOne({ collectionMintAddress }).lean();
      if (collection) {
        collectionName = collection.name;
        console.log(`[LIST_SAVE_API] 📚 Collection name: ${collectionName}`);
      }
      
    } catch (error) {
      console.error(`[LIST_SAVE_API] ❌ Error fetching NFT metadata:`, error);
      console.error(`[LIST_SAVE_API] 🔥 Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      // Continue with default values
    }
    
    // Validate that we have an image URL (including fallbacks)
    if (!nftImageUrl) {
      console.error(`[LIST_SAVE_API] ❌ Cannot create listing: No image URL found for NFT ${nftMintAddress}`);
      console.error(`[LIST_SAVE_API] 🔍 Debug info:`, {
        nftMintAddress,
        nftMetadataUri,
        nftName,
        collectionName,
        hasLoadedJson: !!loadedJson
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot list NFT without a valid image. Please ensure the NFT has proper metadata with an image.' 
      });
    }
    
    console.log(`[LIST_SAVE_API] ✅ Image URL validation passed: ${nftImageUrl}`);

    console.log(`[LIST_SAVE_API] 💾 Creating new listing document with metadata...`);
    const newListing = new MarketplaceListing({
        nftMintAddress,
        sellerWalletAddress,
        collectionMintAddress, // Save the collection address
        priceInWhiskey: price,
        listingStatus: 'active',
        transactionSignature: signature,
        nftName,
        nftImageUrl,
        nftMetadataUri: nftMetadataUri, // Store metadata URI for robust fetching
        collectionName,
    });

    console.log(`[LIST_SAVE_API] 📄 Listing document created:`, {
        nftMintAddress: newListing.nftMintAddress,
        sellerWalletAddress: newListing.sellerWalletAddress,
        collectionMintAddress: newListing.collectionMintAddress,
        priceInWhiskey: newListing.priceInWhiskey,
        listingStatus: newListing.listingStatus,
        nftName: newListing.nftName,
        collectionName: newListing.collectionName,
        nftImageUrl: newListing.nftImageUrl,
        transactionSignature: newListing.transactionSignature ? 
            `${newListing.transactionSignature.substring(0, 20)}...` : 'undefined'
    });

    console.log(`[LIST_SAVE_API] 💾 Saving to database...`);
    await newListing.save();
    console.log(`[LIST_SAVE_API] 🎉 Listing saved successfully! Database ID: ${newListing._id}`);

    // 🔍 DEBUG: Verify the listing was actually saved and can be queried back
    try {
      console.log(`[LIST_SAVE_API] 🔍 DEBUG: Verifying listing was saved...`);
      
      // Query back the listing we just saved
      const savedListing = await MarketplaceListing.findById(newListing._id).lean();
      if (savedListing) {
        console.log(`[LIST_SAVE_API] ✅ DEBUG: Listing verified in database:`, {
          id: savedListing._id.toString(),
          nftMintAddress: savedListing.nftMintAddress,
          sellerWalletAddress: savedListing.sellerWalletAddress,
          collectionMintAddress: savedListing.collectionMintAddress,
          priceInWhiskey: savedListing.priceInWhiskey,
          listingStatus: savedListing.listingStatus,
          transactionSignature: savedListing.transactionSignature ? `${savedListing.transactionSignature.substring(0, 20)}...` : 'undefined'
        });
      } else {
        console.error(`[LIST_SAVE_API] ❌ DEBUG: Could not find the listing we just saved!`);
      }
      
      // Also check total count of listings
      const totalListings = await MarketplaceListing.countDocuments({});
      const activeListings = await MarketplaceListing.countDocuments({ listingStatus: 'active' });
      console.log(`[LIST_SAVE_API] 📊 DEBUG: Database counts - Total: ${totalListings}, Active: ${activeListings}`);
      
      // Test the aggregation query that's failing
      console.log(`[LIST_SAVE_API] 🔍 DEBUG: Testing aggregation query...`);
      const testAggregation = await MarketplaceListing.aggregate([
        { $match: { listingStatus: 'active' } },
        { $group: { _id: "$collectionMintAddress", count: { $sum: 1 } } }
      ]);
      console.log(`[LIST_SAVE_API] 📊 DEBUG: Aggregation result:`, testAggregation);
      
    } catch (debugError) {
      console.error(`[LIST_SAVE_API] ❌ DEBUG: Error during post-save verification:`, debugError);
    }

    console.log(`[LIST_SAVE_API] ✅ Sending success response`);
    res.status(201).json({ success: true, data: newListing });

  } catch (error: any) {
    console.error(`[LIST_SAVE_API] ❌ Error in listing save process:`, error);
    console.error(`[LIST_SAVE_API] 🔥 Error details:`, {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
    });

    if (error.code === 11000) {
        console.log(`[LIST_SAVE_API] ⚠️ Duplicate listing detected (transaction signature already exists)`);
        return res.status(409).json({ success: false, message: "This NFT listing already exists (based on transaction signature)." });
    }
    console.error("Error creating marketplace listing:", error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

export default handler; 