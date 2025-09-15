/**
 * Get the correct redirect URL based on environment
 * Handles multiple environment variable patterns for maximum compatibility
 */
export function getRedirectUrl(path: string = ''): string {
  // For server-side rendering or when window is not available
  if (typeof window === 'undefined') {
    // Try multiple environment variables in order of preference
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                   process.env.NEXT_PUBLIC_APP_URL ||
                   process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
    
    if (siteUrl) {
      // Ensure URL doesn't have trailing slash and path doesn't have leading slash duplication
      const baseUrl = siteUrl.replace(/\/$/, '');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${baseUrl}${cleanPath}`;
    }
    
    // Production fallback
    if (process.env.NODE_ENV === 'production') {
      return `https://erisdebate.com${path}`;
    }
    
    // Development fallback
    return `http://localhost:3001${path}`;
  }

  // For client-side - try environment variables first
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                 process.env.NEXT_PUBLIC_APP_URL;
  
  // In production, prefer configured URLs
  if (siteUrl && process.env.NODE_ENV === 'production') {
    const baseUrl = siteUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }
  
  // Use current origin as fallback (works in all environments)
  const baseUrl = window.location.origin;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get auth callback URL with optional redirect parameter
 */
export function getAuthCallbackUrl(redirectTo?: string): string {
  const callbackUrl = getRedirectUrl('/auth/callback');
  if (redirectTo) {
    const url = new URL(callbackUrl);
    url.searchParams.set('redirect', redirectTo);
    return url.toString();
  }
  return callbackUrl;
}

/**
 * Get password reset URL
 */
export function getPasswordResetUrl(): string {
  return getRedirectUrl('/auth/reset-password');
}