import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/server/services/openCaseListScraper';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { addSecurityHeaders } from '@/api-middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (_authenticatedReq: AuthenticatedRequest) => {
      try {
        const scraper = new OpenCaseListScraper();
        const status = await scraper.getScrapingStatus();

        return addSecurityHeaders(NextResponse.json(status));
      } catch (_error) {
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