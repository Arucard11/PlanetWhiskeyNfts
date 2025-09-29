import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
// import ChakraWrapper from "@/components/ChakraWrapper"; // Removed ChakraWrapper import
import WalletContextProvider from "@/contexts/WalletContextProvider"; // Added WalletContextProvider import
import Footer from "@/components/Footer"; // Corrected Import the Footer
import Navbar from "@/components/layout/Navbar"; // Added Navbar import
import { Toaster } from 'react-hot-toast';
import MobileImageDebugPanel from '@/components/MobileImageDebugPanel';

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Planet Whiskey Reserve Vault",
  description: "Mint unique NFT collections from your favorite distilleries.",
  icons: {
    icon: [
      {
        url: '/disteller.jpg',
        sizes: '32x32',
        type: 'image/jpeg',
      },
      {
        url: '/disteller.jpg',
        sizes: '16x16',
        type: 'image/jpeg',
      },
    ],
    shortcut: '/disteller.jpg',
    apple: {
      url: '/disteller.jpg',
      sizes: '180x180',
      type: 'image/jpeg',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/jpeg" href="/disteller.jpg" />
        <link rel="shortcut icon" type="image/jpeg" href="/disteller.jpg" />
        <link rel="apple-touch-icon" href="/disteller.jpg" />
      </head>
      <body className={`${inter.variable} ${playfairDisplay.variable} font-sans antialiased`}>
        <WalletContextProvider>
          <Toaster position="top-center" reverseOrder={false} />
          <Navbar />
          {children}
          <Footer />
          <MobileImageDebugPanel />
        </WalletContextProvider>
      </body>
    </html>
  );
}
