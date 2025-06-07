"use client";

import React from 'react';
import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Header = () => {
  return (
    <header className="bg-brand-surface shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl md:text-3xl font-bold cool-gradient-text">
                Planet Whiskey
            </Link>
          </div>
          <nav className="flex items-center space-x-4">
            {/* Example Admin Link - show if appropriate */}
            {/* <Link href="/admin" className="text-brand-text-secondary hover:text-brand-text-primary transition-colors">
              Admin
            </Link> */}
            <WalletMultiButton 
              className="!bg-brand-secondary hover:!bg-blue-600 !text-white !font-semibold !py-2 !px-4 !rounded-lg !transition-all !duration-300"
              style={{ lineHeight: 'normal' }} // Ensures text is vertically centered
            />
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header; 