'use client';

import StatsCard from './StatsCard';

interface StatsSectionProps {
  totalSpeeches: number;
  totalDebates: number;
  averageScore: number;
  totalPracticeTime: number;
  loading?: boolean;
  previousStats?: {
    speeches: number;
    debates: number;
    averageScore: number;
    practiceTime: number;
  };
}

export default function StatsSection({
  totalSpeeches,
  totalDebates,
  averageScore,
  totalPracticeTime,
  loading = false,
  previousStats
}: StatsSectionProps) {
  // Calculate percentage changes if previous stats are provided
  const calculateChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.round(Math.abs(change)),
      type: change > 0 ? 'increase' as const : change < 0 ? 'decrease' as const : 'neutral' as const
    };
  };

  // Format practice time from minutes to hours and minutes
  const formatPracticeTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const speechIcon = (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );

  const debateIcon = (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );

  const scoreIcon = (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );

  const timeIcon = (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const stats = [
    {
      title: 'total speeches',
      value: totalSpeeches,
      change: previousStats ? calculateChange(totalSpeeches, previousStats.speeches) : undefined,
      icon: speechIcon,
      description: 'speeches recorded',
      accentColor: '#87A96B'
    },
    {
      title: 'total debates',
      value: totalDebates,
      change: previousStats ? calculateChange(totalDebates, previousStats.debates) : undefined,
      icon: debateIcon,
      description: 'debates completed',
      accentColor: '#70A5D9'
    },
    {
      title: 'average score',
      value: averageScore.toFixed(1),
      change: previousStats ? calculateChange(averageScore, previousStats.averageScore) : undefined,
      icon: scoreIcon,
      description: 'out of 100',
      accentColor: '#D9A570'
    },
    {
      title: 'practice time',
      value: formatPracticeTime(totalPracticeTime),
      change: previousStats ? calculateChange(totalPracticeTime, previousStats.practiceTime) : undefined,
      icon: timeIcon,
      description: 'total time spent',
      accentColor: '#D97070'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatsCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          change={stat.change}
          icon={stat.icon}
          description={stat.description}
          accentColor={stat.accentColor}
          loading={loading}
        />
      ))}
    </div>
  );
}