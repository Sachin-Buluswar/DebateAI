import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { debugQuerySchema, DebugQueryParams } from '@/utils/validators';
import { validateEnvironment } from '@/lib/envValidation';

// Create a Supabase admin client with service role
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

interface Diagnostics {
  timestamp: string;
  deployment: {
    environment: string;
    vercel: {
      isVercel: boolean;
      region?: string;
      url?: string;
    };
    host?: string;
    protocol?: string;
  };
  envValidation: {
    isValid: boolean;
    missing: string[];
    warnings: string[];
    variables: Record<string, boolean | string | undefined>;
  };
  socketIO: {
    pollingSupported: boolean;
    websocketSupported: boolean;
    recommendedTransport: string;
  };
  supabase_url: string;
  service_role_key: string;
  tables: Record<string, unknown>;
  storage: Record<string, unknown>;
  errors: string[];
  test_insert?: {
    requested: boolean;
    user_id?: string;
    timestamp: string;
    error?: string;
    success?: boolean;
    inserted_record?: unknown;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Check IP restriction
  const allowedIPs = process.env.DEBUG_ALLOWED_IPS?.split(',') || [];
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip');
  
  if (allowedIPs.length > 0 && clientIP && !allowedIPs.includes(clientIP)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  
  const searchParams = request.nextUrl.searchParams;
  const rawParams = Object.fromEntries(searchParams.entries());
  const parseParams = debugQuerySchema.safeParse(rawParams);
  if (!parseParams.success) {
    return NextResponse.json({ error: 'Invalid query parameters', details: parseParams.error.flatten() }, { status: 400 });
  }
  const { key: debugKey, insert, userId }: DebugQueryParams = parseParams.data;
  const testInsert = insert === 'true';
  
  // Compare against env var to avoid hardcoding in repo
  const expectedKey = process.env.DEBUG_API_KEY;
  if (!expectedKey || debugKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const envValidation = validateEnvironment();
  
  const diagnostics: Diagnostics = {
    timestamp: new Date().toISOString(),
    deployment: {
      environment: process.env.NODE_ENV || 'unknown',
      vercel: {
        isVercel: process.env.VERCEL === '1',
        region: process.env.VERCEL_REGION,
        url: process.env.VERCEL_URL,
      },
      host: request.headers.get('host') || undefined,
      protocol: request.headers.get('x-forwarded-proto') || 'http',
    },
    envValidation: {
      ...envValidation,
      variables: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        ELEVENLABS_API_KEY: !!process.env.ELEVENLABS_API_KEY,
        OPENAI_VECTOR_STORE_ID: !!process.env.OPENAI_VECTOR_STORE_ID,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      },
    },
    socketIO: {
      pollingSupported: true,
      websocketSupported: !process.env.VERCEL,
      recommendedTransport: process.env.VERCEL ? 'polling' : 'websocket',
    },
    supabase_url: supabaseUrl ? "Set" : "Missing",
    service_role_key: serviceRoleKey ? "Available" : "Missing",
    tables: {},
    storage: {},
    errors: [],
  };
  
  // Test insert if requested
  if (testInsert && userId) {
    try {
      diagnostics.test_insert = {
        requested: true,
        user_id: userId,
        timestamp: new Date().toISOString()
      };
      
      // Attempt to insert a test record
      const testData = {
        id: crypto.randomUUID(),
        user_id: userId,
        topic: "Test Speech for Debug API",
        feedback: {
          overall: "This is a test record inserted by the debug API.",
          delivery: {
            pronunciation: ["Test pronunciation point"],
            pacing: ["Test pacing point"],
            vocalVariety: ["Test vocal variety point"],
            volume: ["Test volume point"]
          },
          arguments: {
            claims: ["Test claims point"],
            evidence: ["Test evidence point"],
            organization: ["Test organization point"],
            counterarguments: ["Test counterarguments point"]
          },
          persuasiveness: {
            ethos: ["Test ethos point"],
            pathos: ["Test pathos point"],
            logos: ["Test logos point"]
          },
          recommendations: ["Test recommendation"],
          scores: {
            overall: 0.85,
            delivery: 0.82,
            arguments: 0.88,
            persuasiveness: 0.86
          }
        },
        audio_url: "https://example.com/test-audio.mp3",
        speech_type: "debate",
        created_at: new Date().toISOString(),
        file_size_bytes: 1000,
        duration_seconds: 60
      };
      
      const { data, error } = await supabase
        .from("speech_feedback")
        .insert(testData)
        .select();
        
      if (error) {
        diagnostics.test_insert.error = error.message;
        diagnostics.test_insert.success = false;
        diagnostics.errors.push(`Test insert error: ${error.message}`);
      } else {
        diagnostics.test_insert.success = true;
        diagnostics.test_insert.inserted_record = data;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      diagnostics.test_insert = {
        requested: true,
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
      diagnostics.errors.push(`Test insert exception: ${errorMessage}`);
    }
  }
  
  // Check speech_feedback table
  try {
    // Test if table exists by counting records
    const { count, error } = await supabase
      .from("speech_feedback")
      .select("*", { count: "exact", head: true });
      
    if (error) {
      diagnostics.errors.push(`Table error: ${error.message}`);
      diagnostics.tables.speech_feedback = "Error";
    } else {
      diagnostics.tables.speech_feedback = {
        exists: true,
        record_count: count,
      };
      
      // Get a sample of records to check structure
      const { data: samples, error: sampleError } = await supabase
        .from("speech_feedback")
        .select("*")
        .limit(5);
        
      if (sampleError) {
        diagnostics.errors.push(`Sample error: ${sampleError.message}`);
      } else {
        (diagnostics.tables.speech_feedback as Record<string, unknown>).samples = samples;
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    diagnostics.errors.push(`Table check error: ${errorMessage}`);
  }
  
  // Check storage buckets
  try {
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
      
    if (bucketsError) {
      diagnostics.errors.push(`Buckets error: ${bucketsError.message}`);
      diagnostics.storage.buckets = "Error";
    } else {
      diagnostics.storage.buckets = buckets.map(b => b.name);
      
      // Check speech_audio bucket contents if it exists
      if (buckets.some(b => b.name === "speech_audio")) {
        const { data: files, error: filesError } = await supabase
          .storage
          .from("speech_audio")
          .list();
          
        if (filesError) {
          diagnostics.errors.push(`Files error: ${filesError.message}`);
          diagnostics.storage.speech_audio = "Error listing files";
        } else {
          diagnostics.storage.speech_audio = {
            file_count: files.length,
            files: files.slice(0, 10), // Show up to 10 files
          };
        }
      } else {
        diagnostics.storage.speech_audio = "Bucket not found";
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
    diagnostics.errors.push(`Storage check error: ${errorMessage}`);
  }
  
  return NextResponse.json(diagnostics);
} 