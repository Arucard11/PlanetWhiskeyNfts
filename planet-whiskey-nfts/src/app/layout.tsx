import type { Metadata } from "next";
import '@solana/wallet-adapter-react-ui/styles.css'; // Wallet adapter styles
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css"; // Your project's global styles (including Tailwind)
// import ChakraWrapper from "@/components/ChakraWrapper"; // Removed ChakraWrapper import
import WalletContextProvider from "@/contexts/WalletContextProvider"; // Added WalletContextProvider import
import Footer from "@/components/Footer"; // Corrected Import the Footer
import Navbar from "@/components/layout/Navbar"; // Added Navbar import
import { Toaster } from 'react-hot-toast';

// Note: Liquidation bot is now started via the startup script (scripts/start-with-bot.js)

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
  title: "NFT Treasury", // Updated title
  description: "Mint unique NFT collections from your favorite distilleries.", // Updated description
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
