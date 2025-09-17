"use client";

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'; // Example: Phantom
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css'; // <-- COMMENTED OUT/REMOVED

interface WalletContextProviderProps {
    children: ReactNode;
}

const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
    // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
    // Use process.env.NEXT_PUBLIC_SOLANA_CLUSTER or default to mainnet
    const clusterName = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'mainnet';
    const network = clusterName === 'mainnet' ? WalletAdapterNetwork.Mainnet : 
                   clusterName === 'devnet' ? WalletAdapterNetwork.Devnet : 
                   clusterName === 'testnet' ? WalletAdapterNetwork.Testnet : 
                   WalletAdapterNetwork.Mainnet;

    // You can also provide a custom RPC endpoint
    const endpoint = useMemo(() => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            // Add other wallets here e.g. new SolflareWalletAdapter(),
        ],
        [network] // network dependency if wallets are network-specific
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider; 