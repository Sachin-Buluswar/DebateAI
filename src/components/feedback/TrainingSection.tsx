'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ClockIcon, AcademicCapIcon, ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

interface Exercise {
  title: string;
  focus: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  instructions: string[];
  example?: string;
  metrics?: string[];
}

interface TrainingPlan {
  exercises: Exercise[];
}

interface TrainingSectionProps {
  trainingPlan: TrainingPlan;
  className?: string;
}

const difficultyColors = {
  beginner: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700'
  },
  intermediate: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700'
  },
  advanced: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700'
  }
};

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = difficultyColors[exercise.difficulty] || difficultyColors.intermediate;

  return (
    <div className={cn(
      "border-2 rounded-lg overflow-hidden transition-all duration-200",
      colors.border,
      isExpanded ? "shadow-lg" : "shadow-sm hover:shadow-md"
    )}>
      <div 
        className={cn(
          "p-4 cursor-pointer",
          colors.bg
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "text-sm font-semibold px-2 py-1 rounded",
                colors.bg,
                colors.text
              )}>
                Exercise {index + 1}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {exercise.duration}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {exercise.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">Focus:</span> {exercise.focus}
            </p>
          </div>
          <button
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden",
        isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          {/* Instructions */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <AcademicCapIcon className="w-4 h-4" />
              Instructions
            </h4>
            <ol className="space-y-2">
              {exercise.instructions.map((instruction, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-500 dark:text-gray-400 min-w-[20px]">
                    {i + 1}.
                  </span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Example */}
          {exercise.example && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Example</h4>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                  {exercise.example}
                </p>
              </div>
            </div>
          )}

          {/* Success Metrics */}
          {exercise.metrics && exercise.metrics.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4" />
                Success Metrics
              </h4>
              <ul className="space-y-1">
                {exercise.metrics.map((metric, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircleIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{metric}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TrainingSection({ trainingPlan, className }: TrainingSectionProps) {
  const [showAllExercises, setShowAllExercises] = useState(false);

  if (!trainingPlan || !trainingPlan.exercises || trainingPlan.exercises.length === 0) {
    return null;
  }

  const exercisesToShow = showAllExercises 
    ? trainingPlan.exercises 
    : trainingPlan.exercises.slice(0, 2);

  return (
    <div className={cn(
      "bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-gray-800 dark:to-gray-900",
      "border-2 border-primary-200 dark:border-primary-800",
      "rounded-xl shadow-lg overflow-hidden",
      className
    )}>
      <div className="px-6 py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AcademicCapIcon className="w-7 h-7" />
          Personalized Training Plan
        </h2>
        <p className="mt-1 text-primary-100">
          Practice exercises tailored to your skill level and improvement areas
        </p>
      </div>

      <div className="p-6">
        {/* Exercises */}
        <div className="space-y-4 mb-6">
          {exercisesToShow.map((exercise, index) => (
            <ExerciseCard key={index} exercise={exercise} index={index} />
          ))}
        </div>

        {/* Show More/Less Button */}
        {trainingPlan.exercises.length > 2 && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAllExercises(!showAllExercises)}
              className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              {showAllExercises ? (
                <>Show Less Exercises</>
              ) : (
                <>Show {trainingPlan.exercises.length - 2} More Exercise{trainingPlan.exercises.length - 2 > 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}