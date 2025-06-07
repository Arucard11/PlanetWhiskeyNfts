"use client"; // This page now fetches data client-side

import React, { useEffect, useState } from 'react';
// import Image from "next/image"; // Keep if used, remove if not
// import Layout from "@/components/Layout"; // Remove this if Header/Footer are in root layout
import CompanyCard from '@/components/CompanyCard';
import NftCollectionCard from '@/components/NftCollectionCard';
// Removed Chakra UI imports: import { Box, Heading, Text, VStack, HStack, Link, Spinner, Center } from "@chakra-ui/react";
import Link from 'next/link'; // Using Next.js Link for navigation

// Define a type for the company data we expect from the API
// This should align with your ICompany interface from the backend model
// and CompanyCardProps
interface CompanyData {
  _id: string; // MongoDB ID
  name: string;
  description?: string;
  // Add other fields if your API returns them and you need them
}

export default function Home() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/companies');
        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setCompanies(result.data);
        } else {
          throw new Error('Fetched data is not in the expected format.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchCompanies();
  }, []); // Empty dependency array means this runs once on mount

  return (
    // <Layout> // Remove this if Header/Footer are in root layout
    <> {/* Use React Fragment if Layout component is removed */}
      {/* Hero Section - Updated with new light theme */}
      <section className="bg-gradient-cool-hero py-24 md:py-40 text-center"> {/* Using updated light gradient */}
        <div className="container mx-auto px-4">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 text-brand-text-primary tracking-tight font-serif"> {/* Using brand text, serif font */}
            Discover NFT-Backed Whiskey Barrels
          </h1>
          <p className="text-xl md:text-2xl font-sans mb-10 max-w-3xl mx-auto text-brand-text-secondary leading-relaxed"> {/* Using brand text */}
            Own a piece of history. Invest in exclusive whiskey barrels, each represented by a unique NFT from the world's most renowned distilleries.
          </p>
          <Link
            href="#distilleries"
            className="bg-brand-accent hover:bg-amber-600 text-white font-bold font-sans py-4 px-10 rounded-lg text-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-amber-400 focus:ring-opacity-50" // Using brand-accent (amber), text-white for contrast
          >
            Explore Collections
          </Link>
        </div>
      </section>

      {/* Stats Bar Section */}
      <section className="bg-brand-surface py-6 border-b border-brand-border">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16 text-center">
          <div>
            <span className="text-3xl font-bold text-brand-primary font-serif">1,250+</span>
            <div className="text-brand-text-secondary text-sm mt-1 font-sans">NFTs Minted</div>
          </div>
          <div className="hidden md:block w-px h-8 bg-brand-border"></div>
          <div>
            <span className="text-3xl font-bold text-brand-primary font-serif">8</span>
            <div className="text-brand-text-secondary text-sm mt-1 font-sans">Partner Distilleries</div>
          </div>
          <div className="hidden md:block w-px h-8 bg-brand-border"></div>
          <div>
            <span className="text-3xl font-bold text-brand-primary font-serif">15</span>
            <div className="text-brand-text-secondary text-sm mt-1 font-sans">Collections Available</div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-20 bg-brand-background border-b border-brand-border">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-brand-primary font-serif text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 max-w-5xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="bg-amber-100 text-amber-700 rounded-full p-5 mb-4 shadow-lg">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-brand-text-primary">Browse Collections</h3>
              <p className="text-brand-text-secondary text-sm text-center">Explore exclusive NFT collections of whiskey barrels from top distilleries.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-amber-100 text-amber-700 rounded-full p-5 mb-4 shadow-lg">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75A2.25 2.25 0 0014.25 4.5h-4.5A2.25 2.25 0 007.5 6.75v10.5A2.25 2.25 0 009.75 19.5h4.5A2.25 2.25 0 0016.5 17.25V13.5" /></svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-brand-text-primary">Connect Wallet</h3>
              <p className="text-brand-text-secondary text-sm text-center">Securely connect your Solana wallet to get started.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-amber-100 text-amber-700 rounded-full p-5 mb-4 shadow-lg">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 1.5" /></svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-brand-text-primary">Mint NFT</h3>
              <p className="text-brand-text-secondary text-sm text-center">Mint your NFT and receive ownership of a real whiskey barrel, secured on the blockchain.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-amber-100 text-amber-700 rounded-full p-5 mb-4 shadow-lg">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 17v-1m0 0a5 5 0 100-10 5 5 0 000 10zm0 0v1m0 4h.01" /></svg>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-brand-text-primary">Own & Trade</h3>
              <p className="text-brand-text-secondary text-sm text-center">Showcase, trade, or redeem your NFT-backed whiskey barrel.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Collections Section */}
      <section className="py-16 md:py-20 bg-gradient-to-b from-brand-background to-brand-surface border-b border-brand-border">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-10 text-brand-primary font-serif text-center">Featured Collections</h2>
          <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch">
            {/* Placeholder featured collections, replace with real data as needed */}
            {/* Example 1 */}
            <div className="flex-1 min-w-[280px] max-w-xs mx-auto">
              <NftCollectionCard
                _id="featured1"
                collectionOnChainAddress="featured1PDA"
                name="Highland Reserve 2023"
                symbol="HLR23"
                metadataUri="https://gateway.pinata.cloud/ipfs/QmExample1/metadata.json"
                mintPriceLamports={2500000000}
                itemLimit={500}
                itemsMintedOnChain={320}
              />
            </div>
            {/* Example 2 */}
            <div className="flex-1 min-w-[280px] max-w-xs mx-auto">
              <NftCollectionCard
                _id="featured2"
                collectionOnChainAddress="featured2PDA"
                name="Islay Legends: Peat Edition"
                symbol="ISLPEAT"
                metadataUri="https://gateway.pinata.cloud/ipfs/QmExample2/metadata.json"
                mintPriceLamports={3500000000}
                itemLimit={300}
                itemsMintedOnChain={210}
              />
            </div>
            {/* Example 3 */}
            <div className="flex-1 min-w-[280px] max-w-xs mx-auto">
              <NftCollectionCard
                _id="featured3"
                collectionOnChainAddress="featured3PDA"
                name="Bourbon Masters Select"
                symbol="BMS2023"
                metadataUri="https://gateway.pinata.cloud/ipfs/QmExample3/metadata.json"
                mintPriceLamports={4200000000}
                itemLimit={100}
                itemsMintedOnChain={77}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Distilleries Section - Updated with new light theme */}
      <section id="distilleries" className="py-20 md:py-24 bg-brand-background"> {/* Use new brand-background */}
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 md:mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-brand-primary font-serif">Our Partner Distilleries</h2> {/* Using brand-primary, serif font */}
            <p className="text-lg md:text-xl text-brand-text-secondary max-w-2xl mx-auto font-sans leading-relaxed">
              We collaborate with the finest distilleries to bring you unique, verifiable digital collectibles.
            </p>
          </div>

          {isLoading && (
            <div className="flex flex-col justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-accent mb-4"></div> {/* Spinner uses brand-accent */}
              <p className="text-lg text-brand-text-secondary font-sans">Loading distilleries...</p>
            </div>
          )}
          {error && <p className="text-center text-red-600 py-10 font-sans text-lg">Error: {error}</p>} {/* Standard error color */}

          {!isLoading && !error && companies.length === 0 && (
            <div className="text-center py-10 bg-brand-surface rounded-3xl border-2 border-brand-border shadow-card-hover"> {/* Bubble panel look */}
              <svg className="mx-auto h-16 w-16 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"> {/* Larger icon, brand-secondary color */}
                <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-1.5m-15-13.5H18M3.75 7.5h16.5M3.75 7.5V3.545M3.75 7.5A2.25 2.25 0 006 5.25h12A2.25 2.25 0 0020.25 7.5M3.75 7.5V21" />
              </svg>
              <h3 className="mt-4 text-2xl font-semibold text-brand-text-primary font-serif">No Partner Distilleries</h3>
              <p className="mt-2 text-md text-brand-text-secondary font-sans">We are currently curating our collection of partner distilleries. Please check back soon for exclusive offerings.</p>
            </div>
          )}

          {!isLoading && !error && companies.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {companies.map((company) => (
                <CompanyCard
                  key={company._id}
                  id={company._id}
                  name={company.name}
                  description={company.description}
                />
              ))}
            </div>
          )}
        </div>
      </section>

    </>
    // </Layout> // Remove this
  );
}
