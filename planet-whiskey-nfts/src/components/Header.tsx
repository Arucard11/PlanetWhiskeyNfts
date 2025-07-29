"use client";

import React from 'react';
import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Header = () => {
  return (
    <header className="bg-slate-900/95 backdrop-blur-xl border-b border-amber-500/20 shadow-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex-shrink-0">
            <Link href="/" className="group flex items-center space-x-3">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-amber-500/25">
                  <span className="text-2xl">🥃</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500 font-serif">
                  Planet Whiskey
                </h1>
                <p className="text-xs text-gray-400 font-medium tracking-wider uppercase">
                  Exchange
                </p>
              </div>
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            {/* Example Admin Link - show if appropriate */}
            {/* <Link href="/admin" className="text-brand-text-secondary hover:text-brand-text-primary transition-colors">
              Admin
            </Link> */}
            <WalletMultiButton />
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header; 