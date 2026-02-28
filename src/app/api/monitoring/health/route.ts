import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { apiLogger } from '@/lib/monitoring/logger';
import { withMonitoring } from '@/lib/monitoring/middleware';
import { traceAsync } from '@/lib/monitoring/opentelemetry';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  details?: Record<string, unknown>;
  error?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks: HealthCheckResult[];
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

async function checkSupabase(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Use the authenticated server client instead of service role key
    const supabase = createClient();

    const { error } = await supabase
      .from('health_check')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      return {
        service: 'supabase',
        status: 'unhealthy',
        responseTime,
        error: error.message,
      };
    }

    return {
      service: 'supabase',
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
    };
  } catch (_error) {
    return {
      service: 'supabase',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: _error instanceof Error ? _error.message : 'Unknown error',
    };
  }
}

async function checkOpenAI(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      return {
        service: 'openai',
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      service: 'openai',
      status: responseTime < 2000 ? 'healthy' : 'degraded',
      responseTime,
    };
  } catch (_error) {
    return {
      service: 'openai',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: _error instanceof Error ? _error.message : 'Unknown error',
    };
  }
}

async function checkElevenLabs(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/models', {
      method: 'GET',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTime = Date.now() - start;

    if (!response.ok) {
      return {
        service: 'elevenlabs',
        status: 'unhealthy',
        responseTime,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      service: 'elevenlabs',
      status: responseTime < 2000 ? 'healthy' : 'degraded',
      responseTime,
    };
  } catch (_error) {
    return {
      service: 'elevenlabs',
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: _error instanceof Error ? _error.message : 'Unknown error',
    };
  }
}

// Health check - publicly accessible for load balancers/monitoring
export const GET = withMonitoring(async (_request: NextRequest) => {
  return traceAsync('health-check', async () => {
    const [supabaseCheck, openaiCheck, elevenlabsCheck] = await Promise.allSettled([
      checkSupabase(),
      checkOpenAI(),
      checkElevenLabs(),
    ]);

    const checks: HealthCheckResult[] = [
      supabaseCheck.status === 'fulfilled' ? supabaseCheck.value : {
        service: 'supabase',
        status: 'unhealthy' as const,
        error: 'Check failed',
      },
      openaiCheck.status === 'fulfilled' ? openaiCheck.value : {
        service: 'openai',
        status: 'unhealthy' as const,
        error: 'Check failed',
      },
      elevenlabsCheck.status === 'fulfilled' ? elevenlabsCheck.value : {
        service: 'elevenlabs',
        status: 'unhealthy' as const,
        error: 'Check failed',
      },
    ];

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const memUsage = process.memoryUsage();
    const totalMem = process.env.NODE_ENV === 'production' ? 512 * 1024 * 1024 : 2048 * 1024 * 1024;

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      checks,
      resources: {
        memory: {
          used: memUsage.heapUsed,
          total: totalMem,
          percentage: (memUsage.heapUsed / totalMem) * 100,
        },
      },
    };

    if (overallStatus !== 'healthy') {
      apiLogger.warn('Health check detected issues', {
        metadata: {
          status: overallStatus,
          failedChecks: checks.filter(c => c.status !== 'healthy'),
        },
      });
    }

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthStatus, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': overallStatus,
      },
    });
  });
});

// Liveness probe
export async function HEAD(_request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}

// Readiness probe
export const POST = withMonitoring(async (_request: NextRequest) => {
  const supabaseCheck = await checkSupabase();

  if (supabaseCheck.status === 'unhealthy') {
    return NextResponse.json(
      {
        ready: false,
        reason: 'Database unavailable',
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});
