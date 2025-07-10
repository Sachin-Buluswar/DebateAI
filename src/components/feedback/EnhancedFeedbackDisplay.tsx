'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';

interface FeedbackScores {
  delivery: number;
  arguments: number;
  persuasiveness: number;
  overall: number;
}

interface FeedbackSection {
  title: string;
  items: string[];
  score?: number;
}

interface EnhancedFeedbackDisplayProps {
  scores: FeedbackScores;
  sections: FeedbackSection[];
  recommendations?: string[];
  loading?: boolean;
}

export default function EnhancedFeedbackDisplay({
  scores,
  sections,
  recommendations = [],
  loading = false
}: EnhancedFeedbackDisplayProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#87A96B]';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'from-[#87A96B]/20 to-[#87A96B]/5';
    if (score >= 60) return 'from-yellow-600/20 to-yellow-600/5';
    return 'from-red-600/20 to-red-600/5';
  };

  const CircularProgress = ({ score, label }: { score: number; label: string }) => {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="relative">
        <svg className="w-32 h-32 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              'transition-all duration-1000 ease-out',
              score >= 80 ? 'text-[#87A96B]' : score >= 60 ? 'text-yellow-500' : 'text-red-500'
            )}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold', getScoreColor(score))}>
            {score}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 lowercase">
            {label}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="mt-2 h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Scores Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="flex flex-col items-center">
          <CircularProgress score={scores.overall} label="overall" />
        </div>
        <div className="flex flex-col items-center">
          <CircularProgress score={scores.delivery} label="delivery" />
        </div>
        <div className="flex flex-col items-center">
          <CircularProgress score={scores.arguments} label="arguments" />
        </div>
        <div className="flex flex-col items-center">
          <CircularProgress score={scores.persuasiveness} label="persuasion" />
        </div>
      </div>

      {/* Detailed Feedback Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className={cn(
              'border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300',
              expandedSection === section.title && 'shadow-lg'
            )}
          >
            <button
              onClick={() => setExpandedSection(
                expandedSection === section.title ? null : section.title
              )}
              className="w-full p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white lowercase">
                    {section.title}
                  </h3>
                  {section.score !== undefined && (
                    <span className={cn(
                      'text-sm font-medium px-3 py-1 rounded-full',
                      `bg-gradient-to-r ${getScoreBgColor(section.score)}`,
                      getScoreColor(section.score)
                    )}>
                      {section.score}/100
                    </span>
                  )}
                </div>
                <svg
                  className={cn(
                    'w-5 h-5 text-gray-400 transition-transform duration-300',
                    expandedSection === section.title && 'rotate-180'
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            
            <div className={cn(
              'overflow-hidden transition-all duration-300',
              expandedSection === section.title ? 'max-h-96' : 'max-h-0'
            )}>
              <div className="px-6 pb-6 space-y-3">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex-shrink-0 w-1.5 h-1.5 bg-gray-400 dark:bg-gray-600 rounded-full mt-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 lowercase">
            recommendations for improvement
          </h3>
          <div className="space-y-3">
            {recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="flex items-start gap-3"
              >
                <div className="flex-shrink-0 text-[#87A96B] mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}