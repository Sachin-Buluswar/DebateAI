'use client';

import { useState } from 'react';
import { LightBulbIcon, ChatBubbleOvalLeftEllipsisIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface AdviceResponse {
  advice: string;
  keyPoints?: string[];
  suggestedArguments?: string[];
}

interface WikiSearchPanelProps {
  debateTopic: string;
  userPerspective: 'PRO' | 'CON';
  isVisible: boolean;
  onToggle: () => void;
  currentSpeaker?: string;
  debateHistory?: string[];
}

export function WikiSearchPanel({ 
  debateTopic, 
  userPerspective, 
  isVisible, 
  onToggle,
  currentSpeaker,
  debateHistory = []
}: WikiSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [adviceType, setAdviceType] = useState<'strategy' | 'counterargument' | 'rebuttal' | 'general'>('strategy');
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetAdvice = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/debate-advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          debateTopic,
          userPerspective,
          adviceType,
          currentSpeaker,
          debateHistory,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAdvice(data.advice);
      } else {
        setError(data.error || 'Failed to get advice');
      }
    } catch (err) {
      setError('Network error while getting advice');
      console.error('Advice error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGetAdvice();
    }
  };

  const getAdviceTypeIcon = (type: string) => {
    switch (type) {
      case 'strategy':
        return <LightBulbIcon className="w-4 h-4" />;
      case 'counterargument':
        return <ShieldCheckIcon className="w-4 h-4" />;
      case 'rebuttal':
        return <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />;
      default:
        return <LightBulbIcon className="w-4 h-4" />;
    }
  };

  const getAdviceTypeLabel = (type: string) => {
    switch (type) {
      case 'strategy':
        return 'Strategic Advice';
      case 'counterargument':
        return 'Counter-Arguments';
      case 'rebuttal':
        return 'Rebuttal Help';
      case 'general':
        return 'General Advice';
      default:
        return type;
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-2 lg:right-4 top-1/2 transform -translate-y-1/2 bg-primary-500 text-white p-2 lg:p-3 rounded-l-lg shadow-lg hover:bg-primary-600 transition-colors z-50"
        title="Open Advice Panel"
      >
        <LightBulbIcon className="w-5 h-5 lg:w-6 lg:h-6" />
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-40 flex flex-col">
      {/* Header */}
      <div className="bg-primary-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <LightBulbIcon className="w-5 h-5" />
          <h3 className="font-semibold">Advice Panel</h3>
        </div>
        <button
          onClick={onToggle}
          className="text-primary-100 hover:text-white transition-colors"
          title="Close Advice Panel"
        >
          ✕
        </button>
      </div>

      {/* Advice Controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Advice Type
          </label>
          <select
            value={adviceType}
            onChange={(e) => setAdviceType(e.target.value as 'strategy' | 'counterargument' | 'rebuttal' | 'general')}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="strategy">Strategic Advice</option>
            <option value="counterargument">Counter-Arguments</option>
            <option value="rebuttal">Rebuttal Help</option>
            <option value="general">General Advice</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Ask for Advice
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="What do you need help with?"
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleGetAdvice}
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '...' : 'Get Advice'}
            </button>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Topic: <span className="font-medium">{debateTopic}</span>
          {currentSpeaker && (
            <span className="ml-2">• Speaker: <span className="font-medium">{currentSpeaker}</span></span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Getting advice...</span>
          </div>
        )}

        {advice && !isLoading && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              {getAdviceTypeIcon(adviceType)}
              <span>{getAdviceTypeLabel(adviceType)}</span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {advice.advice}
              </p>
            </div>

            {advice.keyPoints && advice.keyPoints.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Key Points:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {advice.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300 text-sm">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {advice.suggestedArguments && advice.suggestedArguments.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Suggested Arguments:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {advice.suggestedArguments.map((arg, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300 text-sm">
                      {arg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && !advice && query && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <LightBulbIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Click "Get Advice" to receive strategic guidance.</p>
          </div>
        )}

        {!query && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <LightBulbIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-2">Get Strategic Advice</p>
            <p className="text-sm">Ask for help with arguments, counter-arguments, rebuttals, or general debate strategy.</p>
          </div>
        )}
      </div>
    </div>
  );
}