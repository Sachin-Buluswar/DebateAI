'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useToast } from '@/components/ui/Toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type Preferences = {
  darkMode: boolean;
  autoSave: boolean;
  showWordCount: boolean;
  debateFormat: string;
  language: string;
  enhancedNavbar: boolean;
};

const defaultPreferences: Preferences = {
  darkMode: false,
  autoSave: true,
  showWordCount: true,
  debateFormat: 'policy',
  language: 'english',
  enhancedNavbar: true,
};

export default function PreferencesSection() {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { addToast } = useToast();
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('preferences')
            .eq('user_id', session.user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching preferences:', error);
            setError('Failed to fetch preferences');
          } else if (data) {
            setPreferences({ ...defaultPreferences, ...data.preferences });
            if (
              typeof data.preferences.darkMode === 'boolean' &&
              data.preferences.darkMode !== isDarkMode
            ) {
              toggleDarkMode();
            }
          }
        }
      } catch (err) {
        console.error('Exception fetching preferences:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError('You must be logged in to save preferences');
        addToast({ message: 'Login required to save preferences', type: 'error' });
        return;
      }

      const prefsToSave = { ...preferences, darkMode: isDarkMode };
      const { error } = await supabase.from('user_preferences').upsert(
        {
          user_id: session.user.id,
          preferences: prefsToSave,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.error('Error saving preferences:', error);
        setError('Failed to save preferences');
        addToast({ message: 'Failed to save preferences', type: 'error' });
      } else {
        setSuccess(true);
        addToast({ message: 'Preferences saved successfully!', type: 'success' });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Exception saving preferences:', err);
      setError('An unexpected error occurred');
      addToast({ message: 'Unexpected error saving preferences', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof Preferences) => {
    setPreferences({ ...preferences, [key]: !preferences[key as keyof Preferences] });
  };

  const handleSelect = (key: keyof Preferences, value: string) => {
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
          User Preferences
        </h3>
        <div className="mt-5">
          <div className="space-y-6">
            {/* Toggle Preferences */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex-grow flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Dark Mode
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Enable dark mode for reduced eye strain
                  </span>
                </span>
                <button
                  type="button"
                  className={`${isDarkMode ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                  onClick={toggleDarkMode}
                >
                  <span className="sr-only">Toggle dark mode</span>
                  <span
                    className={`${isDarkMode ? 'translate-x-5' : 'translate-x-0'} pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                  ></span>
                </button>
              </div>


              <div className="flex items-center justify-between">
                <span className="flex-grow flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Auto-Save Debates
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically save debate progress
                  </span>
                </span>
                <button
                  type="button"
                  className={`${
                    preferences.autoSave ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                  } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                  onClick={() => handleToggle('autoSave')}
                >
                  <span className="sr-only">Toggle auto-save</span>
                  <span
                    className={`${
                      preferences.autoSave ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                  ></span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex-grow flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Show Word Count
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Display word count during speeches
                  </span>
                </span>
                <button
                  type="button"
                  className={`${
                    preferences.showWordCount ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                  } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                  onClick={() => handleToggle('showWordCount')}
                >
                  <span className="sr-only">Toggle word count</span>
                  <span
                    className={`${
                      preferences.showWordCount ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                  ></span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex-grow flex flex-col">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Enhanced Navigation
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Use modern navigation with smooth animations
                  </span>
                </span>
                <button
                  type="button"
                  className={`${
                    preferences.enhancedNavbar ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                  } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                  onClick={() => handleToggle('enhancedNavbar')}
                >
                  <span className="sr-only">Toggle enhanced navigation</span>
                  <span
                    className={`${
                      preferences.enhancedNavbar ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                  ></span>
                </button>
              </div>
            </div>

            {/* Select Preferences */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="debate-format"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Debate Format
                </label>
                <input
                  id="debate-format"
                  name="debate-format"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white cursor-not-allowed opacity-70"
                  value="Public Forum"
                  disabled
                  readOnly
                />
              </div>

              <div>
                <label
                  htmlFor="language"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Language
                </label>
                <select
                  id="language"
                  name="language"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
                  value={preferences.language}
                  onChange={(e) => handleSelect('language', e.target.value)}
                >
                  <option value="english">English</option>
                  <option value="spanish">Spanish</option>
                  <option value="french">French</option>
                  <option value="german">German</option>
                  <option value="chinese">Chinese</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm rounded-md">
              Preferences saved successfully!
            </div>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={savePreferences}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Saving...</span>
                </div>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
