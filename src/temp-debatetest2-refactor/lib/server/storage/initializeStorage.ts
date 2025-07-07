/**
 * DebateAI - Storage Initialization Utility
 * Initializes storage buckets and policies on server startup
 */

import dotenv from 'dotenv';

// Define OperationResult inline as types.ts doesn't seem to exist
interface OperationResult {
  operation: string;
  success: boolean;
  error?: unknown;
  details?: string;
}
import { ensureStorageBucketsExist } from './setupStorage.js'; // Add .js extension

// Load environment variables
dotenv.config();

/**
 * Initializes all storage resources needed for the application
 * This should be called when the server starts
 */
async function initializeStorage(): Promise<boolean> {
  console.log('🔄 Initializing storage resources...');
  
  try {
    // Ensure storage buckets exist with proper configuration
    const { success, operations } = await ensureStorageBucketsExist();
    
    if (success) {
      console.log('✅ Storage initialization complete');
      
      // Log successful operations
      const successfulOps = operations.filter(op => op.success);
      if (successfulOps.length > 0) {
        console.log(`✅ Successfully completed ${successfulOps.length} storage operations`);
      }
    } else {
      // Log failed operations
      const failedOps = operations.filter(op => !op.success) as OperationResult[];
      console.error(`❌ Storage initialization completed with ${failedOps.length} errors:`);
      failedOps.forEach(op => {
        console.error(`  - ${op.operation} failed: ${op.error || 'Unknown error'}`);
      });
    }
    
    return success;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('❌ Failed to initialize storage:', errorMessage);
    return false;
  }
}

export { initializeStorage }; 