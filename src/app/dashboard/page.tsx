'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { Debate, SpeechFeedback } from '@/types';
import DashboardLayout, { Widget } from '@/components/dashboard/DashboardLayout';
import Link from 'next/link';
import {
  MicrophoneIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  FireIcon,
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

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [debateHistory, setDebateHistory] = useState<Debate[]>([]);
  const [speechHistory, setSpeechHistory] = useState<SpeechFeedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [avgScores] = useState({
    overall: 0,
    count: 0,
  });
  const [scoreTrendData] = useState<{ date: string; score: number | null }[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<
    { name: string; speeches: number; debates: number }[]
  >([]);
  const [hoursSpent, setHoursSpent] = useState(0);
  const [highestScore] = useState<number | null>(null);

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
              const speechHours = fetchedSpeeches.reduce(
                (sum, speech) =>
                  sum + (speech.duration_seconds ? speech.duration_seconds / 3600 : 0.25),
                0
              );
              const debateHours = fetchedDebates.length * (5 / 60); // Rough estimate
              setHoursSpent(Math.round((speechHours + debateHours) * 10) / 10);

              // Calculate weekly activity for chart
              const now = new Date();
              const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              const weeklyDataMap = new Map<string, { speeches: number; debates: number }>();
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
              const orderedDays: string[] = [];

              // Initialize map for the last 7 days
              for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                const dayName = days[d.getDay()];
                orderedDays.push(dayName);
                weeklyDataMap.set(dayName, { speeches: 0, debates: 0 });
              }

              fetchedSpeeches.forEach((item) => {
                const d = new Date(item.created_at);
                if (d >= oneWeekAgo) {
                  const dayName = days[d.getDay()];
                  if (weeklyDataMap.has(dayName)) {
                    weeklyDataMap.get(dayName)!.speeches++;
                  }
                }
              });
              fetchedDebates.forEach((item) => {
                const d = new Date(item.created_at);
                if (d >= oneWeekAgo) {
                  const dayName = days[d.getDay()];
                  if (weeklyDataMap.has(dayName)) {
                    weeklyDataMap.get(dayName)!.debates++;
                  }
                }
              });

              const finalWeeklyChartData = orderedDays.map((dayName) => ({
                name: dayName,
                speeches: weeklyDataMap.get(dayName)?.speeches || 0,
                debates: weeklyDataMap.get(dayName)?.debates || 0,
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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                We encountered an error while loading your dashboard. Please try refreshing the
                page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-primary" // Updated class
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

        {/* Practice Stats Widget */}
        <Widget title="Practice Stats" className="col-span-4 md:col-span-2 xl:col-span-1">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-teal-500">{speechHistory.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Speeches</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-500">{debateHistory.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Debates</p>
            </div>
            <div>
              {/* Display Average Score */}
              <p
                className={`text-3xl font-bold ${avgScores.count > 0 ? 'text-yellow-500' : 'text-gray-400'}`}
              >
                {avgScores.count > 0 ? avgScores.overall : '-'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
            </div>
          </div>
        </Widget>

        {/* Learning Progress Widget (Simplified to Overall Score) */}
        <Widget
          title="Overall Learning Progress"
          className="col-span-4 md:col-span-2 xl:col-span-1"
        >
          {avgScores.count > 0 ? (
            <div className="space-y-4">
              <ProgressItem
                label="Average Score"
                value={avgScores.overall}
                color="bg-yellow-500"
                icon={<AcademicCapIcon className="h-5 w-5 text-yellow-700 dark:text-yellow-300" />}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Based on {avgScores.count} analyzed speech{avgScores.count !== 1 ? 'es' : ''}.
              </p>
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              No speech scores available yet. Practice a speech to see your progress!
            </p>
          )}
        </Widget>

        {/* Quick Actions Widget */}
        <Widget title="Quick Actions" className="col-span-4 md:col-span-2 xl:col-span-1">
          <div className="space-y-3">
            <button
              onClick={() => router.push('/speech-feedback')}
              className="btn btn-accent w-full"
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
        <Widget title="Highlights & Milestones" className="col-span-4 md:col-span-2 xl:col-span-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/40 rounded-lg">
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Highest Score
                </p>
                <p
                  className={`text-2xl font-bold ${highestScore !== null ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  {highestScore !== null ? `${highestScore}` : 'N/A'}
                </p>
              </div>
              <FireIcon className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-sky-50 to-cyan-100 dark:from-sky-900/30 dark:to-cyan-900/40 rounded-lg">
              <div>
                <p className="text-sm font-medium text-cyan-800 dark:text-cyan-200">
                  Total Practice Time
                </p>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                  {hoursSpent} hrs
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-cyan-500" />
            </div>
          </div>
        </Widget>

        {/* Score Trend Widget */}
        <Widget title="Overall Score Trend" className="col-span-4 md:col-span-2">
          {scoreTrendData.length > 1 ? (
            <ScoreTrendChart data={scoreTrendData} />
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              Not enough data to show score trend. Complete at least two scored speeches.
            </p>
          )}
        </Widget>

        {/* Weekly Activity Widget */}
        <Widget title="Weekly Activity" className="col-span-4 md:col-span-2">
          <WeeklyActivityChart data={weeklyChartData} />
        </Widget>

        {/* Recent Activity Widget */}
        <Widget title="Recent Activity" className="col-span-4">
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
                          className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mr-3 ${isSpeech ? 'bg-teal-100 dark:bg-teal-700' : 'bg-primary-100 dark:bg-primary-700'}`}
                        >
                          {isSpeech ? (
                            <MicrophoneIcon className="h-5 w-5 text-teal-600 dark:text-teal-300" />
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
const ScoreTrendChart = ({ data }: { data: { date: string; score: number | null }[] }) => {
  return (
    <div className="h-60 md:h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(31, 41, 55, 0.8)', // bg-gray-800 with opacity
              border: '1px solid rgba(75, 85, 99, 0.5)', // border-gray-600
              borderRadius: '0.375rem', // rounded-md
            }}
            itemStyle={{ color: '#d1d5db' }} // text-gray-300
            labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }} // text-gray-50
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#facc15" // yellow-500
            strokeWidth={2}
            dot={{ r: 4, fill: '#facc15' }}
            activeDot={{ r: 6 }}
            connectNulls // Connect line across null data points
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
  data: { name: string; speeches: number; debates: number }[];
}) => {
  return (
    <div className="h-60 md:h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(31, 41, 55, 0.8)',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              borderRadius: '0.375rem',
            }}
            itemStyle={{ color: '#d1d5db' }}
            labelStyle={{ color: '#f9fafb', fontWeight: 'bold' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconSize={10}
            wrapperStyle={{ fontSize: '12px' }}
          />
          <Bar
            dataKey="speeches"
            fill="#14b8a6"
            /* teal-500 */ name="Speeches"
            radius={[4, 4, 0, 0]}
          >
            {/* Optional: Add labels inside bars if needed */}
            {/* <LabelList dataKey="speeches" position="top" fontSize={10} fill="#fff" /> */}
          </Bar>
          <Bar
            dataKey="debates"
            fill="#6366f1"
            /* primary-500 */ name="Debates"
            radius={[4, 4, 0, 0]}
          >
            {/* <LabelList dataKey="debates" position="top" fontSize={10} fill="#fff" /> */}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Simple Progress Bar Component (if needed, or use existing ProgressItem)
interface ProgressItemProps {
  label: string;
  value: number; // Expect value 0-100
  color: string; // Tailwind bg color class e.g., 'bg-blue-500'
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
