"use client";

import Link from 'next/link';
import { Twitter, Bot, Send } from 'lucide-react';

const Footer = () => {
  const socialLinks = [
    { name: 'Twitter', icon: Twitter, href: '#' },
    { name: 'Discord', icon: Bot, href: '#' },
    { name: 'Telegram', icon: Send, href: '#' },
  ];

  const footerLinks = [
    { name: 'Assets', href: '/#assets' },
    { name: 'How It Works', href: '/#how-it-works' },
    { name: 'Terms of Service', href: '#' },
    { name: 'Privacy Policy', href: '#' },
  ];

  return (
    <footer className="bg-black border-t border-white/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-8 md:space-y-0">
          {/* Logo and Brand Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🥃</span>
              </div>
            <span className="font-bold text-xl text-white font-serif">NFT Treasury</span>
            </div>
            
          {/* Navigation Links */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {footerLinks.map(link => (
              <Link key={link.name} href={link.href} className="text-gray-400 hover:text-white transition-colors duration-300">
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Social Icons */}
          <div className="flex items-center space-x-6">
            {socialLinks.map(social => (
              <a 
                key={social.name} 
                href={social.href} 
                aria-label={social.name}
                className="text-gray-500 hover:text-white transition-colors duration-300 transform hover:scale-110"
              >
                <social.icon size={20} />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} NFT Treasury. All rights reserved.</p>
          <p className="mt-1">Powered by the Solana Blockchain.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 