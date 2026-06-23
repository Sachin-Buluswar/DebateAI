import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/server/services/openCaseListScraper';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { addSecurityHeaders } from '@/api-middleware/inputValidation';
import { requireAdmin, AuthenticatedRequest } from '@/lib/auth-middleware';
import { z } from 'zod';

const scrapeSchema = z.object({
  years: z
    .array(z.number().int().min(2013).max(2030))
    .min(1)
    .max(13)
    .default([new Date().getFullYear()]),
});

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAdmin(request, async (_authenticatedReq: AuthenticatedRequest) => {
      try {
        const body = await request.json().catch(() => ({}));
        const parsed = scrapeSchema.safeParse(body);

        if (!parsed.success) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'Invalid request', details: parsed.error.errors },
              { status: 400 }
            )
          );
        }

        const { years } = parsed.data;
        const scraper = new OpenCaseListScraper();

        // Start scraping in background
        scraper.scrapeYears(years).catch(() => {
          // Background task - errors logged internally
        });

        return addSecurityHeaders(
          NextResponse.json({
            success: true,
            message: `Scraping started for years: ${years.join(', ')}. Check status endpoint for progress.`,
            years,
          })
        );
      } catch (_error) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Failed to start scraping' }, { status: 500 })
        );
      }
    });
  });
}
