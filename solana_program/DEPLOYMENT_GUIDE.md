# Solana Program Deployment Guide

This guide outlines the steps to build and deploy your Anchor-based Solana program.

## Prerequisites

1.  **Rust & Cargo**: Ensure you have Rust and Cargo installed. If not, visit [rust-lang.org](https://www.rust-lang.org/tools/install).
2.  **Solana CLI**: Install the Solana CLI tools. Follow the instructions at [Solana CLI Installation](https://docs.solana.com/cli/install-solana-cli-tools).
3.  **Anchor CLI**: Install Anchor. The recommended way is using `avm` (Anchor Version Manager):
    ```bash
    cargo install --git https://github.com/project-serum/anchor avm --locked --force
    avm install latest
    avm use latest
    ```
    Verify installation: `anchor --version`
4.  **Node.js & pnpm/npm/yarn**: Required for running scripts and managing JavaScript/TypeScript dependencies. This project uses `pnpm`.

## Setup

1.  **Clone the Repository (if not already done):**
    ```bash
    # git clone <your-repo-url>
    # cd <your-repo-name>/solana_program
    ```
2.  **Install JavaScript Dependencies:**
    From within the `solana_program` directory:
    ```bash
    pnpm install
    ```

## Building the Program

Navigate to the `solana_program` directory in your terminal. To build the Solana program, run:

```bash
anchor build
```

This command will:
*   Compile your Rust code into BPF bytecode (the format Solana programs use).
*   Generate an IDL (Interface Definition Language) JSON file in `target/idl/<your_program_name>.json`. This IDL is crucial for client-side interaction.
*   Create a type definition file for TypeScript in `target/types/<your_program_name>.ts`.

If the build is successful, you'll see output indicating the program ELF has been written to `target/deploy/<your_program_name>.so`.

## Deploying the Program

### Configuration

1.  **Solana Cluster**: Ensure your Solana CLI is configured to the desired cluster (e.g., `devnet`, `testnet`, `mainnet-beta`, or a local test validator).
    *   Check current configuration: `solana config get`
    *   Set to Devnet: `solana config set --url https://api.devnet.solana.com`
    *   Set to Local Test Validator (if running): `solana config set --url http://localhost:8899`

2.  **Wallet**: Ensure your Solana CLI is configured with the wallet you want to use for deployment. This wallet will pay the deployment fees and will be the authority for the deployed program.
    *   Check current wallet: `solana address`
    *   Set wallet: `solana config set --keypair /path/to/your/wallet-keypair.json`
    *   The `Anchor.toml` file also specifies a provider wallet (e.g., `wallet = "~/.config/solana/admin-keypair.json"`). Anchor commands often use this.

3.  **Program ID (First-Time Deployment vs. Upgrade):**
    *   **First-Time Deployment**: Anchor will generate a new keypair for your program, deploy it, and save the program's public key (Program ID) into `target/deploy/<your_program_name>-keypair.json`. This ID will also be updated in your `programs/<your_program_name>/src/lib.rs` file (in the `declare_id!` macro) and `Anchor.toml`.
    *   **Upgrading an Existing Program**: If you're upgrading a program that's already deployed, ensure the `declare_id!` macro in `lib.rs` and the program ID in `Anchor.toml` match the existing on-chain Program ID. The deployment command will then upgrade the existing program.

### Deployment Command

From within the `solana_program` directory:

```bash
anchor deploy
```

This command will:
1.  Build the program if it hasn't been built or if changes are detected.
2.  Deploy the compiled program (`.so` file) to the configured Solana cluster.
3.  If it's a first-time deployment, it will update your `lib.rs` with the new Program ID. **You might need to manually update this ID in your client-side code (e.g., Next.js application) and potentially in `Anchor.toml` if it doesn't get updated automatically.**

After a successful deployment, the command will output the Program ID.

## Post-Deployment

1.  **Update Program ID**: Ensure your client-side application (e.g., your Next.js app) is using the correct Program ID for the deployed program. This ID is found in `target/idl/<your_program_name>.json` (under `address`) after deployment or in `lib.rs`.
2.  **Copy IDL and Types**: Copy the generated IDL and TypeScript types to your client-side application to enable type-safe interaction with your program.
    Example commands (run from `solana_program` directory, adjust paths as needed):
    ```bash
    cp target/idl/whiskeyprogram.json ../planet-whiskey-nfts/src/lib/idl/solana_program.json
    cp target/types/whiskeyprogram.ts ../planet-whiskey-nfts/src/lib/idl/solana_program.ts 
    ```
    (Note: The second type file name was `solana_program.ts` for consistency in your project, ensure this matches your actual IDL types file name, often `<program_name>.ts`)

3.  **Initialize On-Chain Accounts (if needed)**: Run any necessary scripts to initialize on-chain accounts required by your program (e.g., super admin config, initial collections). Refer to scripts in the `./scripts` directory like `initializeSuperAdmin.ts`.

## Troubleshooting

*   **"Account already in use"**: This can happen if you try to `init` an account (like a PDA) that has already been created. Consider using `init_if_needed` in your program logic for accounts that might be re-initialized or should persist.
*   **Compute Unit Limits**: If transactions fail due to exceeding compute limits, especially for complex CPIs, you might need to request more compute units at the beginning of your transaction:
    ```typescript
    // Client-side example
    import { ComputeBudgetProgram } from "@solana/web3.js";
    const transaction = new Transaction();
    transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }) // Adjust units as needed
    );
    // ... add your program's instruction
    ```
*   **Wallet Funding**: Ensure the deployment wallet has enough SOL to cover deployment fees.
*   **Cluster Mismatch**: Double-check that your `solana config get` and `Anchor.toml` provider cluster settings match where you intend to deploy and test.

This guide should provide a solid foundation for deploying your program. 