import * as anchor from "@coral-xyz/anchor";
import { Program, Wallet } from "@coral-xyz/anchor";
import { Whiskeyprogram } from "../target/types/whiskeyprogram"; // Adjusted import
import { SystemProgram, Keypair } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet"; // For using Keypair as a Wallet

async function initializeSuperAdmin() {
  // Attempt to load admin keypair from environment variable
  const adminPrivateKeyString = process.env.ADMIN_WALLET_PRIVATE_KEY;
  let payerWallet: Wallet;

  if (adminPrivateKeyString) {
    try {
      const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(adminPrivateKeyString))
      );
      payerWallet = new NodeWallet(adminKeypair);
      console.log(
        "Using admin wallet from ADMIN_WALLET_PRIVATE_KEY:",
        adminKeypair.publicKey.toBase58()
      );
    } catch (e) {
      console.error(
        "Failed to parse ADMIN_WALLET_PRIVATE_KEY. Falling back to Anchor.toml wallet.",
        e
      );
      // Fallback to Anchor.toml provider if env var is invalid
      const provider = anchor.AnchorProvider.env();
      anchor.setProvider(provider);
      payerWallet = provider.wallet as Wallet; // Cast because provider.wallet can be Wallet | undefined
    }
  } else {
    console.log(
      "ADMIN_WALLET_PRIVATE_KEY not set. Falling back to Anchor.toml wallet."
    );
    // Fallback to Anchor.toml provider if env var is not set
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    payerWallet = provider.wallet as Wallet; // Cast
  }

  // If payerWallet is still not defined, we can't proceed.
  if (!payerWallet || !payerWallet.publicKey) {
    console.error("Payer wallet could not be determined. Exiting.");
    process.exit(1);
  }
  
  // Configure the client to use the local cluster with the determined payer.
  // If we created payerWallet from NodeWallet, we need to create a new provider.
  // If we used AnchorProvider.env(), setProvider was already called.
  // For simplicity, always create/set provider here based on payerWallet.
  const connection = new anchor.web3.Connection(
    process.env.SOLANA_RPC_URL || anchor.AnchorProvider.env().connection.rpcEndpoint, // Use env var or fallback
    "confirmed"
  );
  const provider = new anchor.AnchorProvider(connection, payerWallet, anchor.AnchorProvider.defaultOptions());
  anchor.setProvider(provider);


  const program = anchor.workspace.Whiskeyprogram as Program<Whiskeyprogram>;
  // const payer = provider.wallet; // payer is now payerWallet

  console.log("Using payer address for script:", payerWallet.publicKey.toBase58());

  // Derive the PDA for ProgramAdminConfig
  const [programAdminConfigPda, bump] =
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("program_super_admin")],
      program.programId
    );

  console.log("Program Admin Config PDA:", programAdminConfigPda.toBase58());
  console.log("Program ID:", program.programId.toBase58());

  try {
    // Check if the account already exists to avoid re-initialization errors
    const accountInfo = await provider.connection.getAccountInfo(programAdminConfigPda);
    if (accountInfo) {
      console.log("ProgramAdminConfig account already initialized at:", programAdminConfigPda.toBase58());
      // Optionally, you could try to fetch and display its data here
      // const existingConfig = await program.account.programAdminConfig.fetch(programAdminConfigPda);
      // console.log("Existing super admin key:", existingConfig.superAdminKey.toBase58());
      return;
    }

    console.log("Initializing ProgramAdminConfig account...");

    const tx = await program.methods
      .initializeSuperAdmin()
      .accounts({
        payer: payerWallet.publicKey,
        programAdminConfig: programAdminConfigPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log("InitializeSuperAdmin transaction signature", tx);
    console.log(
      `ProgramAdminConfig initialized successfully at ${programAdminConfigPda.toBase58()}`
    );
    console.log(`Super admin key set to: ${payerWallet.publicKey.toBase58()}`);

    // Fetch and log the created account data for verification
    const createdConfig = await program.account.programAdminConfig.fetch(programAdminConfigPda);
    console.log("Fetched super admin key after creation:", createdConfig.superAdminKey.toBase58());
    console.log("Fetched bump:", createdConfig.bump);


  } catch (error) {
    console.error("Error initializing super admin:", error);
    if (error.logs) {
      console.error("Transaction logs:");
      error.logs.forEach(log => console.log(log));
    }
  }
}

initializeSuperAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 