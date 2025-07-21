import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/backend/services/openCaseListScraper';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user || (user.email !== 'admin@atlasdebate.com' && user.email !== 'claudecode@gmail.com')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const scraper = new OpenCaseListScraper();

    // Start scraping in background
    scraper.scrapeWikiFiles().catch(error => {
      console.error('Scraping error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Scraping started. Check status endpoint for progress.',
    });
  } catch (error) {
    console.error('Error starting scrape:', error);
    return NextResponse.json(
      { error: 'Failed to start scraping' },
      { status: 500 }
    );
  }
}