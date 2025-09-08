# 🏛️ COMPLETE ADDRESS SUMMARY - DEVNET
# Generated: 2025-09-07T18:19:46.850Z

## SHARED ADDRESSES (Used by ALL programs)
Admin Wallet: 2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk
Treasury Wallet: 2VERvChaga6hFBBMFaEzTYpXPgyBo2zbRFuMCVXf1Mhk
WHISKEY Token Mint: FuXejqzRAWWkoAcNrDU8L2i6cXXmB5NwqAVp2daN456j
USDC Token Mint: 5J93GBjngJnZtJoTbdTuSFjqEciQpVVLxMwHmjF1UvAR

## WHISKEY PROGRAM PDAs
Program Super Admin: 4ugq8nFcYein25WrdBHPifY4menfgH4QHTYWw83d1Uzg
Lending Pool Config: 53fYDhvsfCJYMx6eTbjn92N35YDwTShQy8KM3X2yP2GN
WHISKEY Vault V2: FBK8xP4xYuEv1JvCkkvhCKkTtu9M2xXnyihuqSDRAhCS
USDC Vault V2: GJkRmDnhHPLH24MHEGsZoiTm9xveyememDJA5JA6dsgm ← CRITICAL: Lending capital source

## LENDING PROGRAM PDAs
Global Market: 5WYm2YmxdQKHdGTJmvyZ1bmXsyZE2eJGJHPaQP5mopq7
Collection Registry V2: BTsqoh6evqaEq1hYgeetCGUzPVuVsFDCxgLShUidkxGY

## COLLECTION CONFIGS
Planet Whiskey Genesis: 2ZRwU3EfYEcFNeaZu9X57RVhELQz7bWAWTsKRko3BBvM
Whiskey Barrels: 99fniv4HaVuAPvKxoWrLoYcoGnUiwuR85pJeP4KBSQ6s
Distillery Masters: 7yRAUayYPZQPQtDuLSx7bg9qkLz8zz5Ky8E3yaVvwJmQ

## DERIVATION FORMULAS
# Whiskey Program
Program Super Admin = findPDA([b"program_super_admin"], whiskeyProgramId)
Lending Pool Config = findPDA([b"lending_pool"], whiskeyProgramId)  
WHISKEY Vault V2 = findPDA([b"lending_pool", b"whiskey_vault_v2"], whiskeyProgramId)
USDC Vault V2 = findPDA([b"lending_pool", b"usdc_vault_v2"], whiskeyProgramId)
Collection Config = findPDA([b"collection", collection_name], whiskeyProgramId)

# Lending Program  
Global Market = findPDA([b"global_market"], lendingProgramId)
Collection Registry V2 = findPDA([b"collection_registry_v2"], lendingProgramId)
Borrower Account = findPDA([b"borrower_account", user_wallet], lendingProgramId)
Loan = findPDA([b"loan", borrower_wallet, loan_counter], lendingProgramId)

# Marketplace Program
Listing = findPDA([b"listing", seller_wallet, nft_mint], marketplaceProgramId)
Escrow = findPDA([b"escrow", listing_pda], marketplaceProgramId)
