"use client";

import React, { useEffect, useState } from 'react';
import { mobileImageDebugger } from '@/lib/mobileImageDebug';

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
    
    // If it's already a proxy URL, don't convert it again
    if (uri.startsWith('/api/images/proxy')) {
        console.log(`[ImageWithFallback] Already a proxy URL, not converting: ${uri}`);
        return uri;
    }
    
    if (uri.startsWith('ipfs://')) {
        const hash = uri.substring(7);
        const proxyUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
        console.log(`[ImageWithFallback] Converting IPFS URL to proxy: ${uri} -> ${proxyUrl}`);
        return proxyUrl;
    }
    
    // If it's already a Pinata gateway URL (old or new), convert it to use our proxy
    if (uri.includes('gateway.pinata.cloud/ipfs/') || uri.includes('pink-obvious-bee-185.mypinata.cloud/ipfs/')) {
        const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(uri)}`;
        console.log(`[ImageWithFallback] Converting Pinata URL to proxy: ${uri} -> ${proxyUrl}`);
        return proxyUrl;
    }
    
    // For mobile compatibility: Always use proxy for external URLs to avoid CORS and network issues
    if (uri.startsWith('http') && typeof window !== 'undefined' && !uri.includes(window.location.hostname)) {
        const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(uri)}`;
        console.log(`[ImageWithFallback] Converting external URL to proxy for mobile compatibility: ${uri} -> ${proxyUrl}`);
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
    const [debugLogId, setDebugLogId] = useState<string | null>(null);

    useEffect(() => {
        if (!src) {
            setImageSrc('/placeholder-image.svg');
            setHasErrored(false);
            return;
        }

        // Convert IPFS URI to our server-side proxy URL to avoid CORS issues
        const convertedSrc = convertIpfsToProxy(src);
        console.log(`[ImageWithFallback] Converting: ${src} -> ${convertedSrc}`);
        
        // Start debug logging
        const logId = mobileImageDebugger.logImageLoadStart(src, convertedSrc);
        setDebugLogId(logId);
        
        setImageSrc(convertedSrc);
        setHasErrored(false);
    }, [src]);

    const handleImageError = () => {
        console.warn(`[ImageWithFallback] Failed to load image from: ${imageSrc}`);
        
        // Log debug info
        if (debugLogId) {
            mobileImageDebugger.logImageLoadError(debugLogId, `Failed to load: ${imageSrc}`);
        }
        
        setHasErrored(true);
        if (onError) onError();
    };

    const handleImageLoad = () => {
        console.log(`[ImageWithFallback] Successfully loaded image: ${imageSrc}`);
        
        // Log debug success
        if (debugLogId) {
            mobileImageDebugger.logImageLoadSuccess(debugLogId);
        }
        
        setHasErrored(false);
        if (onLoad) onLoad();
    };

    // If there's no valid image source or it has errored, show placeholder
    if (!imageSrc || hasErrored) {
        console.log(`[ImageWithFallback] Showing placeholder - imageSrc: "${imageSrc}", hasErrored: ${hasErrored}`);
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
            loading="lazy"
            decoding="async"
            style={{
                maxWidth: '100%',
                height: 'auto',
                objectFit: 'cover'
            }}
        />
    );
};

export default ImageWithFallback; 