#!/bin/bash

# Build script for DEVNET deployment (without Jupiter swaps)
echo "🔧 Building Whiskey Program for DEVNET..."
echo "   - Jupiter swaps: DISABLED"
echo "   - Test tokens: ENABLED"
echo "   - Environment: DEVNET"

# Build without mainnet features
anchor build

echo "✅ DEVNET build completed!"
echo ""
echo "📋 Next Steps:"
echo "   1. Deploy with: anchor deploy"
echo "   2. Initialize programs"
echo "   3. Test with devnet tokens"
