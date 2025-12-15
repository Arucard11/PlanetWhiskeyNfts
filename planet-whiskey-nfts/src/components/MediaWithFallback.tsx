"use client";

import React, { useEffect, useState } from 'react';
import { resolveIpfsToGateway } from '@/lib/imageUrlUtils';

interface MediaWithFallbackProps {
    src: string;
    alt: string;
    className?: string;
    onLoad?: () => void;
    onError?: () => void;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
}

// Resolve media URL using custom gateway and avoid unnecessary proxying
const resolveMediaUrl = (uri: string): string => {
    if (!uri) return '';
    
    // If it's already a proxy URL, don't convert it again
    if (uri.startsWith('/api/images/proxy')) {
        return uri;
    }
    
    // 1. Resolve IPFS content to our custom gateway
    const resolvedUri = resolveIpfsToGateway(uri);
    
    // 2. If it's using our custom gateway or Pinata, return directly (Client-side fetch)
    // This avoids the server-side bottleneck
    if (resolvedUri.includes('mypinata.cloud') || resolvedUri.includes('pinata.cloud')) {
        console.log(`[MediaWithFallback] Using Gateway directly: ${resolvedUri}`);
        return resolvedUri;
    }
    
    // 3. For other external URLs, keep using proxy to avoid CORS issues on mobile/web
    if (resolvedUri.startsWith('http')) {
        // Check if it's an external URL (not from current domain)
        const isExternal = typeof window !== 'undefined' ? 
            !resolvedUri.includes(window.location.hostname) : 
            !resolvedUri.includes('localhost') && !resolvedUri.includes('127.0.0.1'); // Fallback for SSR
            
        if (isExternal) {
            const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(resolvedUri)}`;
            console.log(`[MediaWithFallback] Proxying external non-gateway URL: ${resolvedUri}`);
            return proxyUrl;
        }
    }
    
    return resolvedUri;
};

// Determine if the URL points to a video file
const isVideoFile = (url: string): boolean => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.ogv'];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext));
};

// Determine if the URL points to a GIF (which should be treated as an image but with autoplay-like behavior)
const isGifFile = (url: string): boolean => {
    if (!url) return false;
    return url.toLowerCase().includes('.gif');
};

const MediaWithFallback: React.FC<MediaWithFallbackProps> = ({ 
    src, 
    alt, 
    className = '',
    onLoad,
    onError,
    autoPlay = true,
    loop = true,
    muted = true,
    controls = false
}) => {
    const [mediaSrc, setMediaSrc] = useState<string>('');
    const [hasErrored, setHasErrored] = useState(false);
    const [isVideo, setIsVideo] = useState(false);
    const [isGif, setIsGif] = useState(false);

    useEffect(() => {
        if (!src) {
            setMediaSrc('/placeholder-image.svg');
            setHasErrored(false);
            setIsVideo(false);
            setIsGif(false);
            return;
        }

        // Resolve URL (use gateway directly for IPFS)
        const convertedSrc = resolveMediaUrl(src);
        console.log(`[MediaWithFallback] Resolved: ${src} -> ${convertedSrc}`);
        
        setMediaSrc(convertedSrc);
        setIsVideo(isVideoFile(convertedSrc));
        setIsGif(isGifFile(convertedSrc));
        setHasErrored(false);
    }, [src]);

    const handleMediaError = () => {
        console.warn(`[MediaWithFallback] Failed to load media from: ${mediaSrc}`);
        setHasErrored(true);
        if (onError) onError();
    };

    const handleMediaLoad = () => {
        console.log(`[MediaWithFallback] Successfully loaded media: ${mediaSrc}`);
        setHasErrored(false);
        if (onLoad) onLoad();
    };

    // If there's no valid media source or it has errored, show empty div
    if (!mediaSrc || hasErrored) {
        console.log(`[MediaWithFallback] No media available - mediaSrc: "${mediaSrc}", hasErrored: ${hasErrored}`);
        return (
            <div className={`${className} flex items-center justify-center bg-slate-800/50`}>
                {/* Empty div - no placeholder text */}
            </div>
        );
    }

    // Render video element for video files
    if (isVideo) {
        return (
            <video
                src={mediaSrc}
                className={className}
                autoPlay={autoPlay}
                loop={loop}
                muted={muted}
                controls={controls}
                onError={handleMediaError}
                onLoadedData={handleMediaLoad}
                playsInline
            >
                <source src={mediaSrc} />
                Your browser does not support the video tag.
            </video>
        );
    }

    // Render image element for images and GIFs
    return (
        <img
            src={mediaSrc}
            alt={alt}
            className={className}
            onError={handleMediaError}
            onLoad={handleMediaLoad}
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

export default MediaWithFallback;
