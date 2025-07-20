"use client";

import React, { useEffect, useState } from 'react';

interface ImageWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
}

// Multiple IPFS gateways as fallbacks
const IPFS_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',  // Primary gateway
      // Protocol Labs gateway
];

// Convert IPFS URLs to gateway URLs with fallback support
const convertIpfsToGateway = (uri: string, gatewayIndex: number = 0): string => {
    if (!uri) return '';
    
    if (uri.startsWith('ipfs://')) {
        const hash = uri.substring(7);
        const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];
        const gatewayUrl = `${gateway}${hash}`;
        console.log(`[ImageWithFallback] Converting IPFS URL: ${uri} -> ${gatewayUrl} (gateway ${gatewayIndex + 1}/${IPFS_GATEWAYS.length})`);
        return gatewayUrl;
    }
    
    return uri;
};

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
    src, 
    alt, 
    className = '',
    onLoad,
    onError 
}) => {
    const [imageSrc, setImageSrc] = useState(() => convertIpfsToGateway(src));
    const [hasErrored, setHasErrored] = useState(false);
    const [gatewayIndex, setGatewayIndex] = useState(0);

    // This effect ensures that if the image URL from the parent component changes,
    // we update the image source and try to load the new one.
    useEffect(() => {
        const convertedSrc = convertIpfsToGateway(src, 0);
        console.log(`[ImageWithFallback] Source changed to: ${convertedSrc}`);
        setImageSrc(convertedSrc);
        setHasErrored(false);
        setGatewayIndex(0);
    }, [src]);

    const handleImageError = () => {
        console.warn(`[ImageWithFallback] Failed to load image from: ${imageSrc}`);
        
        // If this is an IPFS URL and we have more gateways to try
        if (src.startsWith('ipfs://') && gatewayIndex < IPFS_GATEWAYS.length - 1) {
            const nextGatewayIndex = gatewayIndex + 1;
            const nextGatewayUrl = convertIpfsToGateway(src, nextGatewayIndex);
            console.log(`[ImageWithFallback] Trying fallback gateway: ${nextGatewayUrl}`);
            setGatewayIndex(nextGatewayIndex);
            setImageSrc(nextGatewayUrl);
            return;
        }
        
        // All gateways failed or not an IPFS URL
        setHasErrored(true);
        if (onError) onError();
    };

    const handleImageLoad = () => {
        console.log(`[ImageWithFallback] Successfully loaded image: ${imageSrc}`);
        if (onLoad) onLoad();
    };

    // If there's no valid image source or it has errored, don't render anything
    if (!imageSrc || hasErrored) {
        return null;
    }

    return (
        <img
            src={imageSrc}
            alt={alt}
            className={className}
            onError={handleImageError}
            onLoad={handleImageLoad}
        />
    );
};

export default ImageWithFallback; 