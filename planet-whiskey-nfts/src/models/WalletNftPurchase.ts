import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletNftPurchase extends Document {
  walletAddress: string; // Purchaser's wallet address
  nftMintAddress: string;  // Mint address of the specific NFT they bought
  collectionMintAddress: string; // Parent collection's mint address
  transactionSignature: string;
  purchaseDate: Date;
}

const WalletNftPurchaseSchema: Schema = new Schema({
  walletAddress: { type: String, required: true, index: true },
  nftMintAddress: { type: String, required: true, unique: true },
  collectionMintAddress: { type: String, required: true, index: true },
  transactionSignature: { type: String, required: true, unique: true },
  purchaseDate: { type: Date, default: Date.now },
});

export default mongoose.models.WalletNftPurchase || mongoose.model<IWalletNftPurchase>('WalletNftPurchase', WalletNftPurchaseSchema); 