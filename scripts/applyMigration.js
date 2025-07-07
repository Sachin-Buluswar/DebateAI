#!/usr/bin/env node

/**
 * Supabase Migration Utility
 * Applies SQL migration files to a Supabase database
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials in .env.local file');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationPath) {
  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log(`Applying migration: ${path.basename(migrationPath)}`);
    
    // Execute the SQL script
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error(`Error applying migration ${path.basename(migrationPath)}:`, error);
      return false;
    }
    
    console.log(`Successfully applied migration: ${path.basename(migrationPath)}`);
    return true;
  } catch (err) {
    console.error(`Error reading or applying migration ${path.basename(migrationPath)}:`, err);
    return false;
  }
}

async function applyMigrations() {
  // Path to migrations directory
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  
  // Get all SQL files in the migrations directory
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Apply in alphabetical order
  
  if (migrationFiles.length === 0) {
    console.log('No migration files found');
    return;
  }
  
  // Apply migrations one by one
  let successCount = 0;
  
  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const success = await applyMigration(migrationPath);
    if (success) successCount++;
  }
  
  console.log(`Applied ${successCount} out of ${migrationFiles.length} migrations`);
}

// Execute the main function
applyMigrations().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
}); 