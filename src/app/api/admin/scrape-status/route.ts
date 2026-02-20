import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/backend/services/openCaseListScraper';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (_authenticatedReq: AuthenticatedRequest) => {
      try {
        const scraper = new OpenCaseListScraper();
        const status = await scraper.getScrapingStatus();

        return addSecurityHeaders(NextResponse.json(status));
      } catch (_error) {
        // PRODUCTION: Logging disabled
        // console.error('Error getting scrape status:', _error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to get scraping status' },
            { status: 500 }
          )
        );
      }
    });
  });
}