"use client";

import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-brand-surface border-t border-brand-border mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
        <p className="text-sm text-brand-text-secondary">
          &copy; {new Date().getFullYear()} Planet Whiskey NFTs. All Rights Reserved.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-4">
          <a
            href="https://vercel.com?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-text-secondary hover:text-brand-accent transition-colors duration-200 font-sans"
          >
            Deployed with Vercel
          </a>
          <span className="text-brand-border text-xs hidden sm:inline">|</span>
          <a
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-text-secondary hover:text-brand-accent transition-colors duration-200 font-sans"
          >
            Built with Next.js
          </a>
        </div>
        {/* Optional: Add social media links or other footer content here */}
        {/* <div className="mt-2 space-x-4">
          <a href="#" className="hover:text-brand-accent">Twitter</a>
          <a href="#" className="hover:text-brand-accent">Discord</a>
        </div> */}
      </div>
    </footer>
  );
} 