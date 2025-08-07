const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function createTable() {
  try {
    // First, try to create just the basic table structure
    console.log('Creating educational_resources table...');
    
    // Use a very simple INSERT approach as a test
    const { data, error } = await supabase
      .from('educational_resources')
      .insert([
        {
          title: 'Introduction to Public Forum Debate',
          slug: 'intro-to-public-forum',
          description: 'A comprehensive slideshow covering the fundamentals of Public Forum debate.',
          category: 'slideshows',
          file_url: '/resources/slideshows/intro-to-public-forum.pdf',
          file_type: 'pdf',
          authors: ['Sachin Buluswar', 'Kevin Cheng'],
          tags: ['beginner', 'fundamentals', 'public-forum'],
          difficulty: 'beginner',
          duration_minutes: 30,
          is_featured: true,
          is_published: true
        }
      ])
      .select();
    
    if (error) {
      console.error('Table does not exist. Error:', error);
      console.log('This confirms the table needs to be created manually.');
      
      // Let's try to see if we can query existing tables to confirm connection
      console.log('\nTesting database connection with existing tables...');
      const { data: healthData, error: healthError } = await supabase
        .from('health_check')
        .select('*')
        .limit(1);
      
      if (healthError) {
        console.error('Connection test failed:', healthError);
      } else {
        console.log('Connection successful. Health check data:', healthData);
        console.log('\n✓ Database connection is working');
        console.log('✗ educational_resources table does not exist');
        console.log('\nNext steps:');
        console.log('1. Access Supabase Dashboard at: https://supabase.com/dashboard/project/dyxjebocbozvodcempdb');
        console.log('2. Go to SQL Editor');
        console.log('3. Run the SQL from create_educational_resources.sql');
      }
      
    } else {
      console.log('Success! Resource inserted:', data);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTable();