/**
 * Eris Debate - Environment Validation Utility
 * Validates that required environment variables are set on startup
 */

import { validationSchema } from '../backend/config/env.validation.js';
import dotenv from 'dotenv';
import chalk from 'chalk';

export default function validateEnvironmentVariables(): boolean {
  // Load .env files
  dotenv.config({ path: '.env.local' });
  
  // Get current environment variables
  const currentEnv = {
    // Supabase credentials
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

    // OpenAI API key
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_VECTOR_FILE_ID: process.env.OPENAI_VECTOR_FILE_ID,

    // Server configuration
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    HOST: process.env.HOST,
    NODE_ENV: process.env.NODE_ENV,
  };
  
  // Validate environment variables
  const { error } = validationSchema.validate(currentEnv, { 
    allowUnknown: true,
    abortEarly: false 
  });
  
  if (error) {
    console.error(chalk.red('❌ Environment validation failed:'));
    
    // Log each validation error
    error.details.forEach((detail) => {
      console.error(chalk.red(`  - ${detail.message}`));
    });
    
    console.error(chalk.yellow('\n📝 Please check your .env.local file and ensure all required variables are set.'));
    console.error(chalk.yellow('📝 Required variables:'));
    console.error(chalk.yellow('  - NEXT_PUBLIC_SUPABASE_URL'));
    console.error(chalk.yellow('  - NEXT_PUBLIC_SUPABASE_ANON_KEY'));
    console.error(chalk.yellow('  - SUPABASE_SERVICE_ROLE_KEY'));
    console.error(chalk.yellow('  - OPENAI_API_KEY'));
    
    // Exit with error if in production
    if (process.env.NODE_ENV === 'production') {
      console.error(chalk.red('\n🚨 Exiting due to missing required environment variables in production.'));
      process.exit(1);
    }
    
    return false;
  }
  
  console.log(chalk.green('✅ Environment validation passed'));
  
  // Log which optional variables are missing
  const missingOptional = [];
  if (!process.env.PINECONE_API_KEY) missingOptional.push('PINECONE_API_KEY');
  if (!process.env.PINECONE_ENVIRONMENT) missingOptional.push('PINECONE_ENVIRONMENT');
  
  if (missingOptional.length > 0) {
    console.log(chalk.yellow('⚠️ Optional variables not set:'));
    missingOptional.forEach(variable => {
      console.log(chalk.yellow(`  - ${variable}`));
    });
  }
  
  return true;
}

// If this file is run directly, validate environment variables
// Note: require.main is a CommonJS construct. This check may not behave as expected in a pure ESM environment.
try {
  if (require.main === module) {
    validateEnvironmentVariables();
  }
} catch {
  // In an ESM context, require is not defined. We can ignore this error.
} 