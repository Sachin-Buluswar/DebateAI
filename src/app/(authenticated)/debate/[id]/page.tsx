'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface TranscriptEntry {
  role: 'user' | 'ai';
  text: string;
}

export default function DebateDetail() {
  const params = useParams();
  const debateId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    if (!debateId) return;

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('debate_history')
          .select('*')
          .eq('id', debateId)
          .single();

        if (fetchError || !data) {
          setError('Could not load debate. It may have been deleted.');
          return;
        }

        setTitle(data.title || 'Untitled Debate');
        setCreatedAt(data.created_at || '');

        if (data.transcript) {
          try {
            const parsed = JSON.parse(data.transcript);
            setTranscript(Array.isArray(parsed) ? parsed : []);
          } catch {
            setTranscript([]);
          }
        }
      } catch {
        setError('An error occurred while loading the debate.');
      } finally {
        setLoading(false);
      }
    })();
  }, [debateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-light text-gray-900 dark:text-gray-100">{title}</h1>
        {createdAt && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mb-6">
        {transcript.length > 0 ? (
          <div className="space-y-3">
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                  }`}
                >
                  <span className="block text-[10px] font-medium uppercase tracking-wide mb-1 opacity-60">
                    {entry.role === 'user' ? 'you' : 'opponent'}
                  </span>
                  {entry.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
            no transcript available
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="flex-1 text-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          back to dashboard
        </Link>
        <Link
          href="/debate"
          className="flex-1 text-center rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          new debate
        </Link>
      </div>
    </div>
  );
}
