/**
 * Secure CORS Configuration for ShopOpti+ Edge Functions
 * P0.4 Fix: Restricted origins instead of wildcard '*'
 */

// Allowed origins for production
const ALLOWED_ORIGINS = [
  'https://shopopti.io',
  'https://www.shopopti.io',
  'https://app.shopopti.io',
  'https://admin.shopify.com',
  // Local ShopOpti development origin.
  // CORS is not an authentication boundary; authenticated actions still
  // require a valid Supabase user JWT inside the Edge Function.
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  // Lovable preview URLs pattern (id-preview, preview--<slug>, etc.)
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/,
  // Lovable project preview URLs
  /^https:\/\/[\w-]+\.lovableproject\.com$/,
  // ShopOpti Vercel previews, restricted to the known Vercel team.
  // Authenticated actions still validate the Supabase user JWT.
  /^https:\/\/drop-craft-[a-z0-9-]+-frexs-projects-73340296\.vercel\.app$/,
  // Chrome extension pattern
  /^chrome-extension:\/\/[a-z]{32}$/,
];

// Development origins (only in non-production)
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

/**
 * Check if origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Check exact matches
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Check regex patterns
  for (const pattern of ALLOWED_ORIGINS) {
    if (pattern instanceof RegExp && pattern.test(origin)) {
      return true;
    }
  }
  
  // Allow dev origins in development (check for non-production indicators)
  const isDev = Deno.env.get('ENVIRONMENT') === 'development' || 
                Deno.env.get('SUPABASE_URL')?.includes('localhost');
  if (isDev && DEV_ORIGINS.includes(origin)) {
    return true;
  }
  
  return false;
}

/**
 * Get CORS headers for a request
 * Returns restrictive headers if origin is not allowed
 */
export function getSecureCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers');
  
  const baseHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders || 'authorization, x-client-info, apikey, content-type, accept, cache-control, pragma, x-extension-token, x-request-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
  
  if (origin && isAllowedOrigin(origin)) {
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  
  // For unknown origins, don't set Access-Control-Allow-Origin
  // This effectively blocks CORS requests from unauthorized origins
  return baseHeaders;
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightSecure(req: Request): Response {
  const headers = getSecureCorsHeaders(req);
  const origin = req.headers.get('Origin');
  
  if (!origin || !isAllowedOrigin(origin)) {
    return new Response(null, { 
      status: 204,
      headers,
    });
  }
  
  return new Response(null, { status: 204, headers });
}

/**
 * Legacy compatibility - uses first allowed origin instead of wildcard
 * @deprecated Use getSecureCorsHeaders instead for new functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://shopopti.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-extension-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Sensitive function CORS headers - no wildcard allowed
 */
export function getSensitiveCorsHeaders(req: Request): Record<string, string> {
  return getSecureCorsHeaders(req);
}

/**
 * Alias: getCorsHeaders — used by multiple hub functions
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  return getSecureCorsHeaders(req);
}

/**
 * Alias: handleCorsPreflightRequest — used by hub functions
 */
export function handleCorsPreflightRequest(req: Request, headers: Record<string, string>): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    if (!origin || !isAllowedOrigin(origin)) {
      return new Response(null, { status: 204, headers });
    }
    return new Response(null, { status: 204, headers });
  }
  return null;
}
