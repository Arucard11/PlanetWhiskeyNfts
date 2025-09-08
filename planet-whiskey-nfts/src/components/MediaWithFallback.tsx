"use client";

import React, { useEffect, useState } from 'react';

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

// Convert IPFS URI to our server-side proxy URL to avoid CORS issues
const convertIpfsToProxy = (uri: string): string => {
    if (!uri) return '';
    
    // If it's already a proxy URL, don't convert it again
    if (uri.startsWith('/api/images/proxy')) {
        console.log(`[MediaWithFallback] Already a proxy URL, not converting: ${uri}`);
        return uri;
    }
    
    if (uri.startsWith('ipfs://')) {
        const hash = uri.substring(7);
        const proxyUrl = `/api/images/proxy?imageUrl=ipfs://${hash}`;
        console.log(`[MediaWithFallback] Converting IPFS URL to proxy: ${uri} -> ${proxyUrl}`);
        return proxyUrl;
    }
    
    // If it's already a Pinata gateway URL, convert it to use our proxy
    if (uri.includes('gateway.pinata.cloud/ipfs/')) {
        const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(uri)}`;
        console.log(`[MediaWithFallback] Converting Pinata URL to proxy: ${uri} -> ${proxyUrl}`);
        return proxyUrl;
    }
    
    return uri;
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

        // Convert IPFS URI to our server-side proxy URL to avoid CORS issues
        const convertedSrc = convertIpfsToProxy(src);
        console.log(`[MediaWithFallback] Converting: ${src} -> ${convertedSrc}`);
        
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

    // If there's no valid media source or it has errored, show placeholder
    if (!mediaSrc || hasErrored) {
        console.log(`[MediaWithFallback] Showing placeholder - mediaSrc: "${mediaSrc}", hasErrored: ${hasErrored}`);
        return (
            <div className={`${className} flex items-center justify-center bg-slate-800 text-amber-200`}>
                <div className="text-center">
                    <div className="text-4xl mb-2">🎬</div>
                    <span>No Media Available</span>
                </div>
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
            style={isGif ? { objectFit: 'cover' } : undefined}
        />
    );
};

export default MediaWithFallback;
