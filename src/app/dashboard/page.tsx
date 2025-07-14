'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { Debate, SpeechFeedback } from '@/types';
import DashboardLayout, { Widget } from '@/components/dashboard/DashboardLayout';
import StatsSection from '@/components/dashboard/StatsSection';
import Link from 'next/link';
import {
  MicrophoneIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  FireIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

// Add global error handler to catch unhandled errors
if (typeof window !== 'undefined') {
  window.onerror = function (message, source, lineno, colno, error) {
    console.log('Global error caught:', { message, source, lineno, colno, error });
    return false;
  };
}

// Helper function to extract score from feedback object
const extractScore = (feedback: any): number | null => {
  if (!feedback) return null;
  
  // Check multiple possible locations for scores
  // 1. New format: speakerScore (NSDA scale 25-30)
  if (typeof feedback.speakerScore === 'number') {
    // Convert NSDA scale (25-30) to percentage (0-100)
    return ((feedback.speakerScore - 25) / 5) * 100;
  }
  
  // 2. Legacy format: scores.overall (already in percentage)
  if (feedback.scores?.overall !== undefined && feedback.scores?.overall !== null) {
    return feedback.scores.overall;
  }
  
  // 3. Even older format: score (percentage)
  if (typeof feedback.score === 'number') {
    return feedback.score;
  }
  
  return null;
};

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [debateHistory, setDebateHistory] = useState<Debate[]>([]);
  const [speechHistory, setSpeechHistory] = useState<SpeechFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [avgScores, setAvgScores] = useState({
    overall: 0,
    count: 0,
  });
  const [scoreTrendData, setScoreTrendData] = useState<{ date: string; score: number }[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<
    { name: string; hours: number }[]
  >([]);
  const [hoursSpent, setHoursSpent] = useState(0);
  const [highestScore, setHighestScore] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [chartDateRange, setChartDateRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError('Authentication error. Please try signing in again.');
          setLoading(false);
          return;
        }

        if (!data.session) {
          router.push('/auth');
          return;
        }

        let fetchedDebates: Debate[] = [];
        let fetchedSpeeches: SpeechFeedback[] = [];

        try {
          // Fetch debates
          const { data: debatesData, error: debatesError } = await supabase
            .from('debate_history')
            .select('*')
            .eq('user_id', data.session.user.id)
            .order('created_at', { ascending: false });

          if (debatesError && debatesError.code !== '42P01') {
            setError((prev) =>
              prev ? `${prev}. Failed to load debates.` : 'Failed to load debates.'
            );
          } else {
            fetchedDebates = debatesData || [];
            setDebateHistory(fetchedDebates);
          }
        } catch (debateError) {
          console.error('Exception fetching debates:', debateError);
        }

        try {
          // Fetch speech recordings - SIMPLIFIED FOR DEBUGGING
          const { data: speechData, error: speechError } = await supabase
            .from('speech_feedback')
            .select('id, user_id, created_at, topic, duration_seconds, feedback, audio_url') // Simplified select
            .eq('user_id', data.session.user.id);
          // .order('created_at', { ascending: true }); // Temporarily removed order

          if (speechError && speechError.code !== '42P01') {
            // Log the specific error to console for detailed debugging
            console.error('Supabase speech fetch error:', speechError);
            setError((prev) =>
              prev ? `${prev}. Failed to load speech history.` : 'Failed to load speech history.'
            );
          } else {
            fetchedSpeeches = speechData || [];
            // Sort descending for recent activity list display later
            setSpeechHistory(
              [...fetchedSpeeches].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
            );

            // Calculate stats from speech feedback
            if (fetchedSpeeches.length > 0) {
              // Hours spent estimate
              // For speeches with 60 seconds duration (legacy entries), use more realistic estimate
              const speechHours = fetchedSpeeches.reduce(
                (sum, speech) => {
                  if (speech.duration_seconds === 60) {
                    // Legacy entries - estimate based on typical speech length
                    return sum + (3 / 60); // 3 minutes average
                  }
                  return sum + (speech.duration_seconds ? speech.duration_seconds / 3600 : 3 / 60);
                },
                0
              );
              const debateHours = fetchedDebates.length * (10 / 60); // 10 minutes per debate (more realistic)
              setHoursSpent(Math.round((speechHours + debateHours) * 10) / 10);

              // Calculate average score and highest score
              const speechesWithScores = fetchedSpeeches.filter(s => {
                const score = extractScore(s.feedback);
                return score !== null && typeof score === 'number';
              });
              
              if (speechesWithScores.length > 0) {
                // Extract scores for calculations
                const scores = speechesWithScores.map(s => extractScore(s.feedback) || 0);
                
                // Average score
                const totalScore = scores.reduce((sum, score) => sum + score, 0);
                const average = totalScore / scores.length;
                setAvgScores({
                  overall: Math.round(average * 10) / 10, // Round to 1 decimal place
                  count: speechesWithScores.length
                });
                
                // Highest score
                const maxScore = Math.max(...scores);
                setHighestScore(Math.round(maxScore * 10) / 10);
                
                // Score trend data for chart
                const sortedSpeeches = [...speechesWithScores].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
                
                const trendData = sortedSpeeches.map(speech => ({
                  date: new Date(speech.created_at).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: sortedSpeeches.length > 10 ? '2-digit' : undefined
                  }),
                  score: Math.round((extractScore(speech.feedback) || 0) * 10) / 10
                }));
                
                setScoreTrendData(trendData);
              }

              // Calculate weekly activity for chart (in hours)
              const now = new Date();
              const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              const weeklyDataMap = new Map<string, number>();
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const orderedDays: string[] = [];

              // Initialize map for the last 7 days
              for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                const dayName = days[d.getDay()];
                orderedDays.push(dayName);
                weeklyDataMap.set(dayName, 0);
              }

              // Add speech hours
              fetchedSpeeches.forEach((item) => {
                const d = new Date(item.created_at);
                if (d >= oneWeekAgo) {
                  const dayName = days[d.getDay()];
                  if (weeklyDataMap.has(dayName)) {
                    let hours: number;
                    if (item.duration_seconds === 60) {
                      // Legacy entries - use realistic estimate
                      hours = 3 / 60; // 3 minutes
                    } else {
                      hours = item.duration_seconds ? item.duration_seconds / 3600 : 3 / 60;
                    }
                    weeklyDataMap.set(dayName, weeklyDataMap.get(dayName)! + hours);
                  }
                }
              });
              
              // Add debate hours (10 minutes per debate)
              fetchedDebates.forEach((item) => {
                const d = new Date(item.created_at);
                if (d >= oneWeekAgo) {
                  const dayName = days[d.getDay()];
                  if (weeklyDataMap.has(dayName)) {
                    const hours = 10 / 60; // 10 minutes in hours
                    weeklyDataMap.set(dayName, weeklyDataMap.get(dayName)! + hours);
                  }
                }
              });

              const finalWeeklyChartData = orderedDays.map((dayName) => ({
                name: dayName,
                hours: Math.round(weeklyDataMap.get(dayName)! * 100) / 100, // Round to 2 decimal places
              }));
              setWeeklyChartData(finalWeeklyChartData);
            }
          }
        } catch (speechError) {
          console.error('Exception fetching speech feedback:', speechError);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Add a safeguard against infinite loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.error('Dashboard loading timed out');
        setLoading(false);
        setError(
          'Loading timed out. This could be due to slow database response. Please try refreshing the page or check your network connection.'
        );
      }
    }, 30000); // 30 seconds timeout (increased from 10s)

    return () => clearTimeout(loadingTimeout);
  }, [router]);

  // Function to filter score data based on date range
  const getFilteredScoreData = () => {
    if (!scoreTrendData.length) return [];
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (dateRange) {
      case 'week':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        return scoreTrendData;
    }
    
    // Filter speeches by date and recalculate the displayed data
    const filteredSpeeches = speechHistory
      .filter(s => {
        const score = extractScore(s.feedback);
        return score !== null && new Date(s.created_at) >= cutoffDate;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return filteredSpeeches.map(speech => ({
      date: new Date(speech.created_at).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: filteredSpeeches.length > 10 ? '2-digit' : undefined
      }),
      score: Math.round((extractScore(speech.feedback) || 0) * 10) / 10
    }));
  };

  // Function to get weekly activity data based on chart date range
  const getWeeklyActivityData = () => {
    const now = new Date();
    let daysToShow: number;
    
    switch (chartDateRange) {
      case 'week':
        daysToShow = 7;
        break;
      case 'month':
        daysToShow = 30;
        break;
      case 'year':
        daysToShow = 365;
        break;
      default:
        daysToShow = 7;
    }
    
    const cutoffDate = new Date(now.getTime() - daysToShow * 24 * 60 * 60 * 1000);
    const dataMap = new Map<string, number>();
    
    // Generate date labels based on range
    const dateLabels: string[] = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      let label: string;
      
      if (chartDateRange === 'week') {
        label = d.toLocaleDateString('en-US', { weekday: 'short' });
      } else if (chartDateRange === 'month') {
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        label = d.toLocaleDateString('en-US', { month: 'short' });
      }
      
      // Only show some labels to avoid crowding
      if (chartDateRange === 'month' && i % 5 !== 0) {
        label = '';
      } else if (chartDateRange === 'year' && i % 30 !== 0) {
        label = '';
      }
      
      const key = d.toISOString().split('T')[0]; // Use ISO date as key
      dateLabels.push(label);
      dataMap.set(key, 0);
    }
    
    // Calculate hours for each day
    speechHistory.forEach(speech => {
      const d = new Date(speech.created_at);
      if (d >= cutoffDate) {
        const key = d.toISOString().split('T')[0];
        if (dataMap.has(key)) {
          let hours: number;
          if (speech.duration_seconds === 60) {
            // Legacy entries - use realistic estimate
            hours = 3 / 60; // 3 minutes
          } else {
            hours = speech.duration_seconds ? speech.duration_seconds / 3600 : 3 / 60;
          }
          dataMap.set(key, dataMap.get(key)! + hours);
        }
      }
    });
    
    debateHistory.forEach(debate => {
      const d = new Date(debate.created_at);
      if (d >= cutoffDate) {
        const key = d.toISOString().split('T')[0];
        if (dataMap.has(key)) {
          const hours = 10 / 60; // 10 minutes per debate
          dataMap.set(key, dataMap.get(key)! + hours);
        }
      }
    });
    
    // Convert to array format
    const keys = Array.from(dataMap.keys()).sort();
    return keys.map((key, index) => ({
      name: dateLabels[index],
      hours: Math.round(dataMap.get(key)! * 100) / 100
    })).filter(item => chartDateRange !== 'year' || item.name !== ''); // Only show labeled items for year view
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading your dashboard..." />;
  }

  // Format date for display in recent activity list
  const formatListDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Combine and sort recent activity
  const recentActivity = [...(speechHistory || []), ...(debateHistory || [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3); // Show only the 3 most recent items

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8">
            <div className="text-center">
              <h2 className="mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                We encountered an error while loading your dashboard. Please try refreshing the
                page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      }
    >
      <DashboardLayout>
        {error && (
          <div className="col-span-4 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-500 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  {' '}
                  {/* Updated class */}
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>{' '}
                {/* Updated class */}
              </div>
            </div>
          </div>
        )}

        {/* Modern Stats Section */}
        <div className="col-span-4 animate-fade-in stagger-1">
          <StatsSection
            totalSpeeches={speechHistory.length}
            totalDebates={debateHistory.length}
            averageScore={avgScores.overall}
            totalPracticeTime={Math.round(hoursSpent * 60)} // Convert hours to minutes
            loading={loading}
          />
        </div>


        {/* Quick Actions Widget */}
        <Widget title="Quick Actions" className="col-span-4 md:col-span-2 xl:col-span-1 animate-fade-in stagger-3">
          <div className="space-y-3">
            <button
              onClick={() => router.push('/speech-feedback')}
              className="btn btn-secondary w-full"
            >
              <MicrophoneIcon className="w-5 h-5 mr-2" />
              Record Speech
            </button>
            <button onClick={() => router.push('/debate')} className="btn btn-primary w-full">
              <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
              Start Debate
            </button>
            <button onClick={() => router.push('/search')} className="btn btn-secondary w-full">
              <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
              Search Evidence
            </button>
          </div>
        </Widget>

        {/* Personal Bests & Stats Widget */}
        <Widget title="Highlights & Milestones" className="col-span-4 md:col-span-2 xl:col-span-1 animate-fade-in stagger-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-primary-800 dark:text-primary-200">
                  Highest Score
                </p>
                <p
                  className={`text-2xl font-bold ${highestScore !== null ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  {highestScore !== null ? `${highestScore}` : 'N/A'}
                </p>
              </div>
              <FireIcon className="h-8 w-8 text-primary-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/30 dark:to-gray-700/40 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Total Practice Time
                </p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                  {hoursSpent} hrs
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-gray-500" />
            </div>
          </div>
        </Widget>

        {/* Score Trend Widget */}
        <Widget title="Overall Score Trend" className="col-span-4 md:col-span-2 animate-fade-in stagger-1">
          <div className="space-y-4">
            {/* Date Range Selector */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg shadow-sm" role="group">
                <button
                  onClick={() => setDateRange('week')}
                  className={`px-4 py-2 text-xs font-medium rounded-l-lg border transition-all duration-200 ${
                    dateRange === 'week'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  1W
                </button>
                <button
                  onClick={() => setDateRange('month')}
                  className={`px-4 py-2 text-xs font-medium border-t border-b transition-all duration-200 ${
                    dateRange === 'month'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  1M
                </button>
                <button
                  onClick={() => setDateRange('year')}
                  className={`px-4 py-2 text-xs font-medium border transition-all duration-200 ${
                    dateRange === 'year'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  1Y
                </button>
                <button
                  onClick={() => setDateRange('all')}
                  className={`px-4 py-2 text-xs font-medium rounded-r-lg border transition-all duration-200 ${
                    dateRange === 'all'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
            
            {scoreTrendData.length > 1 ? (
              <ScoreTrendChart data={getFilteredScoreData()} />
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                Not enough data to show score trend. Complete at least two scored speeches.
              </p>
            )}
          </div>
        </Widget>

        {/* Weekly Activity Widget */}
        <Widget title="Weekly Activity" className="col-span-4 md:col-span-2 animate-fade-in stagger-2">
          <div className="space-y-4">
            {/* Date Range Selector */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-lg shadow-sm" role="group">
                <button
                  onClick={() => setChartDateRange('week')}
                  className={`px-4 py-2 text-xs font-medium rounded-l-lg border transition-all duration-200 ${
                    chartDateRange === 'week'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  1W
                </button>
                <button
                  onClick={() => setChartDateRange('month')}
                  className={`px-4 py-2 text-xs font-medium border-t border-b transition-all duration-200 ${
                    chartDateRange === 'month'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  1M
                </button>
                <button
                  onClick={() => setChartDateRange('year')}
                  className={`px-4 py-2 text-xs font-medium rounded-r-lg border transition-all duration-200 ${
                    chartDateRange === 'year'
                      ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  1Y
                </button>
              </div>
            </div>
            
            <WeeklyActivityChart data={getWeeklyActivityData()} />
          </div>
        </Widget>

        {/* Recent Activity Widget */}
        <Widget title="Recent Activity" className="col-span-4 animate-fade-in stagger-3">
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => {
                const isSpeech = 'topic' in item && !('title' in item);
                const title = isSpeech
                  ? (item as SpeechFeedback).topic || 'Speech Feedback'
                  : (item as Debate).title || (item as Debate).topic || 'Debate';
                const href = isSpeech ? `/speech-feedback/${item.id}` : `/debate/${item.id}`;

                return (
                  <Link
                    href={href}
                    key={item.id}
                    className="block p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div
                          className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mr-3 ${isSpeech ? 'bg-primary-100 dark:bg-primary-800' : 'bg-primary-100 dark:bg-primary-800'}`}
                        >
                          {isSpeech ? (
                            <MicrophoneIcon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                          ) : (
                            <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium text-gray-900 dark:text-white truncate"
                            title={title}
                          >
                            {title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatListDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className="ml-4 text-xs px-2.5 py-1 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                        View
                      </span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No recent activity found.
              </p>
            )}
          </div>
          {(speechHistory.length > 0 || debateHistory.length > 0) && (
            <div className="mt-4 text-center">
              <Link
                href="/history"
                className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                View all history
              </Link>
            </div>
          )}
        </Widget>
      </DashboardLayout>
    </ErrorBoundary>
  );
}

// --- Chart Components ---

// Simplified Score Trend Chart
const ScoreTrendChart = ({ data }: { data: { date: string; score: number }[] }) => {
  return (
    <div className="h-60 md:h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 5, bottom: data.length > 10 ? 40 : 5 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#87A96B" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#87A96B" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            fontSize={11} 
            tickLine={false} 
            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            interval={data.length > 20 ? 'preserveStartEnd' : data.length > 10 ? 2 : 0}
            angle={data.length > 10 ? -45 : 0}
            textAnchor={data.length > 10 ? 'end' : 'middle'}
            height={data.length > 10 ? 60 : 30}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            domain={[0, 100]} 
            fontSize={11} 
            tickLine={false} 
            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            tick={{ fill: '#6b7280' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            itemStyle={{ color: '#374151', fontWeight: '500' }}
            labelStyle={{ color: '#111827', fontWeight: 'bold', marginBottom: '4px' }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#87A96B"
            strokeWidth={3}
            dot={{ r: 5, fill: '#87A96B', strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 7, fill: '#6e8a57', stroke: '#ffffff', strokeWidth: 2 }}
            fill="url(#scoreGradient)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Weekly Activity Chart
const WeeklyActivityChart = ({
  data,
}: {
  data: { name: string; hours: number }[];
}) => {
  return (
    <div className="h-60 md:h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#87A96B" stopOpacity={1}/>
              <stop offset="100%" stopColor="#6e8a57" stopOpacity={1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            fontSize={11} 
            tickLine={false} 
            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            fontSize={11} 
            tickLine={false} 
            axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
            tick={{ fill: '#6b7280' }}
            tickFormatter={(value) => value === 0 ? '0' : `${value}h`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            itemStyle={{ color: '#374151', fontWeight: '500' }}
            labelStyle={{ color: '#111827', fontWeight: 'bold', marginBottom: '4px' }}
            formatter={(value: number) => {
              const hours = Math.floor(value);
              const minutes = Math.round((value - hours) * 60);
              if (hours === 0 && minutes === 0) return ['No activity', 'Practice Time'];
              if (hours === 0) return [`${minutes} min`, 'Practice Time'];
              if (minutes === 0) return [`${hours} hr`, 'Practice Time'];
              return [`${hours} hr ${minutes} min`, 'Practice Time'];
            }}
          />
          <Bar
            dataKey="hours"
            fill="url(#barGradient)"
            name="Practice Hours"
            radius={[8, 8, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Simple Progress Bar Component (if needed, or use existing ProgressItem)
interface ProgressItemProps {
  label: string;
  value: number; // Expect value 0-100
  color: string; // Tailwind bg color class e.g., 'bg-primary-500'
  icon: React.ReactNode;
}

function ProgressItem({ label, value, color, icon }: ProgressItemProps) {
  return (
    <div className="flex items-center space-x-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}%</p>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${value}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
