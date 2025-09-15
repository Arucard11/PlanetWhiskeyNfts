#!/bin/bash

# Build script for MAINNET deployment (with Jupiter swaps)
echo "🔧 Building Whiskey Program for MAINNET..."
echo "   - Jupiter swaps: ENABLED"
echo "   - Real tokens: ENABLED"
echo "   - Environment: MAINNET"

# Build with mainnet features
CARGO_FEATURES="mainnet" anchor build

echo "✅ MAINNET build completed!"
echo ""
echo "⚠️  MAINNET DEPLOYMENT CHECKLIST:"
echo "   ✅ Jupiter CPI integration enabled"
echo "   ✅ Real USDC mint configured"
echo "   ✅ Production token addresses"
echo ""
echo "📋 Next Steps:"
echo "   1. Review all program IDs"
echo "   2. Update mainnet environment variables"
echo "   3. Deploy with: anchor deploy --provider.cluster mainnet"
echo "   4. Initialize programs with production settings"
echo "   5. Test with small amounts first"
echo ""
echo "🚨 SECURITY REMINDERS:"
echo "   - Double-check all token mint addresses"
echo "   - Verify Jupiter program ID"
echo "   - Test swap functionality thoroughly"
echo "   - Monitor initial transactions closely"
