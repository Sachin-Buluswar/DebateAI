import { NextRequest, NextResponse } from 'next/server';
import { withMonitoring } from '@/lib/monitoring/middleware';
import { debateMetrics } from '@/lib/monitoring/opentelemetry';
import { apiPerformance, dbPerformance, openaiPerformance, elevenLabsPerformance } from '@/lib/monitoring/performance';
import { createClient } from '@supabase/supabase-js';

interface MetricsResponse {
  timestamp: string;
  period: {
    start: string;
    end: string;
  };
  application: {
    version: string;
    environment: string;
    uptime: number;
  };
  performance: {
    api: any;
    database: any;
    openai: any;
    elevenlabs: any;
  };
  usage: {
    debates: {
      total: number;
      active: number;
      byTopic?: Record<string, number>;
    };
    users: {
      total: number;
      active24h: number;
      new24h: number;
    };
    ai: {
      totalRequests: number;
      byService: {
        openai: number;
        elevenlabs: number;
      };
    };
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    critical: number;
  };
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    connections: {
      websocket: number;
      database: number;
    };
  };
}

// Get usage metrics from database
async function getUsageMetrics() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Get debate metrics
    const { data: debates, error: debatesError } = await supabase
      .from('debates')
      .select('id, topic, status, created_at');

    if (debatesError) throw debatesError;

    const activeDebates = debates?.filter(d => d.status === 'active').length || 0;
    const debatesByTopic = debates?.reduce((acc, d) => {
      acc[d.topic] = (acc[d.topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get user metrics
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: activeUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', twentyFourHoursAgo.toISOString());

    const { count: newUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString());

    // Get AI usage metrics
    const { data: speechFeedback } = await supabase
      .from('speech_feedback')
      .select('id, created_at')
      .gte('created_at', twentyFourHoursAgo.toISOString());

    return {
      debates: {
        total: debates?.length || 0,
        active: activeDebates,
        byTopic: debatesByTopic,
      },
      users: {
        total: totalUsers || 0,
        active24h: activeUsers || 0,
        new24h: newUsers || 0,
      },
      ai: {
        totalRequests: speechFeedback?.length || 0,
        byService: {
          openai: 0, // These would be tracked by the metrics
          elevenlabs: 0,
        },
      },
    };
  } catch (error) {
    console.error('Error fetching usage metrics:', error);
    return {
      debates: { total: 0, active: 0 },
      users: { total: 0, active24h: 0, new24h: 0 },
      ai: { totalRequests: 0, byService: { openai: 0, elevenlabs: 0 } },
    };
  }
}

// Main metrics handler
export const GET = withMonitoring(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '1h';
  
  // Calculate period timestamps
  const now = new Date();
  const periodMs = period === '24h' ? 24 * 60 * 60 * 1000 :
                   period === '1h' ? 60 * 60 * 1000 :
                   15 * 60 * 1000; // Default 15 minutes
  const periodStart = new Date(now.getTime() - periodMs);

  // Get performance reports
  const apiReport = apiPerformance.generateReport();
  const dbReport = dbPerformance.generateReport();
  const openaiReport = openaiPerformance.generateReport();
  const elevenLabsReport = elevenLabsPerformance.generateReport();

  // Get usage metrics
  const usage = await getUsageMetrics();

  // Get memory usage
  const memUsage = process.memoryUsage();
  const totalMem = process.env.NODE_ENV === 'production' ? 512 * 1024 * 1024 : 2048 * 1024 * 1024;

  // Compile metrics response
  const metrics: MetricsResponse = {
    timestamp: now.toISOString(),
    period: {
      start: periodStart.toISOString(),
      end: now.toISOString(),
    },
    application: {
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
    },
    performance: {
      api: {
        totalRequests: apiReport.metrics.length,
        averageResponseTime: apiReport.totalDuration / apiReport.metrics.length || 0,
        slowRequests: apiReport.slowOperations.length,
        metrics: apiReport.metrics,
      },
      database: {
        totalQueries: dbReport.metrics.length,
        averageQueryTime: dbReport.totalDuration / dbReport.metrics.length || 0,
        slowQueries: dbReport.slowOperations.length,
        metrics: dbReport.metrics,
      },
      openai: {
        totalCalls: openaiReport.metrics.length,
        averageResponseTime: openaiReport.totalDuration / openaiReport.metrics.length || 0,
        slowCalls: openaiReport.slowOperations.length,
        metrics: openaiReport.metrics,
      },
      elevenlabs: {
        totalCalls: elevenLabsReport.metrics.length,
        averageResponseTime: elevenLabsReport.totalDuration / elevenLabsReport.metrics.length || 0,
        slowCalls: elevenLabsReport.slowOperations.length,
        metrics: elevenLabsReport.metrics,
      },
    },
    usage,
    errors: {
      total: 0, // Would be populated from error tracking
      byType: {},
      critical: 0,
    },
    resources: {
      memory: {
        used: memUsage.heapUsed,
        total: totalMem,
        percentage: (memUsage.heapUsed / totalMem) * 100,
      },
      connections: {
        websocket: 0, // Would be populated from Socket.IO metrics
        database: 0, // Would be populated from connection pool metrics
      },
    },
  };

  // Add cache headers for efficiency
  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      'X-Metrics-Period': period,
    },
  });
});

// Prometheus-compatible metrics endpoint
export async function POST(_request: NextRequest) {
  // Generate Prometheus format metrics
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  const prometheusMetrics = `
# HELP nodejs_heap_size_used_bytes Process heap size used in bytes
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${memUsage.heapUsed}

# HELP nodejs_external_memory_bytes Process external memory in bytes
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes ${memUsage.external}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${uptime}

# HELP eris_debate_version_info Eris Debate version information
# TYPE eris_debate_version_info gauge
eris_debate_version_info{version="${process.env.npm_package_version || '0.1.0'}",environment="${process.env.NODE_ENV}"} 1
`;

  return new NextResponse(prometheusMetrics, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
    },
  });
}