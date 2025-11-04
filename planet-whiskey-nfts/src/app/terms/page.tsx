"use client";

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
            Terms of Service
          </h1>
          
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl p-8 shadow-xl">
            <p className="text-gray-400 mb-6 text-center">
              Last Updated: {new Date().toLocaleDateString()}
            </p>

            <div className="space-y-8 text-gray-300">
              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">1. Acceptance of Terms</h2>
                <p className="leading-relaxed">
                  By accessing and using Three Gold Treasury NFTs ("Platform"), you accept and agree to be bound by the terms and provision of this agreement. 
                  If you do not agree to abide by the above, please do not use this service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">2. Risk Disclosure and Limitation of Liability</h2>
                <div className="space-y-4">
                  <p className="leading-relaxed">
                    <strong className="text-amber-300">CRYPTOCURRENCY AND NFT RISKS:</strong> Trading, holding, and interacting with NFTs, cryptocurrencies, 
                    and decentralized finance (DeFi) protocols involves substantial risk of loss. You acknowledge that:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Cryptocurrency values are highly volatile and may result in significant financial losses</li>
                    <li>NFT values may fluctuate dramatically or become worthless</li>
                    <li>Smart contracts may contain bugs, vulnerabilities, or fail to perform as intended</li>
                    <li>Blockchain networks may experience congestion, forks, or other technical issues</li>
                    <li>Regulatory changes may affect the legality or value of digital assets</li>
                    <li>There is no guarantee of liquidity for any digital assets</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">3. No Liability for Losses</h2>
                <p className="leading-relaxed">
                  <strong className="text-red-400">DISCLAIMER:</strong> Three Gold Treasury NFTs, its owners, operators, developers, and affiliates 
                  SHALL NOT BE LIABLE for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                  <li>Loss of funds, tokens, NFTs, or other digital assets</li>
                  <li>Loss of profits, revenue, or business opportunities</li>
                  <li>Technical failures, smart contract bugs, or blockchain issues</li>
                  <li>Hacking, theft, or unauthorized access to accounts</li>
                  <li>Market volatility or price fluctuations</li>
                  <li>Regulatory actions or legal changes</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">4. Use at Your Own Risk</h2>
                <p className="leading-relaxed">
                  You expressly understand and agree that your use of the Platform is at your sole risk. The Platform is provided on an "AS IS" and 
                  "AS AVAILABLE" basis. You are solely responsible for:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                  <li>Securing your wallet and private keys</li>
                  <li>Verifying all transactions before confirmation</li>
                  <li>Understanding the risks of DeFi and NFT trading</li>
                  <li>Complying with applicable laws and regulations</li>
                  <li>Conducting your own research before making any investments</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">5. No Investment Advice</h2>
                <p className="leading-relaxed">
                  Nothing on this Platform constitutes investment, financial, trading, or other advice. All content is for informational purposes only. 
                  You should consult with qualified professionals before making any investment decisions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">6. Platform Availability</h2>
                <p className="leading-relaxed">
                  We do not guarantee that the Platform will be available at all times. The Platform may be temporarily unavailable due to maintenance, 
                  updates, or technical issues. We reserve the right to modify, suspend, or discontinue the Platform at any time without notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">7. User Responsibilities</h2>
                <p className="leading-relaxed">You agree to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
                  <li>Use the Platform only for lawful purposes</li>
                  <li>Not attempt to hack, exploit, or damage the Platform</li>
                  <li>Not engage in market manipulation or fraudulent activities</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Not hold us liable for your actions or losses</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">8. Indemnification</h2>
                <p className="leading-relaxed">
                  You agree to indemnify, defend, and hold harmless Three Gold Treasury NFTs and its affiliates from and against any and all claims, 
                  damages, obligations, losses, liabilities, costs, and expenses arising from your use of the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">9. Governing Law</h2>
                <p className="leading-relaxed">
                  These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-amber-400 mb-4">10. Changes to Terms</h2>
                <p className="leading-relaxed">
                  We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new Terms.
                </p>
              </section>

              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 mt-8">
                <h3 className="text-xl font-semibold text-red-400 mb-3">⚠️ Important Warning</h3>
                <p className="text-red-300">
                  By using this Platform, you acknowledge that you understand the risks involved with cryptocurrency, NFTs, and DeFi protocols. 
                  You agree that you may lose all funds you invest and that Three Gold Treasury NFTs bears no responsibility for such losses.
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <Link 
                href="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold rounded-lg transition-all duration-300"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
