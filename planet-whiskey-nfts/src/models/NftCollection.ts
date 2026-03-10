import mongoose, { Document, Schema } from 'mongoose';

export interface INftCollection extends Document {
  collectionOnChainAddress: string;
  collectionMintAddress: string;
  name: string;
  symbol: string;
  description: string;
  metadataUri: string;
  nftBaseMetadataUri: string;
  nftBaseName: string;
  mintPriceLamports: number;
  mintPriceWhiskeyTokens?: number;
  mintPriceUsd: number;
  baseMintPriceUsd?: number;
  priceIncreaseBps?: number;
  nftsPerPriceStep?: number;
  itemLimit: number;
  itemsMintedOnChain?: number;
  companyId: mongoose.Schema.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  authority?: string;
  isWhiskeyGated?: boolean;
  requiredWhiskeyAmount?: number;
}

const NftCollectionSchema: Schema = new Schema({
  collectionOnChainAddress: { type: String, required: true, unique: true }, // PDA address
  collectionMintAddress: { type: String, required: true, unique: true },    // Mint address
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  description: { type: String, required: true }, // Collection description
  metadataUri: { type: String, required: true }, // Collection's own metadata
  nftBaseMetadataUri: { type: String, required: true }, // Base URI for NFTs minted from this collection
  nftBaseName: { type: String, required: true }, // Base name for individual NFTs
  mintPriceLamports: { type: Number, required: false, default: 0 }, // DEPRECATED
  mintPriceWhiskeyTokens: { type: Number, required: false, default: undefined }, // DEPRECATED - calculated dynamically at mint time
  mintPriceUsd: { type: Number, required: true },
  baseMintPriceUsd: { type: Number, required: false },
  priceIncreaseBps: { type: Number, required: false, default: 200 },
  nftsPerPriceStep: { type: Number, required: false, default: 15 },
  itemLimit: { type: Number, required: true },
  itemsMintedOnChain: { type: Number, default: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  authority: { type: String, required: false }, // Store as string, ensure this is populated on creation
  isWhiskeyGated: { type: Boolean, default: false }, // NEW: Whether this collection requires WHISKEY tokens to mint
  requiredWhiskeyAmount: { type: Number, required: false }, // NEW: Required WHISKEY tokens (in full tokens, not lamports)
});

export default mongoose.models.NftCollection || mongoose.model<INftCollection>('NftCollection', NftCollectionSchema); 