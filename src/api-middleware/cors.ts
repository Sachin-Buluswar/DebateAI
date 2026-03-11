import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];
  
  // Add default origins based on environment
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
  }
  
  // Add production URLs
  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  
  // Add Vercel preview URLs
  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }
  
  return [...new Set(allowedOrigins)]; // Remove duplicates
};

export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  
  // Check if origin is allowed
  const isAllowed = !origin || allowedOrigins.some(allowed => {
    // Handle wildcard subdomains (e.g., *.vercel.app)
    if (allowed.includes('*')) {
      const pattern = allowed.replace('*', '.*');
      return new RegExp(pattern).test(origin);
    }
    return allowed === origin;
  });
  
  // Create response
  const response = NextResponse.next();
  
  if (isAllowed && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }
  
  return response;
}