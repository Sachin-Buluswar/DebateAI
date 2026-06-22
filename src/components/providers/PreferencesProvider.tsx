'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Preferences = {
  darkMode: boolean;
  autoSave: boolean;
  showWordCount: boolean;
  debateFormat: string;
};

const defaultPreferences: Preferences = {
  darkMode: false,
  autoSave: true,
  showWordCount: true,
  debateFormat: 'policy',
};

interface PreferencesContextType {
  preferences: Preferences;
  updatePreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  loading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('preferences')
            .eq('user_id', user.id)
            .single();

          if (!error && data) {
            setPreferences({ ...defaultPreferences, ...data.preferences });
          }
        }
      } catch (_err) {
        // PRODUCTION: Console disabled
        // console.error('Error fetching preferences:', _err);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  const updatePreference = async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    // Save to database if user is logged in
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('user_preferences').upsert(
          {
            user_id: user.id,
            preferences: newPreferences,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }
    } catch (_err) {
      // PRODUCTION: Console disabled
      // console.error('Error saving preference:', _err);
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, loading }}>
      {children}
    </PreferencesContext.Provider>
  );
};
