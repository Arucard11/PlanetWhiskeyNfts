"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Bot, Send, Globe } from 'lucide-react';

// Custom X (Twitter) icon component
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const Footer = () => {
  const socialLinks = [
    { name: 'X (Twitter)', icon: XIcon, href: 'https://x.com/planetwhiskey' },
    { name: 'Telegram', icon: Send, href: 'https://t.me/PlanetWhiskey' },
    { name: 'Website', icon: Globe, href: 'https://www.planetwhiskey.xyz' },
  ];

  const footerLinks = [
    { name: 'Collections', href: '/#assets' },
    { name: 'FAQ', href: '/faq' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Distiller\'s Guide', href: '/#how-it-works' },
  ];

  return (
    <footer className="bg-black border-t border-white/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-8 md:space-y-0">
          {/* Logo and Brand Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-amber-400/50 shadow-lg shadow-amber-500/30">
              <Image
                src="/header.jpg"
                alt="NFT Treasury Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-bold text-xl text-white font-serif">Planet Whiskey</span>
          </div>
            
          {/* Navigation Links */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {footerLinks.map(link => (
              <Link 
                key={link.name} 
                href={link.href} 
                className="text-gray-400 hover:text-amber-400 hover:underline transition-all duration-300 cursor-pointer relative z-10 px-1 py-1"
              >
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
                target="_blank"
                rel="noopener noreferrer"
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
          <p>&copy; {new Date().getFullYear()} Planet Whiskey. All rights reserved.</p>
          <p className="mt-1">Powered by the Solana Blockchain.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 