import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lendingprogram } from "../target/types/lendingprogram";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("Project Stardust Lending Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Lendingprogram as Program<Lendingprogram>;
  
  // Test accounts
  let admin: Keypair;
  let oracleAuthority: Keypair;
  let borrower: Keypair;
  let lender: Keypair;

  // Token mints
  let whiskeyMint: PublicKey;
  let usdcMint: PublicKey;
  let usdtMint: PublicKey;
  let nftMint: PublicKey;
  let usdwMint: PublicKey;

  // Treasury vaults
  let treasuryVaultUsdc: PublicKey;
  let treasuryVaultUsdt: PublicKey;
  let whiskeyRewardsVault: PublicKey;
  let whiskeyTreasuryVault: PublicKey;

  // Program PDAs
  let globalMarketPda: PublicKey;
  let usdcReservePda: PublicKey;
  let usdtReservePda: PublicKey;
  let loanPda: PublicKey;
  let collateralEscrowPda: PublicKey;

  // Asset vaults
  let usdcAssetVault: PublicKey;
  let usdtAssetVault: PublicKey;

  // NFT collection key (mock)
  const nftCollectionKey = new PublicKey("11111111111111111111111111111112");
  const totalNftSupply = 1000;

  before(async () => {
    // Initialize test accounts
    admin = Keypair.generate();
    oracleAuthority = Keypair.generate();
    borrower = Keypair.generate();
    lender = Keypair.generate();

    // Airdrop SOL to test accounts
    await Promise.all([
      provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(admin.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL)
      ),
      provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(oracleAuthority.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
      ),
      provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(borrower.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL)
      ),
      provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(lender.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL)
      ),
    ]);

    // Create token mints
    whiskeyMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      6 // 6 decimals
    );

    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      6 // 6 decimals
    );

    usdtMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      6 // 6 decimals
    );

    nftMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      0 // NFTs have 0 decimals
    );

    usdwMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      admin.publicKey,
      6 // 6 decimals
    );

    // Create treasury vaults
    treasuryVaultUsdc = await createAccount(
      provider.connection,
      admin,
      usdcMint,
      admin.publicKey
    );

    treasuryVaultUsdt = await createAccount(
      provider.connection,
      admin,
      usdtMint,
      admin.publicKey
    );

    whiskeyRewardsVault = await createAccount(
      provider.connection,
      admin,
      whiskeyMint,
      admin.publicKey
    );

    whiskeyTreasuryVault = await createAccount(
      provider.connection,
      admin,
      whiskeyMint,
      admin.publicKey
    );

    // Create asset vaults for lending reserves
    usdcAssetVault = await createAccount(
      provider.connection,
      admin,
      usdcMint,
      admin.publicKey // Will be transferred to PDA later
    );

    usdtAssetVault = await createAccount(
      provider.connection,
      admin,
      usdtMint,
      admin.publicKey // Will be transferred to PDA later
    );

    // Mint some tokens for testing
    await mintTo(
      provider.connection,
      admin,
      whiskeyMint,
      whiskeyTreasuryVault,
      admin,
      1_000_000 * 1e6 // 1M WHISKEY tokens
    );

    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      treasuryVaultUsdc,
      admin,
      1_000_000 * 1e6 // 1M USDC
    );

    // Mint NFT to borrower
    const borrowerNftAccount = getAssociatedTokenAddressSync(nftMint, borrower.publicKey);
    await mintTo(
      provider.connection,
      admin,
      nftMint,
      borrowerNftAccount,
      admin,
      1
    );

    // Mint USDC to lender for liquidity provision
    const lenderUsdcAccount = getAssociatedTokenAddressSync(usdcMint, lender.publicKey);
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      lenderUsdcAccount,
      admin,
      100_000 * 1e6 // 100k USDC
    );

    // Calculate PDAs
    [globalMarketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_market")],
      program.programId
    );

    [usdcReservePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_reserve"), usdcMint.toBuffer()],
      program.programId
    );

    [usdtReservePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("lending_reserve"), usdtMint.toBuffer()],
      program.programId
    );

    [loanPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("loan"), borrower.publicKey.toBuffer(), nftMint.toBuffer()],
      program.programId
    );

    [collateralEscrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("collateral_escrow"), borrower.publicKey.toBuffer(), nftMint.toBuffer()],
      program.programId
    );
  });

  describe("Initialization", () => {
    it("Initializes global market", async () => {
      await program.methods
        .initializeGlobalMarket(nftCollectionKey, totalNftSupply)
        .accounts({
          globalMarket: globalMarketPda,
          owner: admin.publicKey,
          oracleAuthority: oracleAuthority.publicKey,
          treasuryVaultUsdc,
          treasuryVaultUsdt,
          whiskeyRewardsVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const globalMarket = await program.account.globalMarket.fetch(globalMarketPda);
      expect(globalMarket.owner.toString()).to.equal(admin.publicKey.toString());
      expect(globalMarket.oracleAuthority.toString()).to.equal(oracleAuthority.publicKey.toString());
      expect(globalMarket.nftCollectionKey.toString()).to.equal(nftCollectionKey.toString());
      expect(globalMarket.totalNftSupply).to.equal(totalNftSupply);
    });

    it("Updates treasury values", async () => {
      const btcValue = new anchor.BN("50000000000"); // $50,000 in smallest units
      const goldValue = new anchor.BN("30000000000"); // $30,000
      const barrelsValue = new anchor.BN("20000000000"); // $20,000

      await program.methods
        .updateTreasuryValues(btcValue, goldValue, barrelsValue)
        .accounts({
          globalMarket: globalMarketPda,
          oracleAuthority: oracleAuthority.publicKey,
        })
        .signers([oracleAuthority])
        .rpc();

      const globalMarket = await program.account.globalMarket.fetch(globalMarketPda);
      expect(globalMarket.btcTreasuryValueUsd.toString()).to.equal(btcValue.toString());
      expect(globalMarket.goldTreasuryValueUsd.toString()).to.equal(goldValue.toString());
      expect(globalMarket.barrelsTreasuryValueUsd.toString()).to.equal(barrelsValue.toString());
      expect(globalMarket.totalTreasuryValueUsd.toString()).to.equal("100000000000");
    });

    it("Creates USDC lending reserve", async () => {
      await program.methods
        .createLendingReserve(
          50, // 50% loan-to-value ratio
          172800, // 2 days grace period
          10 // 10% protocol fee
        )
        .accounts({
          lendingReserve: usdcReservePda,
          globalMarket: globalMarketPda,
          assetMint: usdcMint,
          assetVault: usdcAssetVault,
          usdwMint: usdwMint,
          owner: admin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      const reserve = await program.account.lendingReserve.fetch(usdcReservePda);
      expect(reserve.assetMint.toString()).to.equal(usdcMint.toString());
      expect(reserve.loanToValueRatio).to.equal(50);
      expect(reserve.gracePeriodSecs).to.equal(172800);
      expect(reserve.protocolInterestFee).to.equal(10);
    });
  });

  describe("Liquidity Management", () => {
    it("Deposits liquidity and receives USDW tokens", async () => {
      const depositAmount = 50_000 * 1e6; // 50k USDC
      const lenderUsdcAccount = getAssociatedTokenAddressSync(usdcMint, lender.publicKey);
      const lenderUsdwAccount = getAssociatedTokenAddressSync(usdwMint, lender.publicKey);

      await program.methods
        .depositLiquidity(new anchor.BN(depositAmount))
        .accounts({
          lendingReserve: usdcReservePda,
          assetMint: usdcMint,
          assetVault: usdcAssetVault,
          usdwMint: usdwMint,
          userTokenAccount: lenderUsdcAccount,
          userUsdwAccount: lenderUsdwAccount,
          user: lender.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([lender])
        .rpc();

      const reserve = await program.account.lendingReserve.fetch(usdcReservePda);
      expect(reserve.totalDeposits.toString()).to.equal(depositAmount.toString());
      expect(reserve.totalUsdwSupply.toString()).to.equal(depositAmount.toString());

      const lenderUsdwBalance = await getAccount(provider.connection, lenderUsdwAccount);
      expect(lenderUsdwBalance.amount.toString()).to.equal(depositAmount.toString());
    });
  });

  describe("Lending", () => {
    it("Takes a loan against NFT collateral", async () => {
      const loanAmount = 25_000 * 1e6; // 25k USDC (50% of 50k NFT value)
      const durationSecs = 2592000; // 1 month
      const interestRateBps = 500; // 5%

      const borrowerNftAccount = getAssociatedTokenAddressSync(nftMint, borrower.publicKey);
      const borrowerUsdcAccount = getAssociatedTokenAddressSync(usdcMint, borrower.publicKey);

      await program.methods
        .takeLoan(
          new anchor.BN(loanAmount),
          durationSecs,
          interestRateBps
        )
        .accounts({
          globalMarket: globalMarketPda,
          lendingReserve: usdcReservePda,
          loan: loanPda,
          collateralEscrow: collateralEscrowPda,
          assetMint: usdcMint,
          assetVault: usdcAssetVault,
          nftMint: nftMint,
          nftTokenAccount: borrowerNftAccount,
          borrowerTokenAccount: borrowerUsdcAccount,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([borrower])
        .rpc();

      const loan = await program.account.loan.fetch(loanPda);
      expect(loan.owner.toString()).to.equal(borrower.publicKey.toString());
      expect(loan.principalAmount.toString()).to.equal(loanAmount.toString());
      expect(loan.durationSecs).to.equal(durationSecs);
      expect(loan.interestRateBps).to.equal(interestRateBps);
      expect(loan.status).to.deep.equal({ active: {} });

      // Check that NFT was transferred to escrow
      const escrowAccount = await getAccount(provider.connection, collateralEscrowPda);
      expect(escrowAccount.amount.toString()).to.equal("1");

      // Check that borrower received USDC
      const borrowerUsdcBalance = await getAccount(provider.connection, borrowerUsdcAccount);
      expect(borrowerUsdcBalance.amount.toString()).to.equal(loanAmount.toString());

      // Check reserve state updated
      const reserve = await program.account.lendingReserve.fetch(usdcReservePda);
      expect(reserve.totalBorrowed.toString()).to.equal(loanAmount.toString());
    });

    it("Makes an interest payment", async () => {
      const paymentAmount = 1_250 * 1e6; // 1,250 USDC (5% of 25k)
      const borrowerUsdcAccount = getAssociatedTokenAddressSync(usdcMint, borrower.publicKey);
      const borrowerNftAccount = getAssociatedTokenAddressSync(nftMint, borrower.publicKey);

      await program.methods
        .makeInterestPayment(new anchor.BN(paymentAmount))
        .accounts({
          loan: loanPda,
          lendingReserve: usdcReservePda,
          assetVault: usdcAssetVault,
          treasuryVault: treasuryVaultUsdc,
          borrowerTokenAccount: borrowerUsdcAccount,
          borrowerNftAccount: borrowerNftAccount,
          collateralEscrow: collateralEscrowPda,
          borrower: borrower.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([borrower])
        .rpc();

      const loan = await program.account.loan.fetch(loanPda);
      expect(loan.amountRepaid.toString()).to.equal(paymentAmount.toString());

      // Check protocol fee was collected
      const treasuryBalance = await getAccount(provider.connection, treasuryVaultUsdc);
      const expectedFee = Math.floor(paymentAmount * 0.1); // 10% protocol fee
      expect(treasuryBalance.amount.toString()).to.equal(expectedFee.toString());
    });
  });

  describe("NFT Selling", () => {
    it("Sells NFT for WHISKEY tokens", async () => {
      // First, mint another NFT to a new user for this test
      const seller = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(seller.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const sellerNftMint = await createMint(
        provider.connection,
        admin,
        admin.publicKey,
        admin.publicKey,
        0
      );

      const sellerNftAccount = getAssociatedTokenAddressSync(sellerNftMint, seller.publicKey);
      await mintTo(
        provider.connection,
        admin,
        sellerNftMint,
        sellerNftAccount,
        admin,
        1
      );

      const sellerWhiskeyAccount = getAssociatedTokenAddressSync(whiskeyMint, seller.publicKey);

      await program.methods
        .sellNftForWhiskey()
        .accounts({
          globalMarket: globalMarketPda,
          nftMint: sellerNftMint,
          userNftAccount: sellerNftAccount,
          userWhiskeyAccount: sellerWhiskeyAccount,
          whiskeyTreasuryVault: whiskeyTreasuryVault,
          whiskeyMint: whiskeyMint,
          user: seller.publicKey,
          admin: admin.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([seller, admin])
        .rpc();

      // Check that seller received WHISKEY tokens
      const sellerWhiskeyBalance = await getAccount(provider.connection, sellerWhiskeyAccount);
      const expectedWhiskeyAmount = 100_000_000_000 / totalNftSupply; // Total treasury value / NFT supply
      expect(sellerWhiskeyBalance.amount.toString()).to.equal(expectedWhiskeyAmount.toString());

      // Check that NFT was burned (supply should be 0)
      const nftMintInfo = await provider.connection.getTokenSupply(sellerNftMint);
      expect(nftMintInfo.value.uiAmount).to.equal(0);
    });
  });

  describe("Default Handling", () => {
    it("Triggers default on expired loan", async () => {
      // This test would require time manipulation or a separate loan
      // For now, we'll create a basic structure
      
      // In a real test, you would:
      // 1. Create a loan with a very short duration
      // 2. Wait for it to expire
      // 3. Call trigger_default
      // 4. Verify the NFT was seized and debt was covered
      
      console.log("Default handling test would require time manipulation");
      // This is a placeholder for the actual test implementation
    });
  });
});