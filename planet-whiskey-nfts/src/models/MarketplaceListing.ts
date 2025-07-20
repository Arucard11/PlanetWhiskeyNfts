import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketplaceListing extends Document {
  nftMintAddress: string;
  sellerWalletAddress: string;
  collectionMintAddress: string; // Added to link listing to a collection
  priceInWhiskey: number;
  listingStatus: 'active' | 'sold' | 'cancelled';
  transactionSignature: string; // Signature of the on-chain listing transaction
  createdAt: Date;
}

const MarketplaceListingSchema: Schema = new Schema({
  nftMintAddress: { type: String, required: true, index: true },
  sellerWalletAddress: { type: String, required: true, index: true },
  collectionMintAddress: { type: String, required: true, index: true }, // Added field
  priceInWhiskey: { type: Number, required: true },
  listingStatus: { type: String, enum: ['active', 'sold', 'cancelled'], default: 'active' },
  transactionSignature: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

// Compound index to quickly find active listings for a specific NFT
MarketplaceListingSchema.index({ nftMintAddress: 1, listingStatus: 1 });
// New index for fetching listings by collection
MarketplaceListingSchema.index({ collectionMintAddress: 1, listingStatus: 1 });

export default mongoose.models.MarketplaceListing || mongoose.model<IMarketplaceListing>('MarketplaceListing', MarketplaceListingSchema); 