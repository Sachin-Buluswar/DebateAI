'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import EnhancedInput from '@/components/ui/EnhancedInput';
import AlertMessage from '@/components/ui/AlertMessage';

export default function FeedbackForm() {
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('general');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      setError('Please enter your feedback');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Get user session if available
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      
      const { error: submitError } = await supabase
        .from('user_feedback')
        .insert([
          {
            user_id: userId,
            feedback_type: feedbackType,
            feedback_text: feedback,
            created_at: new Date().toISOString(),
          },
        ]);
      
      if (submitError) {
        console.error('Error submitting feedback:', submitError);
        setError('Failed to submit feedback. Please try again.');
      } else {
        setSuccess(true);
        setFeedback('');
        setFeedbackType('general');
        // Reset success message after 5 seconds
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (err) {
      console.error('Exception submitting feedback:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
          Send Feedback
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
          <p>We value your feedback to improve the DebateAI platform.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-5">
          <div className="mb-4">
            <label htmlFor="feedback-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Feedback Type
            </label>
            <select
              id="feedback-type"
              name="feedback-type"
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value="general">General Feedback</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="content">Content Feedback</option>
            </select>
          </div>
          
          <div className="mb-4">
            <EnhancedInput
              id="feedback"
              label="Your Feedback"
              multiline
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your thoughts, ideas, or report an issue..."
            />
          </div>
          
          {error && (
            <AlertMessage type="error" message={error} className="mb-4" />
          )}
          
          {success && (
            <AlertMessage type="success" message="Thank you for your feedback! We appreciate your help improving DebateAI." className="mb-4" />
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Submitting...</span>
              </div>
            ) : (
              'Submit Feedback'
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 