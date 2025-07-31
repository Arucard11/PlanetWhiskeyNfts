"use client";

import React, { useEffect, useState } from 'react';

interface ImageWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
}

// Convert IPFS URI to our server-side proxy URL to avoid CORS issues
const convertIpfsToProxy = (uri: string): string => {
    if (!uri) return '';
    
    if (uri.startsWith('ipfs://')) {
        const hash = uri.substring(7);
        const proxyUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
        console.log(`[ImageWithFallback] Converting IPFS URL to proxy: ${uri} -> ${proxyUrl}`);
        return proxyUrl;
    }
    
    // If it's already a Pinata gateway URL, convert it to use our proxy
    if (uri.includes('gateway.pinata.cloud/ipfs/')) {
        const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(uri)}`;
        console.log(`[ImageWithFallback] Converting Pinata URL to proxy: ${uri} -> ${proxyUrl}`);
        return proxyUrl;
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
    const [imageSrc, setImageSrc] = useState<string>('');
    const [hasErrored, setHasErrored] = useState(false);

    useEffect(() => {
        if (!src) {
            setImageSrc('/placeholder-image.svg');
            setHasErrored(false);
            return;
        }

        // Convert IPFS URI to our server-side proxy URL to avoid CORS issues
        const convertedSrc = convertIpfsToProxy(src);
        console.log(`[ImageWithFallback] Converting: ${src} -> ${convertedSrc}`);
        setImageSrc(convertedSrc);
        setHasErrored(false);
    }, [src]);

    const handleImageError = () => {
        console.warn(`[ImageWithFallback] Failed to load image from: ${imageSrc}`);
        setHasErrored(true);
        if (onError) onError();
    };

    const handleImageLoad = () => {
        console.log(`[ImageWithFallback] Successfully loaded image: ${imageSrc}`);
        setHasErrored(false);
        if (onLoad) onLoad();
    };

    // If there's no valid image source or it has errored, show placeholder
    if (!imageSrc || hasErrored) {
        return (
            <div className={`${className} flex items-center justify-center bg-slate-800 text-amber-200`}>
                <span>No Image Available</span>
            </div>
        );
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