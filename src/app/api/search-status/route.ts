/**
 * Search System Status Check Endpoint
 * Returns information about the current state of the document search and AI assistant systems
 * 
 * This is a health check endpoint - public access allowed but uses authenticated client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { addSecurityHeaders } from '@/middleware/inputValidation';
import { optionalAuth } from '@/lib/auth-middleware';

interface SearchStatusInfo {
  database: { connected: boolean; documents: number; chunks: number; indexedDocuments: number };
  storage: { bucketExists: boolean; fileCount: number };
  search: { documentSearchEnabled: boolean; fullTextEnabled: boolean; trigramEnabled: boolean; indexesCreated: boolean; aiAssistantEnabled: boolean };
  configuration: { supabaseUrl: boolean; supabaseKey: boolean; openaiKey: boolean; vectorStoreId: boolean };
}

export async function GET(request: NextRequest) {
  // This is a health check endpoint - allow public access but use authenticated client if available
  return optionalAuth(request, async (req) => {
    const supabase = createClient();
    
    try {
      const status = {
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          documents: 0,
          chunks: 0,
          indexedDocuments: 0,
        },
        storage: {
          bucketExists: false,
          fileCount: 0,
        },
        search: {
          documentSearchEnabled: false,
          fullTextEnabled: false,
          trigramEnabled: false,
          indexesCreated: false,
          aiAssistantEnabled: false,
        },
        configuration: {
          supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, // Check anon key, not service role
          openaiKey: !!process.env.OPENAI_API_KEY,
          vectorStoreId: !!process.env.OPENAI_VECTOR_STORE_ID,
        },
        user: req.user ? { authenticated: true, id: req.user.id } : { authenticated: false }
      };

      // Check database connection and counts
      try {
        const { count: docCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true });
        
        const { count: chunkCount } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true });

        status.database.connected = true;
        status.database.documents = docCount || 0;
        status.database.chunks = chunkCount || 0;

        // Count indexed documents
        const { count: indexedCount } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .not('indexed_at', 'is', null);
        
        status.database.indexedDocuments = indexedCount || 0;
      } catch (_error) {
        // PRODUCTION: Logging disabled
// console.error('Database check failed:', _error);
      }

      // Check storage bucket
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        
        if (buckets) {
          const debateBucket = buckets.find(b => b.name === 'debate-documents');
          status.storage.bucketExists = !!debateBucket;
          
          if (debateBucket) {
            const { data: files } = await supabase.storage
              .from('debate-documents')
              .list('', { limit: 1000 });
            
            status.storage.fileCount = files?.length || 0;
          }
        }
      } catch (_error) {
        // PRODUCTION: Logging disabled
// console.error('Storage check failed:', _error);
      }

      // Check search capabilities
      try {
        // Check if pg_trgm extension is installed
        let extensions: Array<{ extname?: string }> = [];
        try {
          const result = await supabase.rpc('get_installed_extensions' as string);
          extensions = (result.data as Array<{ extname?: string }>) || [];
        } catch (_error) {
          // PRODUCTION: Logging disabled
// console.error('Failed to get extensions:', _error);
        }
        
        if (Array.isArray(extensions)) {
          status.search.trigramEnabled = extensions.some(ext => ext.extname === 'pg_trgm');
        }

        // Check if search indexes exist
        let indexes: Array<{ indexname?: string }> = [];
        try {
          const result = await supabase
            .from('pg_indexes' as string)
            .select('indexname')
            .eq('tablename', 'document_chunks');
          indexes = (result.data as Array<{ indexname?: string }>) || [];
        } catch (_error) {
          // PRODUCTION: Logging disabled
// console.error('Failed to get indexes:', _error);
        }
        
        if (indexes && indexes.length > 0) {
          status.search.fullTextEnabled = indexes.some(idx => 
            idx.indexname?.includes('search_vector')
          );
          status.search.indexesCreated = indexes.length > 2;
        }

        // Document search is enabled if we have documents and indexes
        status.search.documentSearchEnabled = 
          status.database.chunks > 0 && 
          (status.search.fullTextEnabled || status.search.trigramEnabled);

        // AI Assistant is enabled if OpenAI is configured
        status.search.aiAssistantEnabled = 
          !!status.configuration.openaiKey && 
          !!status.configuration.vectorStoreId;

      } catch (_error) {
        // PRODUCTION: Logging disabled
// console.error('Search capability check failed:', _error);
      }

      // Calculate health score
      const healthScore = calculateHealthScore(status);

      return addSecurityHeaders(
        NextResponse.json({
          healthy: healthScore >= 70,
          healthScore,
          status,
          recommendations: getRecommendations(status),
        })
      );
    } catch (_error) {
      // PRODUCTION: Logging disabled
// console.error('Search status check failed:', _error);
      return addSecurityHeaders(
        NextResponse.json(
          {
            healthy: false,
            error: 'Failed to check search system status',
          },
          { status: 500 }
        )
      );
    }
  });
}

function calculateHealthScore(status: SearchStatusInfo): number {
  let score = 0;
  
  // Database health (30 points)
  if (status.database.connected) score += 10;
  if (status.database.documents > 0) score += 10;
  if (status.database.chunks > 0) score += 10;
  
  // Storage health (20 points)
  if (status.storage.bucketExists) score += 10;
  if (status.storage.fileCount > 0) score += 10;
  
  // Search health (30 points)
  if (status.search.documentSearchEnabled) score += 15;
  if (status.search.aiAssistantEnabled) score += 15;
  
  // Configuration health (20 points)
  if (status.configuration.supabaseUrl) score += 5;
  if (status.configuration.supabaseKey) score += 5;
  if (status.configuration.openaiKey) score += 5;
  if (status.configuration.vectorStoreId) score += 5;
  
  return score;
}

function getRecommendations(status: SearchStatusInfo): string[] {
  const recommendations: string[] = [];
  
  if (!status.database.connected) {
    recommendations.push('Check database connection and credentials');
  }
  
  if (status.database.documents === 0) {
    recommendations.push('Upload documents to enable search functionality');
  }
  
  if (status.database.documents > 0 && status.database.chunks === 0) {
    recommendations.push('Index existing documents to create searchable chunks');
  }
  
  if (!status.storage.bucketExists) {
    recommendations.push('Create "debate-documents" storage bucket in Supabase');
  }
  
  if (!status.search.fullTextEnabled && !status.search.trigramEnabled) {
    recommendations.push('Run migrations to enable full-text search capabilities');
  }
  
  if (!status.search.aiAssistantEnabled) {
    recommendations.push('Configure OpenAI credentials to enable AI Assistant mode (optional)');
  }
  
  if (!status.search.documentSearchEnabled && status.database.chunks > 0) {
    recommendations.push('Enable search indexes for better performance');
  }
  
  return recommendations;
}