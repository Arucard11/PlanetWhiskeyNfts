import type { Metadata } from "next";
import '@solana/wallet-adapter-react-ui/styles.css'; // Wallet adapter styles
// import { Geist, Geist_Mono } from "next/font/google"; // Removing Geist fonts
import "./globals.css"; // Your project's global styles (including Tailwind)
// import ChakraWrapper from "@/components/ChakraWrapper"; // Removed ChakraWrapper import
import WalletContextProvider from "@/contexts/WalletContextProvider"; // Added WalletContextProvider import
import Footer from "@/components/Footer"; // Corrected Import the Footer
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar'; // Assuming you have/will create this
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "Planet Whiskey NFTs", // Updated title
  description: "Mint unique NFT collections from your favorite distilleries.", // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Classes from Geist removed, Tailwind will apply fonts from globals.css and tailwind.config.ts */}
      <body className="font-sans antialiased">
        <WalletContextProvider>
          <Toaster position="top-center" reverseOrder={false} />
          <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />
            <main className="flex-grow container mx-auto px-4 py-8"> {/* Add main content styling */}
            {/* <ChakraWrapper>{children}</ChakraWrapper> */}
            {children} {/* Directly render children */}
            </main>
            <Footer /> {/* Add the Footer here */}
          </div>
        </WalletContextProvider>
      </body>
    </html>
  );
}
