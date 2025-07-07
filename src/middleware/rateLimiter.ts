/**
 * Rate Limiting Middleware for DebateAI
 * Implements token bucket algorithm for API rate limiting
 */

interface RateLimitStore {
  [key: string]: {
    tokens: number;
    lastRefill: number;
  };
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      keyGenerator: (req: Request) => this.getClientIP(req),
      ...config,
    };
  }

  private getClientIP(req: Request): string {
    // Extract IP from various headers
    const forwarded = req.headers.get('x-forwarded-for');
    const realIP = req.headers.get('x-real-ip');
    const cfIP = req.headers.get('cf-connecting-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    if (realIP) {
      return realIP;
    }
    if (cfIP) {
      return cfIP;
    }
    
    // Fallback for local development
    return '127.0.0.1';
  }

  private refillTokens(bucket: { tokens: number; lastRefill: number }): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.config.windowMs * this.config.maxRequests);
    
    bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  async checkRateLimit(req: Request): Promise<{ allowed: boolean; remainingTokens: number; resetTime: number }> {
    const key = this.config.keyGenerator!(req);
    const now = Date.now();

    // Initialize bucket if it doesn't exist
    if (!this.store[key]) {
      this.store[key] = {
        tokens: this.config.maxRequests - 1, // Consume one token for this request
        lastRefill: now,
      };
      return {
        allowed: true,
        remainingTokens: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
      };
    }

    const bucket = this.store[key];
    this.refillTokens(bucket);

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return {
        allowed: true,
        remainingTokens: bucket.tokens,
        resetTime: bucket.lastRefill + this.config.windowMs,
      };
    } else {
      return {
        allowed: false,
        remainingTokens: 0,
        resetTime: bucket.lastRefill + this.config.windowMs,
      };
    }
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs * 2; // Keep entries for 2 windows

    for (const [key, bucket] of Object.entries(this.store)) {
      if (bucket.lastRefill < cutoff) {
        delete this.store[key];
      }
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

export const speechFeedbackRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 speech uploads per hour
});

export const wikiSearchRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 searches per minute
});

export const debateRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 debates per hour
});

// Rate limiting response helper
export function createRateLimitResponse(
  resetTime: number,
  message: string = 'Too many requests. Please try again later.'
): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message,
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      },
    }
  );
}

// Middleware function for Next.js API routes
export async function withRateLimit<T>(
  req: Request,
  rateLimiter: RateLimiter,
  handler: () => Promise<T>
): Promise<T | Response> {
  const result = await rateLimiter.checkRateLimit(req);

  if (!result.allowed) {
    return createRateLimitResponse(result.resetTime);
  }

  return handler();
}

// Cleanup job (should be run periodically)
setInterval(() => {
  apiRateLimiter.cleanup();
  speechFeedbackRateLimiter.cleanup();
  wikiSearchRateLimiter.cleanup();
  debateRateLimiter.cleanup();
}, 30 * 60 * 1000); // Clean up every 30 minutes