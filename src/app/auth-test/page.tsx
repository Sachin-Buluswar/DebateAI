'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export default function AuthTestPage() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
    console.log('Auth test page loaded');
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined');
    console.log('Supabase Anon Key exists:', Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  }, []);
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center mb-6">Auth Test Page</h1>
        
        {isClient && (
          <div style={{ color: 'black' }}>
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                style: {
                  container: { color: 'black' },
                  button: { color: 'black', backgroundColor: 'white', border: '1px solid black' },
                  input: { color: 'black', backgroundColor: 'white', border: '1px solid gray' },
                  label: { color: 'black' }
                }
              }}
              theme="light"
              providers={['google', 'github']}
            />
          </div>
        )}
      </div>
    </div>
  );
} 