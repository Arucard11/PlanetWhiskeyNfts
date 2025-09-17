#!/bin/bash

# MAINNET ACCOUNT INITIALIZATION SCRIPT
# This script initializes all required accounts for mainnet deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Constants
LENDING_PROGRAM_ID="Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3"
WHISKEY_PROGRAM_ID="HPRPYiVvrQ5fwRLt22V6pSzbFaqFTr3eSnww2pm8HAYA"
USDC_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
ADMIN_WALLET="F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X"
TREASURY_WALLET="F26FYy11oqB9eEP4wV3RxpujVRYmDQbuYHpWe5VzEc3X"
LIQUIDATION_AUTHORITY="8UK2j5B9i9etT51SEEkdPRhpERS7ZYTfAtt9FgHAKPxL"
RPC_URL="https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90"

echo -e "${BLUE}🏗️  MAINNET ACCOUNT INITIALIZATION${NC}"
echo -e "${YELLOW}⚠️  WARNING: This operates on MAINNET!${NC}"

# Set environment
export ANCHOR_PROVIDER_URL="$RPC_URL"
export ANCHOR_WALLET="./mainnet-admin-keypair.json"

# Check if wallet exists
if [ ! -f "./mainnet-admin-keypair.json" ]; then
    echo -e "${RED}❌ ERROR: mainnet-admin-keypair.json not found!${NC}"
    exit 1
fi

# Check balance
echo -e "${CYAN}💰 Checking SOL balance...${NC}"
BALANCE=$(solana balance --url "$RPC_URL" --keypair ./mainnet-admin-keypair.json)
echo -e "${CYAN}Balance: $BALANCE${NC}"

echo -e "${BLUE}\n🚀 Starting account initialization...${NC}"

# Step 1: Initialize Collection Registry V2
echo -e "${YELLOW}\n📋 STEP 1: Initialize Collection Registry V2${NC}"
anchor run initializeCollectionRegistryV2 \
    --program-id "$LENDING_PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet ./mainnet-admin-keypair.json \
    || echo -e "${RED}❌ Failed to initialize Collection Registry V2${NC}"

# Step 2: Initialize Global Market
echo -e "${YELLOW}\n🌍 STEP 2: Initialize Global Market${NC}"
anchor run initializeGlobalMarket \
    --program-id "$LENDING_PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet ./mainnet-admin-keypair.json \
    -- --max-staked-nfts 5000 --per-nft-value-usd 100000000 --liquidation-authority "$LIQUIDATION_AUTHORITY" \
    || echo -e "${RED}❌ Failed to initialize Global Market${NC}"

# Step 3: Initialize Capital Vault
echo -e "${YELLOW}\n💰 STEP 3: Initialize Capital Vault${NC}"
anchor run initializeCapitalVault \
    --program-id "$LENDING_PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet ./mainnet-admin-keypair.json \
    || echo -e "${RED}❌ Failed to initialize Capital Vault${NC}"

# Step 4: Initialize Lending Pool (Whiskey Program)
echo -e "${YELLOW}\n🏊 STEP 4: Initialize Lending Pool Config${NC}"
anchor run initializeLendingPool \
    --program-id "$WHISKEY_PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet ./mainnet-admin-keypair.json \
    || echo -e "${RED}❌ Failed to initialize Lending Pool Config${NC}"

# Step 5: Create V2 Vaults (Whiskey Program)
echo -e "${YELLOW}\n🏗️  STEP 5: Create V2 Vaults${NC}"
anchor run createV2Vaults \
    --program-id "$WHISKEY_PROGRAM_ID" \
    --provider.cluster mainnet \
    --provider.wallet ./mainnet-admin-keypair.json \
    || echo -e "${RED}❌ Failed to create V2 Vaults${NC}"

echo -e "${GREEN}\n✅ Account initialization complete!${NC}"
echo -e "${BLUE}📝 Next steps:${NC}"
echo -e "1. Verify all accounts were created successfully"
echo -e "2. Test the system with the frontend"
echo -e "3. Fund the capital vault if needed"

echo -e "${CYAN}\n🔗 Important PDAs created:${NC}"
echo -e "Global Market: 7WXJBoVgtS9VF4QLxfaNhJw5b7HaDBjHyRqxu8fcmwN5"
echo -e "Collection Registry V2: 5PQT4JjJf5Y33Gk5gnQjfMAFmgBmZzGhZUZvMCCrMUzm"
echo -e "Capital Vault: 9pL2pa8ZDFir1JfWHLFfbNrJ79cDNDWnirNPFr9PRdMq"
echo -e "Lending Pool Config: FmQRyFe82DuBzRTTQ9t6EMuNDagSCYS7WcWNzotsy2aS"
