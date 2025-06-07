'use client';

import React from 'react';
import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Navbar = () => {
  return (
    <nav className="bg-brand-surface shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link href="/" className="text-3xl font-bold text-brand-primary hover:text-brand-accent transition-colors font-serif">
              Planet Whiskey
            </Link>
          </div>
          
          {/* Centered div to act as a flex spacer, pushing brand to left and actions to right */}
          {/* This isn't strictly a visual separator but helps structure, visual one is next */}
          <div className="flex-grow"></div>

          <div className="flex items-center">
            {/* Optional: A subtle vertical divider */}
            <div className="hidden md:block h-8 w-px bg-brand-border mx-6"></div>

            <div className="hidden md:block">
              <div className="flex items-baseline space-x-4">
                {/* Add nav links here, e.g.: */}
                {/* <Link href="/explore" className="text-brand-text-secondary hover:text-brand-primary px-3 py-2 rounded-md text-sm font-medium">Explore</Link> */}
                {/* <Link href="/about" className="text-brand-text-secondary hover:text-brand-primary px-3 py-2 rounded-md text-sm font-medium">About</Link> */}
              </div>
            </div>
            {/* Wallet Connect Button - ensuring it's distinct */}
            <div className="ml-4">
              <WalletMultiButton />
            </div>
          </div>
          {/* Mobile menu button - future enhancement */}
          {/* <div className="-mr-2 flex md:hidden">
            <button type="button" className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white">
              <span className="sr-only">Open main menu</span>
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg className="hidden h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div> */}
        </div>
      </div>
      {/* Mobile menu, show/hide based on menu state - future enhancement */}
      {/* <div className="md:hidden">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link href="/explore" className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">Explore</Link>
          <Link href="/about" className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">About</Link>
        </div>
      </div> */}
    </nav>
  );
};

export default Navbar; 