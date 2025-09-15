import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/backend/services/openCaseListScraper';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (req: AuthenticatedRequest) => {
      try {
        const scraper = new OpenCaseListScraper();

        // Start scraping in background
        scraper.scrapeWikiFiles().catch(error => {
          // PRODUCTION: Logging disabled
// console.error('Scraping error:', error);
        });

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            message: 'Scraping started. Check status endpoint for progress.',
          })
        );
      } catch (error) {
        // PRODUCTION: Logging disabled
// console.error('Error starting scrape:', error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Failed to start scraping' },
            { status: 500 }
          )
        );
      }
    });
  });
}