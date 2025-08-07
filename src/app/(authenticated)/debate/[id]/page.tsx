'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import StreamingAudioPlayer from '@/components/debate/StreamingAudioPlayer';
import CrossfireControls from '@/components/debate/CrossfireControls';
import { Debate } from '@/types';

export default function DebateDetail() {
  const router = useRouter();
  const params = useParams();
  // Use appropriate type casting since Next.js 15 returns params in a specific format
  const debateId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [debate, setDebate] = useState<Debate | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // New states for audio playback and crossfire
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isCrossfireActive, setIsCrossfireActive] = useState(false);

  useEffect(() => {
    // Check if user is logged in and fetch debate data
    const fetchData = async () => {
      // Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      
      // Fetch the debate by ID
      try {
        const { data, error } = await supabase
          .from('debate_history')
          .select('*')
          .eq('id', debateId)
          .single();
        
        if (error) {
          console.error('Error fetching debate:', error);
          setError('Could not load debate details. The debate may have been deleted or you may not have permission to view it.');
          setLoading(false);
          return;
        }
        
        if (!data) {
          setError('Debate not found.');
          setLoading(false);
          return;
        }
        
        // Check if user owns this debate
        if (data.user_id !== session.user.id) {
          setError('You do not have permission to view this debate.');
          setLoading(false);
          return;
        }
        
        setDebate(data);
        
        // Parse transcript if available
        if (data.transcript) {
          try {
            const parsedTranscript = JSON.parse(data.transcript);
            setTranscript(Array.isArray(parsedTranscript) ? parsedTranscript : []);
          } catch (_e) {
            console.error('Error parsing transcript:', _e);
            setTranscript(['Transcript data could not be displayed.']);
          }
        }
      } catch (error) {
        console.error('Error in data fetching:', error);
        setError('An unexpected error occurred while loading the debate details.');
      } finally {
        setLoading(false);
      }
    };
    
    if (debateId) {
      fetchData();
    }
  }, [debateId, router]);
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link href="/dashboard" className="flex-shrink-0 flex items-center">
                  <h2 className="text-primary-700">Eris</h2>
                </Link>
              </div>
              <div className="flex items-center">
                <Link
                  href="/dashboard"
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Dashboard
                </Link>
              </div>
            </div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow sm:rounded-lg p-6">
            <div className="flex items-center text-red-600 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3>Error</h3>
            </div>
            <p className="text-gray-700">{error}</p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // Toggle crossfire mode (for demo purposes)
  const toggleCrossfireMode = () => {
    setIsCrossfireActive(!isCrossfireActive);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/dashboard" className="flex-shrink-0 flex items-center">
                <h2 className="text-primary-700">Eris</h2>
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {debate && (
          <div className="bg-white shadow sm:rounded-lg overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-gray-900">
                  {debate.title}
                </h3>
                <div className="flex items-center">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 mr-2">
                    {debate.type}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(debate.created_at).toLocaleDateString()} {new Date(debate.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-sm text-gray-500">{debate.description}</p>
              </div>
            </div>
            
            {/* Add Crossfire Controls if active */}
            {isCrossfireActive && (
              <div className="px-6 pt-4">
                <CrossfireControls />
              </div>
            )}
            
            {/* Add Audio Player if we have current audio */}
            {currentAudio && (
              <div className="px-6 pt-4">
                <StreamingAudioPlayer
                  audioQueue={[]}
                  setAudioQueue={() => {}}
                />
              </div>
            )}
            
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-gray-800">Debate Transcript</h4>
                
                {/* Demo buttons for audio and crossfire */}
                <div className="flex space-x-2">
                  <button
                    onClick={toggleCrossfireMode}
                    className={`px-3 py-1 text-sm font-medium rounded-md ${
                      isCrossfireActive 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                        : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                    }`}
                  >
                    {isCrossfireActive ? 'End Crossfire' : 'Start Crossfire'}
                  </button>
                  
                  {debate?.audio_url && !currentAudio && (
                    <button
                      onClick={() => setCurrentAudio(debate.audio_url || null)}
                      className="px-3 py-1 text-sm font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      Play Debate Audio
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                {transcript.length > 0 ? (
                  transcript.map((message, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg ${
                        message.startsWith('AI:') ? 'bg-primary-50 ml-12' : 'bg-white mr-12'
                      }`}
                    >
                      {message}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No transcript available for this debate.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex justify-between">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back to Dashboard
                </Link>
                
                <Link
                  href="/debate"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600"
                >
                  Start New Debate
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
} 