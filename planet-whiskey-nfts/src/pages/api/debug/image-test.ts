import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, message: 'URL parameter is required' });
  }

  try {
    console.log(`[image-test] Testing image URL: ${url}`);
    
    // Test the image proxy
    const proxyUrl = `/api/images/proxy?imageUrl=${encodeURIComponent(url)}`;
    const baseUrl = req.headers.host ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}` : 'http://localhost:3000';
    const fullProxyUrl = `${baseUrl}${proxyUrl}`;
    
    console.log(`[image-test] Testing proxy URL: ${fullProxyUrl}`);
    
    const startTime = Date.now();
    const response = await fetch(fullProxyUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });
    const loadTime = Date.now() - startTime;
    
    const result = {
      success: true,
      data: {
        originalUrl: url,
        proxyUrl: proxyUrl,
        fullProxyUrl: fullProxyUrl,
        accessible: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        loadTime: loadTime,
        headers: Object.fromEntries(response.headers.entries())
      }
    };
    
    console.log(`[image-test] Result:`, result.data);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error(`[image-test] Error testing image:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error testing image',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
