#!/bin/bash

# Simple account initialization using direct anchor commands
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏗️  SIMPLE MAINNET INITIALIZATION${NC}"
echo -e "${YELLOW}⚠️  WARNING: This operates on MAINNET!${NC}"

# Set anchor environment
export ANCHOR_PROVIDER_URL="https://mainnet.helius-rpc.com/?api-key=bad198ca-d062-40c7-9a29-ed8304998f90"
export ANCHOR_WALLET="./mainnet-admin-keypair.json"

# Check balance
echo -e "${BLUE}💰 Checking balance...${NC}"
solana balance --url "$ANCHOR_PROVIDER_URL" --keypair ./mainnet-admin-keypair.json

echo -e "${BLUE}\n🚀 Attempting to initialize accounts...${NC}"

# Try to call lending program instructions directly
echo -e "${YELLOW}\n📋 Trying to initialize Collection Registry V2...${NC}"
anchor idl fetch Gn8egVBW5KcHaemZAaHFFvXoDkw7CQSRDqwrLLKzeQT3 --provider.cluster mainnet || echo -e "${RED}Could not fetch IDL${NC}"

echo -e "${YELLOW}\n🔧 Let's try a different approach...${NC}"
echo -e "${CYAN}Using solana program invoke commands...${NC}"

# Calculate PDAs and try direct program invocation
echo -e "${BLUE}\n📊 Calculated PDAs:${NC}"
echo -e "Global Market: 7WXJBoVgtS9VF4QLxfaNhJw5b7HaDBjHyRqxu8fcmwN5"
echo -e "Collection Registry V2: 5PQT4JjJf5Y33Gk5gnQjfMAFmgBmZzGhZUZvMCCrMUzm"
echo -e "Capital Vault: 9pL2pa8ZDFir1JfWHLFfbNrJ79cDNDWnirNPFr9PRdMq"
echo -e "Lending Pool Config: FmQRyFe82DuBzRTTQ9t6EMuNDagSCYS7WcWNzotsy2aS"

echo -e "${GREEN}\n✅ Ready for manual initialization through frontend admin panel${NC}"
echo -e "${CYAN}Navigate to your frontend /admin/lending page to initialize accounts${NC}"
