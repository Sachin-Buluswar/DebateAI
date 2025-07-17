import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import React from 'react';

// Lazy-loaded route components for code splitting
export const LazyDebatePage = dynamic(() => import('@/app/debate/page'), {
  loading: () => React.createElement(LoadingSpinner, { fullScreen: true, text: "Loading debate..." }),
});

export const LazyDashboardPage = dynamic(() => import('@/app/dashboard/page'), {
  loading: () => React.createElement(LoadingSpinner, { fullScreen: true, text: "Loading dashboard..." }),
});

export const LazyHistoryPage = dynamic(() => import('@/app/history/page'), {
  loading: () => React.createElement(LoadingSpinner, { fullScreen: true, text: "Loading history..." }),
});

export const LazySpeechFeedbackPage = dynamic(() => import('@/app/speech-feedback/page'), {
  loading: () => React.createElement(LoadingSpinner, { fullScreen: true, text: "Loading speech feedback..." }),
});

export const LazySearchPage = dynamic(() => import('@/app/search/page'), {
  loading: () => React.createElement(LoadingSpinner, { fullScreen: true, text: "Loading search..." }),
});

export const LazyAuthPage = dynamic(() => import('@/app/auth/page'), {
  loading: () => React.createElement(LoadingSpinner, { fullScreen: true, text: "Loading authentication..." }),
});