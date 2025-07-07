'use client';

import React from 'react';
import Layout from '@/components/layout/Layout';
import FeedbackForm from '@/components/ui/FeedbackForm';

export default function FeedbackPage() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="pb-5 border-b border-gray-200 dark:border-gray-700 sm:flex sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Feedback</h1>
        </div>
        
        <div className="mt-6 grid grid-cols-1 gap-6">
          <div className="md:grid md:grid-cols-3 md:gap-6">
            <div className="md:col-span-1">
              <div className="px-4 sm:px-0">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">Help Us Improve</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Your feedback is valuable and helps us make DebateAI better for everyone.
                  Whether you&apos;ve found a bug, have a feature suggestion, or just want to share
                  your thoughts, we&apos;d love to hear from you.
                </p>
                <div className="mt-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-white">What happens to your feedback?</h4>
                  <ul className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400 list-disc pl-5">
                    <li>Our team reviews all submissions</li>
                    <li>Bug reports are prioritized for fixing</li>
                    <li>Feature requests influence our roadmap</li>
                    <li>General feedback helps us understand your needs</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="mt-5 md:mt-0 md:col-span-2">
              <FeedbackForm />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
} 