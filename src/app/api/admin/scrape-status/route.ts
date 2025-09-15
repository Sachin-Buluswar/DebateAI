import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/backend/services/openCaseListScraper';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (req: AuthenticatedRequest) => {
      try {
        const scraper = new OpenCaseListScraper();
        const status = await scraper.getScrapingStatus();

        return addSecurityHeaders(NextResponse.json(status));
      } catch (error) {
        // PRODUCTION: Logging disabled
// console.error('Error getting scrape status:', error);
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