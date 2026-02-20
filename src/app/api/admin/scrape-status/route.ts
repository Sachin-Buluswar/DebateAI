import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/backend/services/openCaseListScraper';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { addSecurityHeaders } from '@/middleware/inputValidation';

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  return await withRateLimit(request, apiRateLimiter, async () => {
    try {
      // Check authentication using server client
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Unauthorized - Please log in' },
            { status: 401 }
          )
        );
      }
      
      // Check if user has admin role in user_roles table
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (roleError || !userRole || (userRole.role !== 'admin' && userRole.role !== 'super_admin')) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden - Admin access required' },
            { status: 403 }
          )
        );
      }

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
}