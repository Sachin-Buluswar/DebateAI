import { NextRequest, NextResponse } from 'next/server';
import { OpenCaseListScraper } from '@/backend/services/openCaseListScraper';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Check admin authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    // Check if user has admin role using RBAC
    const { data: hasAdminRole } = await supabase
      .rpc('check_user_role', { required_role: 'admin' });
    
    if (!hasAdminRole) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const scraper = new OpenCaseListScraper();
    const status = await scraper.getScrapingStatus();

    return NextResponse.json(status);
  } catch (error) {
    // PRODUCTION: Logging disabled
// console.error('Error getting scrape status:', error);
    return NextResponse.json(
      { error: 'Failed to get scraping status' },
      { status: 500 }
    );
  }
}