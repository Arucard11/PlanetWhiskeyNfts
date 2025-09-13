import mongoose, { Document, Schema } from 'mongoose';

export interface INftCollection extends Document {
  collectionOnChainAddress: string; // Pubkey of the CollectionConfig PDA
  collectionMintAddress: string;    // Pubkey of the actual Collection NFT Mint
  name: string;                     // Denormalized from on-chain for easy query
  symbol: string;                   // Denormalized
  description: string;              // Collection description
  metadataUri: string;              // Denormalized
  nftBaseMetadataUri: string;       // Base URI for individual NFTs in this collection
  nftBaseName: string;              // Base name for individual NFTs
  mintPriceLamports: number;        // Price in SOL (lamports) - DEPRECATED
  mintPriceWhiskeyTokens?: number;   // Price in Whiskey tokens - CALCULATED FROM USD (optional since calculated dynamically)
  mintPriceUsd: number;             // NEW: Price in USD (what admin sets)
  itemLimit: number;
  companyId: mongoose.Schema.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  authority?: string; // Public key string of the collection authority (for mint fees)
  isWhiskeyGated?: boolean;         // NEW: Whether this collection requires WHISKEY tokens to mint
  requiredWhiskeyAmount?: number;   // NEW: Required WHISKEY tokens (in full tokens, not lamports)
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
  mintPriceUsd: { type: Number, required: true }, // NEW: Admin sets this in USD
  itemLimit: { type: Number, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  authority: { type: String, required: false }, // Store as string, ensure this is populated on creation
  isWhiskeyGated: { type: Boolean, default: false }, // NEW: Whether this collection requires WHISKEY tokens to mint
  requiredWhiskeyAmount: { type: Number, required: false }, // NEW: Required WHISKEY tokens (in full tokens, not lamports)
});

export default mongoose.models.NftCollection || mongoose.model<INftCollection>('NftCollection', NftCollectionSchema); 