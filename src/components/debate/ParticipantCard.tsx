'use client';

import { useState } from 'react';

interface ParticipantCardProps {
  id: string;
  name: string;
  team: 'PRO' | 'CON';
  role: string;
  isAI?: boolean;
  status: 'speaking' | 'waiting' | 'finished';
  currentSpeakerId: string | null;
}

export default function ParticipantCard({
  id,
  name,
  team,
  role,
  isAI = true,
  status,
  currentSpeakerId
}: ParticipantCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isSpeaking = id === currentSpeakerId;
  
  // Determine status based on whether participant is currently speaking
  const displayStatus = isSpeaking ? 'speaking' : status;
  
  const teamColors = {
    PRO: {
      primary: '#87A96B', // Sage green
      light: '#a5c088',
      dark: '#6a8954',
      bg: 'bg-[#87A96B]/10',
      border: 'border-[#87A96B]',
      text: 'text-[#6a8954] dark:text-[#a5c088]'
    },
    CON: {
      primary: '#d97070',
      light: '#e09090',
      dark: '#b85555',
      bg: 'bg-red-500/10',
      border: 'border-red-400',
      text: 'text-red-600 dark:text-red-400'
    }
  };

  const statusConfig = {
    speaking: {
      text: 'speaking',
      bgClass: 'bg-[#87A96B] dark:bg-[#87A96B]',
      textClass: 'text-white',
      animate: true
    },
    waiting: {
      text: 'waiting',
      bgClass: 'bg-gray-200 dark:bg-gray-700',
      textClass: 'text-gray-600 dark:text-gray-300',
      animate: false
    },
    finished: {
      text: 'finished',
      bgClass: 'bg-gray-100 dark:bg-gray-800',
      textClass: 'text-gray-500 dark:text-gray-400',
      animate: false
    }
  };

  const currentStatus = statusConfig[displayStatus];
  const teamConfig = teamColors[team];

  return (
    <div
      className={`
        relative p-6 border transition-all duration-300 overflow-hidden
        ${isSpeaking 
          ? `border-[#87A96B] shadow-lg ${teamConfig.bg}` 
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        }
        ${isHovered && !isSpeaking ? 'border-gray-300 dark:border-gray-600 shadow-md' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Speaking animation overlay */}
      {isSpeaking && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#87A96B]/5 to-transparent animate-pulse" />
      )}

      {/* Top row: Status and Type badges */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-2">
          {/* Status badge */}
          <span className={`
            inline-flex items-center px-2 py-1 text-xs font-medium
            ${currentStatus.bgClass} ${currentStatus.textClass}
            ${currentStatus.animate ? 'animate-pulse' : ''}
          `}>
            {currentStatus.animate && (
              <span className="flex space-x-1 mr-2">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="w-1 h-2 bg-current rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            )}
            {currentStatus.text}
          </span>

          {/* AI/Human badge */}
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {isAI ? 'ai' : 'human'}
          </span>
        </div>

        {/* Team indicator */}
        <span className={`text-xs font-bold uppercase ${teamConfig.text}`}>
          {team}
        </span>
      </div>

      {/* Participant info */}
      <div className="space-y-1">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          {name}
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 lowercase">
          {role.replace(/_/g, ' ')}
        </p>
      </div>

      {/* Hover state - additional info */}
      <div className={`
        absolute bottom-0 left-0 right-0 p-4 
        bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent
        transform transition-transform duration-300
        ${isHovered ? 'translate-y-0' : 'translate-y-full'}
      `}>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {isAI ? 'powered by gpt-4' : 'debate participant'}
        </p>
      </div>
    </div>
  );
}