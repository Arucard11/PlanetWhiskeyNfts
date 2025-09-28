"use client";

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Shield, Sparkles, ChevronRight } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect } from 'react';

interface AdminUser {
  username: string;
}

interface SessionStatus {
  isLoggedIn: boolean;
  user?: AdminUser;
}

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/admin/session-status');
        if (response.ok) {
          const sessionStatus = await response.json();
          setIsLoggedIn(sessionStatus.isLoggedIn);
        }
      } catch (error) {
        console.error('Error checking admin session:', error);
      }
    }
    checkSession();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {/* Enhanced Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-2xl border-b border-amber-500/30 shadow-2xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Premium Logo */}
            <Link href="/" className="group flex items-center space-x-4">
              <div className="relative">
                <motion.div 
                  className="w-14 h-14 relative shadow-2xl shadow-amber-500/40 rounded-2xl overflow-hidden"
                  whileHover={{ 
                    scale: 1.1, 
                    rotate: 5,
                    boxShadow: "0 25px 50px -12px rgba(251, 191, 36, 0.6)"
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <Image
                    src="/header.jpg"
                    alt="NFT Treasury Logo"
                    layout="fill"
                    objectFit="cover"
                  />
                </motion.div>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                
                {/* Floating sparkles */}
                <motion.div 
                  className="absolute -top-1 -right-1 text-amber-300"
                  animate={{ 
                    rotate: [0, 360],
                    scale: [0.8, 1.2, 0.8]
                  }}
                  transition={{ 
                    rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity }
                  }}
                >
                  <Sparkles size={12} />
                </motion.div>
              </div>
              <div className="block">
                <motion.h1 
                  className="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 font-serif"
                  whileHover={{ scale: 1.05 }}
                >
                  Planet Whiskey
                </motion.h1>
                <motion.p 
                  className="text-[8px] sm:text-xs text-amber-200/80 font-medium tracking-[0.1em] sm:tracking-[0.2em] uppercase"
                  initial={{ opacity: 0.6 }}
                  whileHover={{ opacity: 1 }}
                >
                  RESERVE VAULT
                </motion.p>
              </div>
            </Link>

            {/* Enhanced Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {[
                { href: "/", label: "Home" },
        { href: "/#assets", label: "Collections" },
        { href: "/#how-it-works", label: "Guide" },
                { href: "/marketplace", label: "Marketplace" },
                { href: "/lending", label: "Lending" },
                { href: "/my-nfts", label: "List NFTs" }
              ].map((item, index) => (
                <motion.div key={item.href} className="relative">
                  <Link 
                    href={item.href} 
                    className="text-gray-300 hover:text-amber-400 font-semibold transition-all duration-300 relative group py-2 px-4 rounded-xl hover:bg-amber-500/10"
                  >
                    {item.label}
                    <span className="absolute bottom-0 left-4 w-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600 group-hover:w-8 transition-all duration-300" />
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Enhanced Actions */}
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block">
                <WalletMultiButton />
              </div>

              {/* Admin Button */}
              {isLoggedIn && (
                <div className="hidden sm:block">
                  <Link
                    href="/admin"
                    className="group relative inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-600/80 to-purple-700/80 backdrop-blur-sm text-white text-sm font-bold rounded-xl border border-purple-400/30 hover:from-purple-500 hover:to-purple-600 hover:border-purple-300/50 transition-all duration-300 transform hover:scale-105"
                  >
                    <Shield size={16} className="mr-2" />
                    Admin Dashboard
                  </Link>
                </div>
              )}
              
              {/* Premium Mobile Menu Button */}
              <motion.button
                onClick={toggleMobileMenu}
                className="md:hidden p-3 text-gray-300 hover:text-amber-400 transition-colors duration-300 bg-slate-800/50 rounded-xl backdrop-blur-sm hover:bg-amber-500/10"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <AnimatePresence mode="wait">
                  {isMobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="w-6 h-6" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu className="w-6 h-6" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Enhanced Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              className="md:hidden bg-slate-900/95 backdrop-blur-2xl border-t border-amber-500/30"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-4 py-6 space-y-4">
                {[
        { href: "/", label: "Home", icon: "🏠" },
        { href: "/#assets", label: "Collections", icon: "💎" },
        { href: "/marketplace", label: "Marketplace", icon: "🛒" },
        { href: "/lending", label: "Lending", icon: "🏦" },
        { href: "/my-nfts", label: "List NFTs", icon: "🖼️" }
                ].map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link 
                      href={item.href} 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="flex items-center space-x-3 py-4 px-6 text-gray-300 hover:text-amber-400 hover:bg-amber-500/10 rounded-2xl font-semibold transition-all duration-300 group"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span>{item.label}</span>
                      <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </motion.div>
                ))}
                <div className="pt-4 border-t border-gray-700/50">
                  <WalletMultiButton />
                </div>
                {/* Admin button for mobile menu */}
                {isLoggedIn && (
                  <div className="pt-4 border-t border-gray-700/50">
                     <Link
                      href="/admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center space-x-3 py-4 px-6 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-2xl font-semibold transition-all duration-300 group"
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin Dashboard</span>
                      <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform duration-300" />
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Spacer for fixed navigation */}
      <div className="h-20" />
    </>
  );
};

export default Navbar; 