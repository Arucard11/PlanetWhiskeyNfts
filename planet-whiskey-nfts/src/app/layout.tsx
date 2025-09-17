import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
// import ChakraWrapper from "@/components/ChakraWrapper"; // Removed ChakraWrapper import
import WalletContextProvider from "@/contexts/WalletContextProvider"; // Added WalletContextProvider import
import Footer from "@/components/Footer"; // Corrected Import the Footer
import Navbar from "@/components/layout/Navbar"; // Added Navbar import
import { Toaster } from 'react-hot-toast';

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
  title: "NFT Treasury",
  description: "Mint unique NFT collections from your favorite distilleries.",
  icons: {
    icon: '/disteller.jpg',
    shortcut: '/disteller.jpg',
    apple: '/disteller.jpg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfairDisplay.variable} font-sans antialiased`}>
        <WalletContextProvider>
          <Toaster position="top-center" reverseOrder={false} />
          <Navbar />
          {children}
          <Footer />
        </WalletContextProvider>
      </body>
    </html>
  );
}
