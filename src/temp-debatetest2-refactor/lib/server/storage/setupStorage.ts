/**
 * DebateAI - Storage Setup Utility
 * Ensures required storage buckets exist in Supabase with proper configuration and RLS policies
 */

import { supabaseAdmin } from '@/backend/lib/supabaseAdmin';

interface BucketConfig {
  name: string;
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
}

interface StoragePolicy {
    name: string;
    table: string;
    command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
    using?: string;
    check?: string;
}

interface OperationResult {
    operation: string;
    success: boolean;
    error?: string;
    bucket?: string;
    policy?: string;
}

/**
 * Defines configurations for required storage buckets
 */
export const BUCKET_CONFIGS: BucketConfig[] = [
  {
    name: 'speech_audio',
    public: true,
    fileSizeLimit: 62914560, // 60MB for long recordings
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
  },
  {
    name: 'debate_audio',
    public: true,
    fileSizeLimit: 62914560, // 60MB for long recordings
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm']
  }
];

/**
 * Defines RLS policies for storage objects
 */
export const STORAGE_POLICIES: StoragePolicy[] = [
  {
    name: "Users can view their own speech audio",
    table: "storage.objects",
    command: "SELECT",
    using: "(bucket_id = 'speech_audio' AND auth.uid()::text = (storage.foldername(name))[1])"
  },
  {
    name: "Users can upload their own speech audio",
    table: "storage.objects",
    command: "INSERT",
    check: "(bucket_id = 'speech_audio' AND auth.uid()::text = (storage.foldername(name))[1])"
  },
  {
    name: "Users can delete their own speech audio",
    table: "storage.objects",
    command: "DELETE",
    using: "(bucket_id = 'speech_audio' AND auth.uid()::text = (storage.foldername(name))[1])"
  },
  {
    name: "Users can view their own debate audio",
    table: "storage.objects",
    command: "SELECT",
    using: "(bucket_id = 'debate_audio' AND auth.uid()::text = (storage.foldername(name))[1])"
  },
  {
    name: "Users can upload their own debate audio",
    table: "storage.objects",
    command: "INSERT",
    check: "(bucket_id = 'debate_audio' AND auth.uid()::text = (storage.foldername(name))[1])"
  },
  {
    name: "Users can delete their own debate audio",
    table: "storage.objects",
    command: "DELETE",
    using: "(bucket_id = 'debate_audio' AND auth.uid()::text = (storage.foldername(name))[1])"
  }
];

/**
 * Ensures all required storage buckets exist with proper configuration
 * @returns {Promise<{success: boolean, operations: Array<Object>}>} Result of operations
 */
async function ensureStorageBucketsExist(): Promise<{success: boolean, operations: OperationResult[]}> {
  const operations: OperationResult[] = [];
  
  try {
    console.log('Checking required storage buckets...');
    
    // Get existing buckets
    const { data: existingBuckets, error: bucketsError } = await supabaseAdmin.storage.listBuckets();
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return { 
        success: false, 
        operations: [{ 
          operation: 'list_buckets', 
          success: false, 
          error: bucketsError.message 
        }]
      };
    }
    
    const existingBucketNames = existingBuckets?.map(b => b.name) || [];
    console.log('Existing buckets:', existingBucketNames);
    
    // Process each required bucket config
    for (const bucketConfig of BUCKET_CONFIGS) {
      const exists = existingBucketNames.includes(bucketConfig.name);
      
      if (!exists) {
        // Create missing bucket
        try {
          console.log(`Creating missing bucket: ${bucketConfig.name}`);
          
          // First create the bucket
          const { error: createError } = await supabaseAdmin.storage.createBucket(
            bucketConfig.name, 
            {
              public: bucketConfig.public,
              fileSizeLimit: bucketConfig.fileSizeLimit,
              allowedMimeTypes: bucketConfig.allowedMimeTypes
            }
          );
          
          if (createError) {
            console.error(`Error creating bucket ${bucketConfig.name}:`, createError);
            operations.push({
              bucket: bucketConfig.name,
              operation: 'create',
              success: false,
              error: createError.message
            });
            continue; // Skip to next bucket
          }
          
          // Set CORS configuration for the bucket
          await setCORSConfiguration(bucketConfig.name);
          
          console.log(`Successfully created bucket: ${bucketConfig.name}`);
          operations.push({
            bucket: bucketConfig.name,
            operation: 'create',
            success: true
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
          console.error(`Error creating bucket ${bucketConfig.name}:`, err);
          operations.push({
            bucket: bucketConfig.name,
            operation: 'create',
            success: false,
            error: errorMessage
          });
        }
      } else {
        // Update existing bucket configuration
        try {
          console.log(`Updating bucket: ${bucketConfig.name}`);
          
          // Update bucket settings
          const { error: updateError } = await supabaseAdmin.storage.updateBucket(
            bucketConfig.name, 
            {
              public: bucketConfig.public,
              fileSizeLimit: bucketConfig.fileSizeLimit,
              allowedMimeTypes: bucketConfig.allowedMimeTypes
            }
          );
          
          if (updateError) {
            console.error(`Error updating bucket ${bucketConfig.name}:`, updateError);
            operations.push({
              bucket: bucketConfig.name,
              operation: 'update',
              success: false,
              error: updateError.message
            });
            continue; // Skip to next bucket
          }
          
          // Set CORS configuration for the bucket
          await setCORSConfiguration(bucketConfig.name);
          
          console.log(`Successfully updated bucket: ${bucketConfig.name}`);
          operations.push({
            bucket: bucketConfig.name,
            operation: 'update',
            success: true
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
          console.error(`Error updating bucket ${bucketConfig.name}:`, err);
          operations.push({
            bucket: bucketConfig.name,
            operation: 'update',
            success: false,
            error: errorMessage
          });
        }
      }
    }
    
    // Set up RLS policies
    const policyResults = await setupRLSPolicies();
    operations.push(...policyResults);
    
    return {
      success: operations.every(op => op.success !== false),
      operations
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error ensuring storage buckets exist:', error);
    return {
      success: false,
      operations: [
        ...operations,
        {
          operation: 'overall',
          success: false,
          error: errorMessage
        }
      ]
    };
  }
}

/**
 * Sets CORS configuration for a bucket to allow browser access
 * @param {string} bucketName - Name of the bucket to configure
 */
async function setCORSConfiguration(bucketName: string): Promise<boolean> {
  try {
    // Note: We cannot directly set CORS via the Supabase JS client
    // The public: true setting is the most important for Next.js compatibility
    
    // For comprehensive CORS configuration, administrators should:
    // 1. Use the Supabase dashboard to set CORS headers
    // 2. Or use the Supabase Management API directly
    
    console.log(`  ℹ️ CORS configuration must be set through Supabase dashboard for bucket: ${bucketName}`);
    console.log(`  ✓ Public access enabled which allows Next.js to fetch assets`);
    
    return true;
  } catch (err: unknown) {
    console.error(`Error with CORS configuration for bucket ${bucketName}:`, err);
    return false;
  }
}

/**
 * Sets up RLS policies for storage objects
 * @returns {Promise<Array>} Array of operation results
 */
async function setupRLSPolicies(): Promise<OperationResult[]> {
  const operations: OperationResult[] = [];
  
  try {
    console.log('Setting up RLS policies for storage.objects...');
    
    // Apply each policy
    for (const policy of STORAGE_POLICIES) {
      try {
        // Drop policy if it exists
        await supabaseAdmin.rpc('run_sql', { 
          query: `DROP POLICY IF EXISTS "${policy.name}" ON ${policy.table}` 
        });
        
        // Create new policy
        let policyQuery;
        if (policy.command === 'SELECT' || policy.command === 'DELETE') {
          policyQuery = `CREATE POLICY "${policy.name}" ON ${policy.table} 
                        FOR ${policy.command} 
                        USING (${policy.using})`;
        } else {
          policyQuery = `CREATE POLICY "${policy.name}" ON ${policy.table} 
                        FOR ${policy.command} 
                        WITH CHECK (${policy.check})`;
        }
        
        const { error } = await supabaseAdmin.rpc('run_sql', { query: policyQuery });
        
        if (error) {
          console.error(`Error creating policy "${policy.name}":`, error);
          operations.push({
            policy: policy.name,
            operation: 'create_policy',
            success: false,
            error: error.message
          });
        } else {
          console.log(`Successfully created policy: ${policy.name}`);
          operations.push({
            policy: policy.name,
            operation: 'create_policy',
            success: true
          });
        }
      } catch (policyErr: unknown) {
        const errorMessage = policyErr instanceof Error ? policyErr.message : 'An unknown error occurred';
        console.error(`Error with policy "${policy.name}":`, policyErr);
        operations.push({
          policy: policy.name,
          operation: 'create_policy',
          success: false,
          error: errorMessage
        });
      }
    }
    
    return operations;
  } catch (rlsErr: unknown) {
    const errorMessage = rlsErr instanceof Error ? rlsErr.message : 'An unknown error occurred';
    console.error('Error setting up RLS policies:', rlsErr);
    return [
      {
        operation: 'rls_setup',
        success: false,
        error: errorMessage
      }
    ];
  }
}

export { ensureStorageBucketsExist }; 