'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Layout from '@/components/layout/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import PreferencesSection from '@/components/preferences/PreferencesSection';
import LogoutButton from '@/components/auth/LogoutButton';
import ResetPasswordButton from '@/components/auth/ResetPasswordButton';
import type { User } from '@/types';

export default function PreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/auth');
          return;
        }
        
        setUser(session.user as User);
        setLoading(false);
      } catch (error) {
        console.error('Error checking authentication:', error);
        setLoading(false);
      }
    };
    
    checkUser();
  }, [router]);
  
  if (loading) {
    return <LoadingSpinner fullScreen text="Loading preferences..." />;
  }
  
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="pb-5 border-b border-gray-200 dark:border-gray-700 sm:flex sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">User Preferences</h1>
        </div>
        
        <div className="mt-6 grid grid-cols-1 gap-6">
          {/* Account section */}
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <div className="px-4 sm:px-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Account</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Manage your account settings
                </p>
              </div>
            </div>
            <div className="mt-5 md:mt-0 md:col-span-2">
              <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6 space-y-4">
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Account Information</h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                      <p>Email: {user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Reset Password</h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                      <p>Send a password reset link to your email address.</p>
                    </div>
                    <div className="mt-3">
                      <ResetPasswordButton userEmail={user?.email} />
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Sign Out</h3>
                    <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                      <p>Sign out of your account.</p>
                    </div>
                    <div className="mt-3">
                      <LogoutButton />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences section */}
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <div className="px-4 sm:px-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Personal Settings</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Customize how you experience Eris Debate with these settings.
                </p>
              </div>
            </div>
            <div className="mt-5 md:mt-0 md:col-span-2">
              <PreferencesSection />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 