# Planet Whiskey NFTs - Solana Collection Minting Platform

**Overall Architecture:**

1.  **Solana Program (Anchor Framework):** Manages the creation and configuration of NFT collections on-chain. It will define what a "collection" is in terms of its metadata, minting price, and supply limit. It will *not* handle the minting of individual NFTs by users.
2.  **Next.js Application:**
    *   **Frontend (React):** Provides the user interface for browsing companies, viewing their NFT collections, and minting NFTs. It also includes an admin interface for managing companies and creating new NFT collections.
    *   **Backend (API Routes):** Serves as a bridge between the frontend, the Solana blockchain, and the MongoDB database. It handles requests from the admin panel to interact with the Solana program and manages data persistence in MongoDB.
3.  **MongoDB Database:** Stores off-chain data such as:
    *   Company information.
    *   Mappings between companies and their NFT collections.
    *   Records of which wallets minted which NFTs (for dividend purposes).
    *   Cached or supplementary collection data for faster frontend loading.
4.  **Off-Chain Storage (Arweave/IPFS):** Stores metadata JSON files and images for both the collections themselves and the individual NFTs.

---

**Phase 1: Project Setup & Core Technologies** [COMPLETED]

1.  **Environment Setup:** [COMPLETED]
    *   **1.1. Solana Development:** [COMPLETED]
        *   [x] Install Rust and Cargo.
        *   [x] Install the Solana CLI suite.
        *   [x] Set up a local Solana test validator (`
        solana-test-validator`) or decide on a public devnet/testnet.
        *   [x] Generate a Solana keypair for the program deployer/admin and note the public key. This admin wallet will initially be the authority for creating collections.
    *   **1.2. Next.js Development:** [COMPLETED]
        *   [x] Install Node.js (latest LTS) and yarn or npm.
        *   [x] Create a new Next.js project: `npx create-next-app@latest planet-whiskey-nfts --typescript` (using TypeScript is recommended).
    *   **1.3. MongoDB Setup:** [COMPLETED]
        *   [x] Set up a MongoDB instance (e.g., local Docker container, or a free tier on MongoDB Atlas).
        *   [x] Choose a MongoDB ODM like Mongoose for easier schema definition and interaction in the Next.js backend: `npm install mongoose`.
    *   **1.4. Version Control:** [COMPLETED]
        *   [x] Initialize a Git repository: `git init`. Commit initial project structures.

---

**Phase 2: Solana Program Development (using Anchor)** [COMPLETED]

*   **Goal:** Create a program that allows an authorized wallet to define and initialize new NFT collections.

2.  **Anchor Project Initialization:** [COMPLETED]
    *   [x] Install Anchor: `cargo install --git https://github.com/project-serum/anchor anchor-cli --locked`.
    *   [x] Initialize a new Anchor project within your main project directory (e.g., `solana-program`): `anchor init solana_program --solana-version <your-solana-cli-version>`.
    *   [x] Navigate into `solana_program`.

3.  **Define On-Chain Data Structures (`solana_program/programs/solana_program/src/lib.rs`):** [COMPLETED]
    *   **`CollectionConfig` Account (PDA - Program Derived Address):** This account will store the configuration for each NFT collection managed by the program.
        ```rust
        #[account]
        pub struct CollectionConfig {
            pub authority: Pubkey, // The authority that can manage this collection (e.g., update price)
            pub collection_mint: Pubkey, // The mint address of the Metaplex Collection NFT
            pub name: String,      // Collection Name (used for metadata)
            pub symbol: String,    // Collection Symbol (used for metadata)
            pub metadata_uri: String, // URI to the collection's JSON metadata (on Arweave/IPFS)
            pub mint_price: u64,   // Price in lamports to mint one NFT from this collection
            pub item_limit: u64,   // Maximum number of NFTs in this collection
            pub items_minted: u64, // Counter for how many NFTs have been minted
            pub bump: u8,          // PDA bump seed
        }
        ```
    *   Consider a global `ProgramState` PDA if you need to track program-wide information, like the total number of collections created, though `CollectionConfig` PDAs might be sufficient.

4.  **Implement Program Instructions (`lib.rs`):** [COMPLETED]
    *   **`create_collection` Instruction:** [COMPLETED]
        *   **Context (`CreateCollectionAccounts` struct):** [COMPLETED]
            *   [x] `#[account(mut)] payer: Signer<'info>`: The account funding the transaction.
            *   [x] `#[account(init, payer = payer, space = 8 + ...)] collection_config: Account<'info, CollectionConfig>`: The PDA for the new collection's config. Seeds could be `[b"collection", name.as_bytes()]` or `[b"collection", authority.key().as_ref(), sequential_id.to_le_bytes()]`.
            *   [x] `#[account(mut)] collection_mint: Signer<'info>`: A new mint account for the Collection NFT (this will be a regular SPL token mint, which Metaplex will recognize as a collection).
            *   [x] `#[account(mut)] metadata_account: UncheckedAccount<'info>`: For the Metaplex metadata of the Collection NFT.
            *   [x] `#[account(mut)] master_edition_account: UncheckedAccount<'info>`: For the Metaplex Master Edition of the Collection NFT.
            *   [x] `token_program: Program<'info, Token>`
            *   [x] `token_metadata_program: Program<'info, metaplex_token_metadata::State>` (or `UncheckedAccount` and pass ID)
            *   [x] `system_program: Program<'info, System>`
            *   [x] `rent: Sysvar<'info, Rent>`
        *   **Inputs to the instruction handler function:** [COMPLETED]
            *   [x] `name: String`
            *   [x] `symbol: String`
            *   [x] `metadata_uri: String` (URI to the collection's JSON metadata stored on Arweave/IPFS)
            *   [x] `mint_price: u64`
            *   [x] `item_limit: u64`
        *   **Logic:** [COMPLETED]
            1.  [x] Validate inputs (e.g., string lengths, sensible limits).
            2.  [x] CPI to `token_program` to initialize `collection_mint` (0 decimals, freeze authority to `collection_config` PDA or `payer`).
            3.  [x] CPI to `token_metadata_program` (Metaplex) to create the metadata account for `collection_mint`.
                *   [x] `name`, `symbol`, `uri` from inputs.
                *   [x] `seller_fee_basis_points` (e.g., 500 for 5%).
                *   [x] `creators` (e.g., the `payer` or a designated program authority).
                *   [x] This NFT is the collection parent, so its `collection` field in Metaplex metadata will be `None`.
            4.  [x] CPI to `token_metadata_program` to create the master edition account for `collection_mint`. This makes the Collection NFT a "Master Edition," enabling minting of "Prints" or simply signifying it as a parent collection.
            5.  [x] Initialize the `collection_config` PDA:
                *   [x] `authority = payer.key()` (or a dedicated admin pubkey).
                *   [x] `collection_mint = collection_mint.key()`.
                *   [x] Store `name`, `symbol`, `metadata_uri`, `mint_price`, `item_limit`.
                *   [x] `items_minted = 0`.
                *   [x] Store `bump`.

5.  **Testing (`solana_program/tests/*.ts`):** [COMPLETED]
    *   Write Anchor/TypeScript tests to:
        *   Deploy the program to a local validator.
        *   Call `create_collection` with valid parameters.
        *   Verify that the `CollectionConfig` PDA is created with correct data.
        *   Verify that the Collection NFT, its metadata, and master edition accounts are created correctly on-chain.
        *   Test edge cases and permissions.

6.  **Deployment:**
    *   Build the program: `anchor build`. [COMPLETED]
    *   Deploy to localnet/devnet: `anchor deploy`. Note the Program ID. [COMPLETED - ID: H5ziH8THTXbx1oyuRGA311rR24M4SmdDdGSG3JFafV3x]

---

**Phase 3: Database Schema Design (MongoDB with Mongoose)** [COMPLETED]

*   **Goal:** Define data structures for off-chain information.

7.  **Mongoose Schema Definitions (in Next.js project, e.g., `models/` directory):** [COMPLETED]
    *   **`Company.ts`:**
        ```typescript
        import mongoose, { Document, Schema } from 'mongoose';

        export interface ICompany extends Document {
          name: string;
          description?: string;
          createdAt: Date;
        }

        const CompanySchema: Schema = new Schema({
          name: { type: String, required: true, unique: true },
          description: { type: String },
          createdAt: { type: Date, default: Date.now },
        });

        export default mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema);
        ```
    *   **`NftCollection.ts`:**
        ```typescript
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
        });

        export default mongoose.models.NftCollection || mongoose.model<INftCollection>('NftCollection', NftCollectionSchema);
        ```
    *   **`WalletNftPurchase.ts`:** (To track who bought what for dividends)
        ```typescript
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
        ```
    *   **`AdminUser.ts` (Optional - for basic admin page auth):**
        ```typescript
        // Schema for admin users with hashed passwords if implementing session/DB auth
        // username, passwordHash, role etc.
        ```

---

**Phase 4: Backend API Development (Next.js API Routes)** [COMPLETED]

*   **Goal:** Create endpoints for frontend interaction with Solana and MongoDB.

8.  **Setup & Utilities:** [COMPLETED]
    *   MongoDB connection utility (`lib/mongodb.ts`). [COMPLETED]
    *   Install Solana Web3 libraries: `npm install @solana/web3.js @project-serum/anchor @metaplex-foundation/js @solana/spl-token`. [COMPLETED]
    *   Environment variables (`.env.local`): `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `MONGODB_URI`, `ADMIN_WALLET_PRIVATE_KEY`, `PINATA_API_KEY`, `PINATA_API_SECRET`, `SESSION_SECRET`. [COMPLETED - File created and populated by user]
    *   Helper function to initialize AnchorProvider for server-side Solana interactions (`lib/solanaUtils.ts`). [COMPLETED]

9.  **Admin API Endpoints (`pages/api/admin/*`):** [COMPLETED]
    *   **Authentication for Admin Routes:** [COMPLETED - Implemented password-based authentication using `next-iron-session` via `withAdminAuth` HOC. An initial admin user can be seeded via script.]
    *   **`POST /api/admin/companies`**: [COMPLETED - Implemented in `src/pages/api/admin/companies.ts`]
        *   Request: `{ name: string, description?: string }`
        *   Logic: Create new `Company` in MongoDB.
        *   Response: Created company object or error.
    *   **`GET /api/admin/companies`**: [COMPLETED - Implemented in `src/pages/api/admin/companies.ts`]
        *   Logic: List all `Company` documents.
    *   **`POST /api/admin/collections`**: [COMPLETED - Implemented in `src/pages/api/admin/collections.ts`]
        *   Request: `multipart/form-data` including `{ name, symbol, collectionMetadataJsonString, nftBaseMetadataJsonTemplateString, mintPriceSOL, itemLimit, companyId, collectionImageFile?, nftBaseImageFile? }`.
        *   Logic:
            1.  [x] **Parse `multipart/form-data`:** Use a library like `formidable`.
            2.  [x] **Upload Images to IPFS (via Pinata).**
            3.  [x] **Prepare and Upload JSON Metadata to IPFS (via Pinata).**
            4.  [x] **Interact with Solana Program:** Call `create_collection`.
            5.  [x] **Store in MongoDB:** Create `NftCollection` document.
        *   Response: Success message, details of created collection (both on-chain addresses and DB ID), or error.

10. **User-Facing API Endpoints (`pages/api/*`):** [COMPLETED]
    *   **`GET /api/companies`**: [COMPLETED - Implemented in `src/pages/api/companies/index.ts` (publicly accessible)]
        *   Logic: Fetch all `Company` documents from MongoDB.
        *   Response: Array of companies.
    *   **`GET /api/collections?companyId=<id>`**: [COMPLETED - Implemented in `src/pages/api/collections/index.ts`]
        *   Logic: Fetch `NftCollection` documents from MongoDB filtered by `companyId`. For each, fetches the current `items_minted` from its `CollectionConfig` PDA on Solana.
        *   Response: Array of collection details.
    *   **`GET /api/collections/:collectionOnChainAddress`**: (Get specific collection by its PDA address) [COMPLETED - Implemented in `src/pages/api/collections/[collectionOnChainAddress].ts`]
        *   Logic: Fetch details from MongoDB. Augment with live on-chain data from `CollectionConfig` PDA (like `items_minted`).
    *   **`POST /api/mints/record-purchase`**: [COMPLETED - Implemented in `src/pages/api/mints/record-purchase.ts`]
        *   Request: `{ walletAddress, nftMintAddress, collectionMintAddress, transactionSignature }`
        *   Logic:
            1.  [x] Validate inputs.
            2.  [x] **Crucial:** Verify the `transactionSignature` on the Solana blockchain.
            3.  [x] Create a `WalletNftPurchase` document in MongoDB.
        *   Response: Success or error.

---

**Phase 5: Frontend Development (Next.js with React)** [IN PROGRESS - Core functionality implemented, Admin Auth complete, Minting logic refined]

*   **Goal:** Build the user interface for browsing, minting, and admin tasks.

11. **Setup & Wallet Integration:** [COMPLETED]
    *   UI Library: Choose one (e.g., Tailwind CSS, Chakra UI, Material-UI). <!-- Presumed Tailwind from styling --> [COMPLETED - Tailwind CSS used]
    *   Solana Wallet Adapter: `npm install @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-base @solana/wallet-adapter-wallets` (include specific wallets like Phantom, Solflare). [COMPLETED]
    *   Wrap your `_app.tsx` with `WalletContextProvider`. [COMPLETED - Done in `src/app/layout.tsx` and `src/contexts/WalletContextProvider.tsx`]

12. **Core Components:** [COMPLETED]
    *   `Layout.tsx`: Common page structure (navbar, footer). [COMPLETED - via `src/app/layout.tsx`]
    *   `WalletConnectButton.tsx`: Uses Wallet Adapter UI. [COMPLETED - Part of Wallet Adapter UI]
    *   `NftCollectionCard.tsx`: Displays collection image (from its metadata URI), name, mint price, supply remaining, mint button. [COMPLETED - Core structure, display, and mint logic refined. Relies on backend APIs.]
    *   `CompanyCard.tsx`: Displays company name, navigates to its collections. [COMPLETED]

13. **Admin Pages (`pages/admin/*` and `app/admin/*`):** [IN PROGRESS - UI for managing data and logout pending]
    *   Implement client-side authentication checks or use NextAuth.js for proper sessions. [COMPLETED - Implemented client-side auth in `src/app/admin/layout.tsx` using `next-iron-session` and API endpoints for login/session status (`/api/auth/login`, `/api/admin/session-status`). Login page `src/app/admin/login/page.tsx` created.]
    *   [x] Created basic admin section structure (`app/admin/layout.tsx`, `app/admin/page.tsx`).
    *   [x] Implemented "Create Collection" form (`app/admin/collections/page.tsx`) using `multipart/form-data` to submit to `POST /api/admin/collections`, including image uploads and JSON string inputs.

14. **User-Facing Pages:**
    *   **Homepage (`pages/index.tsx` or `app/page.tsx`):** [COMPLETED - Displays company list from `/api/companies`]
        *   Fetch and display list of companies (`CompanyCard`) from `/api/companies`.
        *   Clicking a company navigates to `pages/companies/[companyId].tsx` or equivalent App Router page.
    *   **Company Collections Page (`pages/companies/[companyId].tsx` or `app/companies/[companyId]/page.tsx`):** [COMPLETED - Displays collections for a company]
        *   Use `useRouter` to get `companyId` or `params` in App Router.
        *   Fetch and display NFT collections for this company from `/api/collections?companyId=<id>`.
        *   Use `NftCollectionCard` for each collection.
    *   **Minting Logic (likely within `NftCollectionCard` or a modal it opens):** [IN PROGRESS - Core minting flow implemented, backend dependencies verified, frontend logic refined. End-to-end testing remains.]
        1.  User clicks "Mint". Wallet must be connected. [COMPLETED in `NftCollectionCard.tsx`]
        2.  Fetch up-to-date collection details (especially `collectionMintAddress` from `NftCollection.collectionMintAddress` in DB, `collectionOnChainAddress` for the `CollectionConfig` PDA, `nftBaseMetadataUri`, `mintPriceLamports`, `itemLimit`, current `items_minted` from its `CollectionConfig` PDA, and `authority` from `CollectionConfig` PDA) by calling `GET /api/collections/:collectionOnChainAddress`. [COMPLETED in `NftCollectionCard.tsx`]
        3.  Check if `items_minted < itemLimit` using live data. [COMPLETED in `NftCollectionCard.tsx`]
        4.  Check if user has enough SOL. (Handled by wallet during transaction approval, especially for the `mint_price`).
        5.  **Call Custom Solana Program Instruction `mint_nft`:** [NEEDS UPDATE - Currently describes direct Metaplex SDK call]
            *   The user (payer) will call the `mint_nft` instruction in your `whiskeyprogram`.
            *   **Frontend Responsibilities:**
                *   Generate `nft_name` (e.g., "Collection Name #MintNumber"), `nft_symbol` (e.g., collection symbol), and `nft_uri` (e.g., by appending `items_minted + 1` to `nftBaseMetadataUri` like `base_uri/{count}.json`).
                *   Create a new `Keypair` for the `nft_mint` account (this keypair must sign the transaction).
                *   Derive the PDA for `nft_metadata_account` using `nft_mint.publicKey`.
                *   Derive the PDA for `nft_master_edition_account` using `nft_mint.publicKey`.
                *   Obtain/derive the user's Associated Token Account (ATA) for the `nft_mint`.
            *   **Instruction Arguments:** `nft_name`, `nft_symbol`, `nft_uri`.
            *   **Instruction Accounts:**
                *   `payer`: User's connected wallet public key.
                *   `collection_config`: PDA address of the collection (fetched from API, derived from `collectionName`).
                *   `collection_mint_account`: Mint address of the parent collection NFT (from `collection_config.collection_mint`).
                *   `nft_mint`: Public key of the newly generated `Keypair` for the NFT.
                *   `nft_metadata_account`: Derived PDA for the new NFT's metadata.
                *   `nft_master_edition_account`: Derived PDA for the new NFT's master edition.
                *   `nft_token_account`: User's ATA for `nft_mint`.
                *   `collection_authority_receiver`: The `authority` field from the `CollectionConfig` PDA (where mint fees go).
                *   `token_program`, `associated_token_program`, `token_metadata_program`, `system_program`, `rent`.
            *   The `mint_nft` instruction handles:
                *   Payment of `mint_price` to `collection_authority_receiver`.
                *   Minting the new NFT token.
                *   Creating Metaplex metadata and master edition, associating NFT with the collection.
                *   Incrementing `items_minted` in `CollectionConfig`.
        6.  **After successful transaction:** [COMPLETED in `NftCollectionCard.tsx`]
            *   Get the new NFT's mint address and the transaction signature.
            *   Call `POST /api/mints/record-purchase` with these details.
            *   Update UI (show success, optimistically update remaining count based on on-chain data fetch or optimistic update).
        7.  **Collection Verification:** The `metaplex.nfts().create` call with the `collection` field correctly set should associate the NFT with the collection. The collection authority (initially admin) might need to call `metaplex.nfts().verifyCollection()` or `metaplex.nfts().verifyCreator()` for each minted NFT if further verification steps are desired or needed by marketplaces. For basic functionality, setting the `collection` field during mint is the primary step. [No changes here, remains as is]
        * Notes:
            * [x] IPFS gateway in `getCollectionImageFromMetadata` updated to Pinata's for reliability.

15. **Wallet Tracking Display (Admin/Internal):** [COMPLETED]
    *   A page in the admin section to query and display data from the `WalletNftPurchase` collection for dividend planning.
    *   [x] API Endpoint `GET /api/admin/purchases` created to fetch purchase data.
    *   [x] Admin Page `src/app/admin/purchases/page.tsx` created to display data.
    *   [x] Navigation link added to admin layout.

---

**Phase 6: Integration, Testing, and Refinement**

16. **Metadata Strategy for Individual NFTs:**
    *   The plan assumes `nftBaseMetadataUri` is set per collection, meaning all NFTs minted from it share the same off-chain JSON (and thus same image, attributes).
    *   If unique attributes/images per NFT are needed (e.g., generative), the `nftBaseMetadataUri` would need to be a template (`.../1.json`, `.../2.json`), and the minting logic would need to select the correct URI based on `items_minted` count. This adds complexity.

17. **End-to-End Testing:**
    *   Admin: Create company -> Create collection (uploads metadata, sets details).
    *   User: View companies -> Select company -> View collections -> Connect wallet -> Mint NFT.
    *   Verify:
        *   `CollectionConfig` PDA created and correct.
        *   Metaplex Collection NFT created.
        *   MongoDB `Company` and `NftCollection` records correct.
        *   User can mint; NFT is created on-chain and associated with the collection.
        *   `WalletNftPurchase` record created.
        *   `items_minted` count (read from PDA) updates correctly.
        *   NFT appears in user's wallet.

18. **Security & Error Handling:**
    *   Secure admin endpoints (NextAuth.js recommended for robust auth).
    *   Protect `ADMIN_WALLET_PRIVATE_KEY` (consider client-side signing for admin actions or a dedicated signing service).
    *   Comprehensive input validation (frontend and backend).
    *   Graceful error handling and user feedback for all operations (blockchain interactions can be slow or fail).

---

**Phase 7: Deployment**

19. **Solana Program:**
    *   Deploy to Mainnet-beta: `anchor deploy --provider.cluster mainnet`. Verify Program ID.
20. **Off-chain Metadata:**
    *   Ensure all metadata JSONs and associated images are permanently stored (Arweave is best for permanence).
21. **Next.js Application:**
    *   Deploy to Vercel (recommended for Next.js), Netlify, or other Node.js hosting.
    *   Configure production environment variables.
22. **MongoDB:**
    *   Use MongoDB Atlas for production. Configure IP whitelisting, user roles, and backups. 