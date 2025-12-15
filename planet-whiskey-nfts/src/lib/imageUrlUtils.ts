// Image URL utilities for handling proxy URLs and wallet-compatible URLs

/**
 * Converts a proxy URL back to the proper IPFS URI format for NFT metadata
 * Wallets like Phantom expect ipfs:// URIs, not HTTP gateway URLs
 */
export function convertProxyToIpfsUri(proxyUrl: string): string {
  if (!proxyUrl) return '';
  
  // If it's not a proxy URL, handle other formats
  if (!proxyUrl.startsWith('/api/images/proxy?imageUrl=')) {
    // If it's already an IPFS URI, return as-is
    if (proxyUrl.startsWith('ipfs://')) {
      return proxyUrl;
    }
    
    // If it's an IPFS gateway URL, convert to ipfs:// URI
    if (proxyUrl.includes('/ipfs/')) {
      const ipfsMatch = proxyUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (ipfsMatch) {
        const hash = ipfsMatch[1];
        console.log(`[convertProxyToIpfsUri] Converting gateway URL to IPFS URI: ${proxyUrl} -> ipfs://${hash}`);
        return `ipfs://${hash}`;
      }
    }
    
    return proxyUrl;
  }
  
  try {
    // Extract the original URL from the proxy URL
    const url = new URL(`http://localhost${proxyUrl}`);
    const originalUrl = url.searchParams.get('imageUrl');
    
    if (!originalUrl) {
      console.warn('[convertProxyToIpfsUri] No imageUrl parameter found in proxy URL');
      return proxyUrl;
    }
    
    // If it's already an IPFS URI, return it
    if (originalUrl.startsWith('ipfs://')) {
      console.log(`[convertProxyToIpfsUri] Found IPFS URI in proxy: ${originalUrl}`);
      return originalUrl;
    }
    
    // If it's an IPFS gateway URL, convert to ipfs:// URI
    if (originalUrl.includes('/ipfs/')) {
      const ipfsMatch = originalUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
      if (ipfsMatch) {
        const hash = ipfsMatch[1];
        const ipfsUri = `ipfs://${hash}`;
        console.log(`[convertProxyToIpfsUri] Converting gateway URL to IPFS URI: ${originalUrl} -> ${ipfsUri}`);
        return ipfsUri;
      }
    }
    
    // For non-IPFS URLs, return the original
    console.log(`[convertProxyToIpfsUri] Non-IPFS URL, returning original: ${originalUrl}`);
    return originalUrl;
  } catch (error) {
    console.error('[convertProxyToIpfsUri] Error parsing proxy URL:', error);
    return proxyUrl;
  }
}

/**
 * Validates that an image URL is compatible with wallets like Phantom
 * Wallets prefer IPFS URIs but can also handle public HTTP URLs
 */
export function isWalletCompatibleImageUrl(imageUrl: string): boolean {
  if (!imageUrl) return false;
  
  // IPFS URIs are the preferred format for wallets
  if (imageUrl.startsWith('ipfs://')) return true;
  
  // Local proxy URLs won't work in wallets
  if (imageUrl.startsWith('/api/images/proxy')) return false;
  
  // Local file paths won't work in wallets
  if (imageUrl.startsWith('/')) return false;
  
  // Public HTTP/HTTPS URLs are acceptable as fallback
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Local placeholder URLs are not wallet-compatible
    if (imageUrl.includes('/placeholder-image.svg') || imageUrl.startsWith('/placeholder')) return false;
    return true;
  }
  
  return false;
}

/**
 * Gets the best image URI for NFT metadata (prioritizes IPFS URIs)
 * Wallets like Phantom prefer ipfs:// URIs over HTTP gateway URLs
 */
export function getBestNftImageUri(proxyOrOriginalUrl: string, fallbackName?: string): string {
  if (!proxyOrOriginalUrl) {
    if (fallbackName) {
      // Create a branded placeholder as last resort
      return `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(fallbackName)}`;
    }
    return '';
  }
  
  // Convert proxy URL to IPFS URI if possible
  const ipfsUri = convertProxyToIpfsUri(proxyOrOriginalUrl);
  
  // Validate the URI is wallet-compatible
  if (isWalletCompatibleImageUrl(ipfsUri)) {
    return ipfsUri;
  }
  
  // If we still don't have a good URI, create a branded placeholder
  if (fallbackName) {
    console.warn(`[getBestNftImageUri] No wallet-compatible URI found, using branded placeholder for ${fallbackName}`);
    return `https://via.placeholder.com/512x512/1f2937/f59e0b?text=${encodeURIComponent(fallbackName)}`;
  }
  
  return ipfsUri; // Return what we have, even if not ideal
}

/**
 * Tests if an image URL is accessible by making a HEAD request
 */
export async function testImageAccessibility(imageUrl: string): Promise<boolean> {
  if (!isWalletCompatibleImageUrl(imageUrl)) {
    return false;
  }
  
  try {
    const response = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch (error) {
    console.warn(`[testImageAccessibility] Failed to access ${imageUrl}:`, error);
    return false;
  }
}

/**
 * Resolves an IPFS URI to a gateway URL using the configured custom gateway
 * This bypasses the internal proxy for better performance on client-side
 */
export function resolveIpfsToGateway(uri: string): string {
  if (!uri) return '';
  
  // Get the configured gateway or fallback to a known public one
  // IMPORTANT: We must access process.env.NEXT_PUBLIC_PINATA_GATEWAY directly for Next.js inlining
  const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://pink-obvious-bee-185.mypinata.cloud';
  const gatewayBase = pinataGateway.endsWith('/') ? pinataGateway : `${pinataGateway}/ipfs/`;
  
  // Handle direct ipfs:// URIs
  if (uri.startsWith('ipfs://')) {
    const hash = uri.substring(7);
    return `${gatewayBase}${hash}`;
  }
  
  // Handle existing gateway URLs (convert to our preferred gateway)
  if (uri.includes('/ipfs/')) {
    const parts = uri.split('/ipfs/');
    if (parts.length > 1) {
      const hash = parts[parts.length - 1];
      // Clean up hash if it contains query params
      const cleanHash = hash.split('?')[0];
      return `${gatewayBase}${cleanHash}`;
    }
  }
  
  return uri;
}
