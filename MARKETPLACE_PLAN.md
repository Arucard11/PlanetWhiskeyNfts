# NFT Marketplace Development Plan

This document outlines the steps required to build a fully functional NFT marketplace within the existing Planet Whiskey NFTs application. The marketplace will allow users to list their minted NFTs for sale and buy NFTs from others, exclusively using the `WHISKEY` token.

## 1. Frontend Setup

### 1.1. Create Marketplace Page

-   [x] Create a new route and page for the marketplace at `/marketplace`.
    -   File path: `planet-whiskey-nfts/src/app/marketplace/page.tsx`
-   This page will be the main view for browsing all listed NFTs.
-   It will include UI for filtering, sorting, and viewing NFT listings.

### 1.2. Create Marketplace Components

-   **`MarketplaceItemCard.tsx`**: A component to display a single NFT listed for sale.
    -   Shows NFT image, name, collection, price in WHISKEY tokens, and a "Buy Now" button.
-   **`ListNftModal.tsx`**: A modal component that allows users to list one of their NFTs for sale.
    -   It will appear when a user clicks a "List for Sale" button on an NFT they own (in a future "My NFTs" page).
    -   The user will input the sale price in WHISKEY tokens.
-   **`BuyNftModal.tsx`**: A modal to confirm the purchase of an NFT.
    -   Shows transaction details and requires user confirmation.

### 1.3. Update Navigation

-   [x] Add a "Marketplace" link to the main navigation bar in `src/components/layout/Navbar.tsx`.
-   This will make the new marketplace easily accessible to all users.

## 2. Backend API Endpoints

### 2.1. Create Marketplace Listing API

-   **`POST /api/marketplace/listings`**: Creates a new listing for an NFT.
    -   **Request body**: `nftMintAddress`, `price` (in WHISKEY tokens).
    -   **Action**: Verifies ownership, creates a listing record in the database, and creates the on-chain escrow account (PDA) to hold the NFT.
-   **`GET /api/marketplace/listings`**: Fetches all active NFT listings.
    -   **Action**: Returns a list of all NFTs currently for sale, including their metadata and price.
-   **`DELETE /api/marketplace/listings`**: Cancels an NFT listing.
    -   **Request body**: `listingId` or `nftMintAddress`.
    -   **Action**: Removes the listing from the database and returns the NFT from escrow to the owner.

### 2.2. Create NFT Purchase API

-   **`POST /api/marketplace/buy`**: Executes the purchase of a listed NFT.
    -   **Request body**: `listingId` or `nftMintAddress`.
    -   **Action**: Transfers WHISKEY tokens from the buyer to the seller, transfers the NFT from the escrow account to the buyer, and updates the listing status to "sold".

## 3. Solana Program (On-Chain Logic) for Marketplace

### 3.1. Create a New Anchor Program

- Create a new Anchor program within the `solana_program/programs` directory named `marketplaceprogram`.
- This program will handle all on-chain marketplace logic, separate from the `whiskeyprogram`.

### 3.2. Define `Listing` Account (PDA)

-   In `marketplaceprogram/src/lib.rs`, define a new account struct to represent an NFT listing on-chain.
    -   `seller: Pubkey`
    -   `nft_mint: Pubkey`
    -   `price: u64` (in WHISKEY tokens)
    -   `escrow_token_account: Pubkey`
    -   `bump: u8`

### 3.3. Implement `list_nft` Instruction

-   Creates a new `Listing` PDA.
-   Transfers the seller's NFT into a new token account owned by the `Listing` PDA (escrow).

### 3.4. Implement `cancel_listing` Instruction

-   Validates that the instruction is called by the original seller.
-   Transfers the NFT from the escrow account back to the seller.
-   Closes the `Listing` PDA and the escrow token account, returning rent to the seller.

### 3.5. Implement `buy_nft` Instruction

-   Transfers the required amount of WHISKEY tokens from the buyer to the seller.
-   Transfers the NFT from the escrow account to the buyer.
-   Closes the `Listing` PDA and the escrow token account.


## 4. Database Models

### 4.1. `MarketplaceListing` Model

-   Create a new Mongoose model in `src/models/` for marketplace listings.
    -   `nftMintAddress: String`
    -   `sellerWalletAddress: String`
    -   `priceInWhiskey: Number`
    -   `listingStatus: String` (e.g., 'active', 'sold', 'cancelled')
    -   `transactionSignature: String`

This plan covers all the necessary steps to build the NFT marketplace. I will now start with the first step: creating the marketplace page. 