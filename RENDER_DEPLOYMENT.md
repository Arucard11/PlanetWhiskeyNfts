# Render Deployment Guide

This branch is specifically configured for deployment on Render.com.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **MongoDB Database**: Set up a MongoDB Atlas cluster or other hosted MongoDB instance
3. **Environment Variables**: Prepare the following secrets

## Required Environment Variables

Set these in your Render dashboard under Environment Variables:

### Database
- `MONGODB_URI` - Your MongoDB connection string

### Admin Authentication  
- `ADMIN_USERNAME` - Admin login username
- `ADMIN_DEFAULT_PASSWORD` - Admin login password
- `SESSION_SECRET` - Random 32+ character string for session encryption

### IPFS/Pinata (for NFT metadata storage)
- `PINATA_API_KEY` - Your Pinata API key
- `PINATA_SECRET_API_KEY` - Your Pinata secret key

### Solana Configuration
- `ADMIN_WALLET_PRIVATE_KEY` - JSON array of admin wallet private key bytes
- `SOLANA_RPC_URL` - Solana RPC endpoint (defaults to devnet)
- `NEXT_PUBLIC_SOLANA_NETWORK` - Network name (devnet/mainnet-beta)

## Deployment Steps

1. **Fork/Clone Repository**: Connect your GitHub repo to Render
2. **Create Web Service**: 
   - Runtime: Node
   - Branch: `render-deployment`
   - Build Command: `cd planet-whiskey-nfts && pnpm install && pnpm run build`
   - Start Command: `cd planet-whiskey-nfts && pnpm start`
3. **Set Environment Variables**: Add all required variables in Render dashboard
4. **Deploy**: Render will automatically build and deploy

## Important Notes

- The app is configured for **monorepo structure** - all commands run from `planet-whiskey-nfts/` directory
- Uses **pnpm** as package manager
- Configured for **standalone Next.js output** for optimal performance
- Includes **CORS headers** for API routes
- **Health check** endpoint at `/`

## Post-Deployment

1. Access admin panel at `your-app-url.onrender.com/admin/login`
2. Create companies and NFT collections
3. Test NFT minting functionality

## Troubleshooting

- Check Render build logs for any dependency issues
- Verify all environment variables are set correctly
- Ensure MongoDB connection string includes proper authentication
- Check that Solana RPC URL is accessible from Render's servers 