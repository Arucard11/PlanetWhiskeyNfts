"use client";

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "$WHISKEY NFT MINT",
    answer: "• NFTs are priced in $WHISKEY (+real-time USD conversion)\n\n• Each NFT represents a fraction of the assets in the Three Gold Treasury:  Gold, or Bitcoin.\n\n• As a Distiller, you can mint up to five NFTs per wallet."
  },
  {
    question: "$WHISKEY NFT LEND / BORROW",
    answer: "• Use your NFTs as collateral to borrow USDC for 1, 2, or 3 months.\n\n• Deposit up to five NFTs from a single address\n\n• Borrow up to 80% of your NFT's mint value.\n\n• A maximum of five NFTs unlocks the full loan amount offered per address.\n\n• Your NFT stays safely in escrow until the loan and interest are repaid.\n\n• Full Loan amount must paid in the Stable coin borrowed (USDC)\n\n• Interest on loan must be paid in $Whiskey tokens\n\n• If repayment does not occur within a two-day grace period, your NFT will be liquidated."
  },
  {
    question: "$WHISKEY NFT MARKETPLACE",
    answer: "• List your NFTs on the Three Gold Treasury Marketplace\n\n• Set your own asking price.\n\n• Enjoy smooth seamless transactions via this P2P exchange"
  }
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<number[]>([]);

  const toggleItem = (index: number) => {
    setOpenItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

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
            Three Gold Treasury FAQs
          </h1>
          
          <p className="text-xl text-gray-400 text-center mb-12 max-w-3xl mx-auto">
            Everything you need to know about Three Gold Treasury NFTs, our lending protocol, marketplace, and how to get started.
          </p>

          <div className="space-y-4">
            {faqData.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-white/10 rounded-xl overflow-hidden shadow-xl"
              >
                <button
                  onClick={() => toggleItem(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-amber-400 pr-4">
                    {item.question}
                  </h3>
                  {openItems.includes(index) ? (
                    <ChevronUp className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  )}
                </button>
                
                {openItems.includes(index) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="px-6 pb-4"
                  >
                    <div className="border-t border-white/10 pt-4">
                      <div className="text-gray-300 leading-relaxed whitespace-pre-line">
                        {item.answer}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border border-amber-500/30 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-amber-400 mb-3">Still have questions?</h3>
              <p className="text-gray-400 mb-4">
                Remember that this is a decentralized platform with inherent risks. Always do your own research and never invest more than you can afford to lose.
              </p>
              <Link 
                href="/terms"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold rounded-lg transition-all duration-300 mr-4"
              >
                Read Terms of Service
              </Link>
              <Link 
                href="/"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white font-semibold rounded-lg transition-all duration-300"
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
