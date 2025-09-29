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
    const [retryCount, setRetryCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const maxRetries = 5; // More aggressive retries for mobile

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
        console.warn(`[ImageWithFallback] Failed to load image from: ${imageSrc} (attempt ${retryCount + 1}/${maxRetries})`);
        
        // On mobile, retry more aggressively instead of showing fallback
        if (retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
            console.log(`[ImageWithFallback] Retrying in ${delay}ms...`);
            
            setTimeout(() => {
                setRetryCount(prev => prev + 1);
                // Force reload by adding cache buster
                const cacheBuster = `?retry=${Date.now()}`;
                const newSrc = imageSrc.includes('?') ? `${imageSrc}&retry=${Date.now()}` : `${imageSrc}${cacheBuster}`;
                setImageSrc(newSrc);
                setHasErrored(false);
            }, delay);
        } else {
            // Only show error after all retries exhausted
            console.error(`[ImageWithFallback] All ${maxRetries} retry attempts failed for: ${imageSrc}`);
            
            // Log debug info
            if (debugLogId) {
                mobileImageDebugger.logImageLoadError(debugLogId, `Failed after ${maxRetries} retries: ${imageSrc}`);
            }
            
            setHasErrored(true);
            setIsLoading(false);
            if (onError) onError();
        }
    };

    const handleImageLoad = () => {
        console.log(`[ImageWithFallback] Successfully loaded image: ${imageSrc} (after ${retryCount} retries)`);
        
        // Log debug success
        if (debugLogId) {
            mobileImageDebugger.logImageLoadSuccess(debugLogId);
        }
        
        setHasErrored(false);
        setIsLoading(false);
        setRetryCount(0); // Reset retry count on success
        if (onLoad) onLoad();
    };

    // Never show placeholder - either show loading or keep trying
    if (!imageSrc) {
        console.log(`[ImageWithFallback] No image source provided, showing loading state`);
        return (
            <div className={`${className} flex items-center justify-center bg-slate-800/50 text-amber-200`}>
                <div className="animate-pulse">
                    <div className="w-8 h-8 bg-amber-400 rounded-full animate-bounce"></div>
                </div>
            </div>
        );
    }

    // If loading or retrying, show loading state instead of error
    if (isLoading || (hasErrored && retryCount < maxRetries)) {
        return (
            <div className={`${className} relative`}>
                <img
                    src={imageSrc}
                    alt={alt}
                    className={`${className} ${isLoading ? 'opacity-50' : ''}`}
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
                {(isLoading || retryCount > 0) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800/50">
                        <div className="flex flex-col items-center text-amber-200 text-sm">
                            <div className="w-6 h-6 bg-amber-400 rounded-full animate-bounce mb-2"></div>
                            {retryCount > 0 && <span>Retrying... ({retryCount}/{maxRetries})</span>}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Only show error state after all retries exhausted, but still show the image attempt
    if (hasErrored && retryCount >= maxRetries) {
        console.log(`[ImageWithFallback] All retries exhausted, but still showing image element`);
        return (
            <div className={`${className} relative`}>
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
                        objectFit: 'cover',
                        filter: 'grayscale(50%)' // Indicate error state
                    }}
                />
                <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                    Loading...
                </div>
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