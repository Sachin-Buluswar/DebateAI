'use client';

import React from 'react';
import Link from 'next/link';
import Layout from '@/components/layout/Layout';

export default function AboutPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-8">About DebateAI</h1>
          <p className="text-lg mb-6">
            DebateAI is an innovative platform that leverages artificial intelligence to help users improve their debating skills through practice with AI-powered opponents.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Our Mission</h2>
            <p className="text-gray-700 dark:text-gray-300">
              Our mission is to democratize access to high-quality debate training and make it available to everyone,
              regardless of their background or resources. We believe that strong communication and critical thinking
              skills are essential in today&apos;s world, and we&apos;re committed to helping people develop these skills.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Key Features</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>AI Speech Feedback:</strong> Receive detailed analysis on delivery, clarity, and structure.</li>
              <li><strong>Wiki Evidence Search:</strong> Access a powerful search engine to find relevant evidence for your arguments.</li>
              <li><strong>Debate Simulator:</strong> Practice with an AI opponent that adapts to your style and skill level.</li>
            </ul>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">How It Works</h2>
          
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-16 flex justify-center">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-2xl font-bold">
                  1
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Record Your Speech</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Upload an audio recording of your debate speech or practice session. Our platform supports various formats and lengths.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-16 flex justify-center">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-2xl font-bold">
                  2
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">AI Analysis</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Our AI system analyzes your speech for content, structure, delivery, and argumentation techniques, providing comprehensive feedback.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-16 flex justify-center">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-2xl font-bold">
                  3
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Practice & Improve</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Use the insights to improve your future performances. Track your progress over time and see your debate skills evolve.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-10 flex justify-center">
          <Link
            href="/auth"
            className="btn btn-accent !text-white px-6 py-3"
          >
            Get Started Now
          </Link>
        </div>
      </div>
    </Layout>
  );
} 