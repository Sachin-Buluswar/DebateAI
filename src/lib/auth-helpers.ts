/**
 * Get the correct redirect URL based on environment
 * In production, uses NEXT_PUBLIC_SITE_URL
 * In development, uses window.location.origin
 */
export function getRedirectUrl(path: string = ''): string {
  // For server-side rendering or when window is not available
  if (typeof window === 'undefined') {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      return `${siteUrl}${path}`;
    }
    // Fallback for server-side
    return `https://erisdebate.com${path}`;
  }

  // For client-side
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  // In production, always use the configured site URL
  if (siteUrl && process.env.NODE_ENV === 'production') {
    return `${siteUrl}${path}`;
  }
  
  // In development or if SITE_URL is not set, use current origin
  return `${window.location.origin}${path}`;
}

/**
 * Get auth callback URL
 */
export function getAuthCallbackUrl(): string {
  return getRedirectUrl('/auth/callback');
}

/**
 * Get password reset URL
 */
export function getPasswordResetUrl(): string {
  return getRedirectUrl('/auth/reset-password');
}