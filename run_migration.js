const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSql = fs.readFileSync('create_educational_resources.sql', 'utf8');
    
    console.log('Executing migration...');
    
    // Split the SQL into individual statements
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      
      try {
        const { error } = await supabase.rpc('exec', { sql: statement });
        
        if (error) {
          console.error('Error executing statement:', error);
          // Try direct approach
          console.log('Trying alternative approach...');
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql: statement })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('REST API error:', errorText);
          } else {
            console.log('Statement executed successfully via REST API');
          }
        } else {
          console.log('Statement executed successfully');
        }
      } catch (err) {
        console.error('Statement failed:', err.message);
        continue;
      }
    }
    
    console.log('Migration completed!');
    
    // Test if table was created
    console.log('Testing table creation...');
    const { data, error } = await supabase
      .from('educational_resources')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Table test failed:', error);
    } else {
      console.log('Table created successfully! Data:', data);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();