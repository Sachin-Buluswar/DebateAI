'use client';

import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { type DebaterSkillLevel } from '@/types';
import { cn } from '@/lib/cn';

interface SkillLevelSelectorProps {
  value: DebaterSkillLevel;
  onChange: (value: DebaterSkillLevel) => void;
  className?: string;
}

const SKILL_LEVELS = [
  {
    value: 'novice' as const,
    label: 'Novice',
    description: 'First year debater',
    tooltip:
      'New to debate, learning fundamental skills and format. Feedback will focus on basics with extra encouragement.',
    color: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200',
    selectedColor: 'bg-green-200 border-green-500',
    emoji: '🌱',
  },
  {
    value: 'intermediate' as const,
    label: 'Intermediate',
    description: '1-2 years experience',
    tooltip:
      'Comfortable with format, developing strategic thinking. Balanced feedback with both encouragement and critique.',
    color: 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200',
    selectedColor: 'bg-blue-200 border-blue-500',
    emoji: '📈',
  },
  {
    value: 'advanced' as const,
    label: 'Advanced',
    description: 'Varsity level',
    tooltip:
      'Competing at high levels, refining advanced techniques. Direct, strategic feedback with high standards.',
    color: 'bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200',
    selectedColor: 'bg-purple-200 border-purple-500',
    emoji: '🏆',
  },
];

export function SkillLevelSelector({ value, onChange, className }: SkillLevelSelectorProps) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-base font-semibold text-gray-700 dark:text-gray-300">
          Experience Level
        </label>
        <div className="group relative inline-block">
          <InformationCircleIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
          <div className="invisible group-hover:visible absolute z-10 w-48 p-2 mt-1 text-sm text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-300 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            This helps us tailor feedback to your skill level
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SKILL_LEVELS.map((level) => (
          <div key={level.value} className="relative">
            <input
              type="radio"
              id={`skill-${level.value}`}
              name="skillLevel"
              value={level.value}
              checked={value === level.value}
              onChange={(e) => onChange(e.target.value as DebaterSkillLevel)}
              className="sr-only peer"
            />
            <label
              htmlFor={`skill-${level.value}`}
              className={cn(
                'flex flex-col p-4 rounded-lg border-2 cursor-pointer',
                'transition-all duration-200',
                value === level.value
                  ? `${level.selectedColor} ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900`
                  : level.color,
                value === level.value && level.value === 'novice' && 'ring-green-500',
                value === level.value && level.value === 'intermediate' && 'ring-blue-500',
                value === level.value && level.value === 'advanced' && 'ring-purple-500'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium flex items-center gap-2">
                  <span className="text-xl">{level.emoji}</span>
                  {level.label}
                </span>
              </div>
              <span className="text-sm opacity-90">{level.description}</span>
            </label>
            <div className="group absolute top-2 right-2">
              <button
                type="button"
                className="p-1 opacity-60 hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <InformationCircleIcon className="w-3 h-3" />
              </button>
              <div className="invisible group-hover:visible absolute right-0 top-6 z-10 w-64 p-3 text-sm text-gray-700 bg-white dark:bg-gray-800 dark:text-gray-300 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                {level.tooltip}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
