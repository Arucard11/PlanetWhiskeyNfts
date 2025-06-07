import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Whiskeyprogram } from "../target/types/whiskeyprogram";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID,ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { PROGRAM_ID as MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { expect } from "chai";

describe("solana-program", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Whiskeyprogram as Program<Whiskeyprogram>;
  const payer = provider.wallet as anchor.Wallet;

  // New mint keypair for the collection NFT
  const collectionMintKeypair = Keypair.generate();

  // Test parameters
  const collectionName = "Test Collection";
  const collectionSymbol = "TEST";
  const collectionMetadataUri = "https://example.com/collection.json";
  const mintPrice = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 1 SOL
  const itemLimit = new anchor.BN(100);

  // Declare variables for PDA and bump
  let programAdminConfigPDA: PublicKey;
  let programAdminConfigBump: number;

  before(async () => {
    // Derive PDA for ProgramAdminConfig inside an async before hook
    [programAdminConfigPDA, programAdminConfigBump] =
      await PublicKey.findProgramAddress(
        [anchor.utils.bytes.utf8.encode("program_super_admin")],
        program.programId
      );
  });

  it("Initializes Super Admin", async () => {
    try {
      const tx = await program.methods
        .initializeSuperAdmin()
        .accounts({
          payer: payer.publicKey,
          programAdminConfig: programAdminConfigPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Initialize Super Admin transaction signature", tx);

      // Fetch the created ProgramAdminConfig account to verify
      const adminConfigAccount =
        await program.account.programAdminConfig.fetch(programAdminConfigPDA);
      expect(adminConfigAccount.superAdminKey.toBase58()).to.equal(
        payer.publicKey.toBase58()
      );
      expect(adminConfigAccount.bump).to.equal(programAdminConfigBump);
    } catch (error) {
      console.error("Error initializing super admin:", error);
      throw error;
    }
  });

  it("Creates a new NFT collection", async () => {
    // Derive PDA for CollectionConfig
    const [collectionConfigPDA, collectionConfigBump] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("collection"),
        anchor.utils.bytes.utf8.encode(collectionName),
      ],
      program.programId
    );

    // Derive PDA for Metaplex metadata and master edition
    const [metadataPDA] = await PublicKey.findProgramAddress(
        [
            anchor.utils.bytes.utf8.encode("metadata"),
            MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            collectionMintKeypair.publicKey.toBuffer(),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
    );

    const [masterEditionPDA] = await PublicKey.findProgramAddress(
        [
            anchor.utils.bytes.utf8.encode("metadata"),
            MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            collectionMintKeypair.publicKey.toBuffer(),
            anchor.utils.bytes.utf8.encode("edition"),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
    );

    console.log("Payer:", payer.publicKey.toBase58());
    console.log("Collection Mint:", collectionMintKeypair.publicKey.toBase58());
    console.log("Collection Config PDA:", collectionConfigPDA.toBase58());
    console.log("Metadata PDA:", metadataPDA.toBase58());
    console.log("Master Edition PDA:", masterEditionPDA.toBase58());
    console.log("Token Metadata Program ID:", MPL_TOKEN_METADATA_PROGRAM_ID.toBase58());
    console.log("Program Admin Config PDA:", programAdminConfigPDA.toBase58());

    // Call the create_collection instruction
    try {
        const tx = await program.methods
        .createCollection(
            collectionName,
            collectionSymbol,
            collectionMetadataUri,
            mintPrice,
            itemLimit
        )
        .accounts({
            payer: payer.publicKey,
            programAdminConfig: programAdminConfigPDA,
            collectionConfig: collectionConfigPDA,
            collectionMint: collectionMintKeypair.publicKey,
            metadataAccount: metadataPDA,
            masterEditionAccount: masterEditionPDA,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([collectionMintKeypair])
        .rpc();
        console.log("Transaction signature", tx);
    } catch (error) {
        console.error("Error creating collection:", error);
        throw error;
    }
    

    // Fetch the created CollectionConfig account
    const collectionConfigAccount = await program.account.collectionConfig.fetch(collectionConfigPDA);

    // Assertions
    expect(collectionConfigAccount.authority.toBase58()).to.equal(payer.publicKey.toBase58());
    expect(collectionConfigAccount.collectionMint.toBase58()).to.equal(collectionMintKeypair.publicKey.toBase58());
    expect(collectionConfigAccount.name).to.equal(collectionName);
    expect(collectionConfigAccount.symbol).to.equal(collectionSymbol);
    expect(collectionConfigAccount.metadataUri).to.equal(collectionMetadataUri);
    expect(collectionConfigAccount.mintPrice.toString()).to.equal(mintPrice.toString());
    expect(collectionConfigAccount.itemLimit.toString()).to.equal(itemLimit.toString());
    expect(collectionConfigAccount.itemsMinted.toString()).to.equal("0");
    expect(collectionConfigAccount.bump).to.equal(collectionConfigBump);

    // TODO: Add assertions to verify the on-chain state of:
    // 1. Collection Mint account (initialized, 0 decimals, correct authorities)
    // 2. Metadata Account (correct data: name, symbol, uri, creators, collection field is None)
    // 3. Master Edition Account (correct supply, max_supply)
  });
}); 