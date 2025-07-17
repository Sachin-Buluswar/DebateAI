'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
  enhancedNavbar: false,
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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('preferences')
            .eq('user_id', session.user.id)
            .single();

          if (!error && data) {
            setPreferences({ ...defaultPreferences, ...data.preferences });
          }
        }
      } catch (err) {
        console.error('Error fetching preferences:', err);
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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await supabase.from('user_preferences').upsert({
          user_id: session.user.id,
          preferences: newPreferences,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    } catch (err) {
      console.error('Error saving preference:', err);
    }
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, loading }}>
      {children}
    </PreferencesContext.Provider>
  );
};