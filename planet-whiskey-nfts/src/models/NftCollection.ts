import mongoose, { Document, Schema } from 'mongoose';

export interface INftCollection extends Document {
  collectionOnChainAddress: string; // Pubkey of the CollectionConfig PDA
  collectionMintAddress: string;    // Pubkey of the actual Collection NFT Mint
  name: string;                     // Denormalized from on-chain for easy query
  symbol: string;                   // Denormalized
  metadataUri: string;              // Denormalized
  nftBaseMetadataUri: string;       // Base URI for individual NFTs in this collection
  mintPriceLamports: number;
  itemLimit: number;
  companyId: mongoose.Schema.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  authority?: string; // Public key string of the collection authority (for mint fees)
}

const NftCollectionSchema: Schema = new Schema({
  collectionOnChainAddress: { type: String, required: true, unique: true }, // PDA address
  collectionMintAddress: { type: String, required: true, unique: true },    // Mint address
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  metadataUri: { type: String, required: true }, // Collection's own metadata
  nftBaseMetadataUri: { type: String, required: true }, // Base URI for NFTs minted from this collection
  mintPriceLamports: { type: Number, required: true },
  itemLimit: { type: Number, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  authority: { type: String, required: false }, // Store as string, ensure this is populated on creation
});

export default mongoose.models.NftCollection || mongoose.model<INftCollection>('NftCollection', NftCollectionSchema); 