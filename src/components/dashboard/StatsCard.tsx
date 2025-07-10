'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: ReactNode;
  description?: string;
  accentColor?: string;
  loading?: boolean;
}

export default function StatsCard({
  title,
  value,
  change,
  icon,
  description,
  accentColor = '#87A96B',
  loading = false
}: StatsCardProps) {
  const getChangeIndicator = () => {
    if (!change) return null;
    
    const isPositive = change.type === 'increase';
    const changeColor = isPositive ? 'text-[#87A96B]' : change.type === 'decrease' ? 'text-red-500' : 'text-gray-500';
    const changeIcon = isPositive ? '↑' : change.type === 'decrease' ? '↓' : '→';
    
    return (
      <span className={`inline-flex items-center text-sm font-medium ${changeColor}`}>
        <span className="mr-1">{changeIcon}</span>
        {Math.abs(change.value)}%
      </span>
    );
  };

  if (loading) {
    return (
      <div className="relative p-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative p-6 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden group hover:shadow-lg transition-all duration-300">
      {/* Accent line */}
      <div 
        className="absolute top-0 left-0 w-full h-1"
        style={{ backgroundColor: accentColor }}
      />

      {/* Icon */}
      {icon && (
        <div className="absolute top-6 right-6 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors">
          {icon}
        </div>
      )}

      {/* Content */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 lowercase">
          {title}
        </h3>
        
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
          {getChangeIndicator()}
        </div>
        
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {description}
          </p>
        )}
      </div>

      {/* Hover effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300"
        style={{ backgroundColor: accentColor }}
      />
    </div>
  );
}