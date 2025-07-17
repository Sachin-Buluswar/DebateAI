'use client';

import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedInput from '@/components/ui/EnhancedInput';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import StatsSection from '@/components/dashboard/StatsSection';
import ParticipantCard from '@/components/debate/ParticipantCard';

function UIDemoContent() {
  const [loading, setLoading] = useState(false);
  const [useEnhancedNavbar, setUseEnhancedNavbar] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const { addToast } = useToast();

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 3000);
  };

  const handleToastDemo = (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: 'Changes saved successfully!',
      error: 'Something went wrong. Please try again.',
      warning: 'Please review your input before continuing.',
      info: 'New updates are available.'
    };
    
    addToast({
      type,
      message: messages[type],
      action: type === 'error' ? {
        label: 'Retry',
        onClick: () => console.log('Retrying...')
      } : undefined
    });
  };

  // Sample data for demos
  const sampleStats = {
    totalSpeeches: 42,
    totalDebates: 15,
    averageScore: 85.5,
    totalPracticeTime: 1230, // minutes
    previousStats: {
      speeches: 38,
      debates: 13,
      averageScore: 82.3,
      practiceTime: 1050
    }
  };

  const sampleParticipants = [
    {
      id: '1',
      name: 'Debate Master AI',
      team: 'PRO' as const,
      role: 'SPEAKER_1',
      isAI: true,
      status: 'speaking' as const
    },
    {
      id: '2',
      name: 'Logic Defender',
      team: 'PRO' as const,
      role: 'SPEAKER_2',
      isAI: true,
      status: 'waiting' as const
    },
    {
      id: '3',
      name: 'Argument Analyst',
      team: 'CON' as const,
      role: 'SPEAKER_1',
      isAI: true,
      status: 'finished' as const
    },
    {
      id: '4',
      name: 'Critical Thinker',
      team: 'CON' as const,
      role: 'SPEAKER_2',
      isAI: true,
      status: 'waiting' as const
    }
  ];

  return (
    <Layout useEnhancedNavbar={useEnhancedNavbar}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-12">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">ui/ux improvements demo</h1>
            <p className="text-gray-600 dark:text-gray-400">test and compare the new enhanced components</p>
          </div>

          {/* Navigation Toggle */}
          <section className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">navigation enhancement</h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useEnhancedNavbar}
                  onChange={(e) => setUseEnhancedNavbar(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">use enhanced navbar (scroll to see collapse effect)</span>
              </label>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              the enhanced navbar collapses smoothly when scrolling down and expands when scrolling up
            </p>
          </section>

          {/* Enhanced Buttons */}
          <section className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">enhanced button system</h2>
            
            <div className="space-y-6">
              {/* Variants */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">variants</h3>
                <div className="flex flex-wrap gap-3">
                  <EnhancedButton variant="primary">primary button</EnhancedButton>
                  <EnhancedButton variant="secondary">secondary button</EnhancedButton>
                  <EnhancedButton variant="ghost">ghost button</EnhancedButton>
                  <EnhancedButton variant="outline">outline button</EnhancedButton>
                  <EnhancedButton variant="danger">danger button</EnhancedButton>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">sizes</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <EnhancedButton size="sm">small button</EnhancedButton>
                  <EnhancedButton size="md">medium button</EnhancedButton>
                  <EnhancedButton size="lg">large button</EnhancedButton>
                </div>
              </div>

              {/* States */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">states</h3>
                <div className="flex flex-wrap gap-3">
                  <EnhancedButton loading loadingText="processing...">loading state</EnhancedButton>
                  <EnhancedButton disabled>disabled button</EnhancedButton>
                  <EnhancedButton onClick={handleLoadingDemo} loading={loading}>
                    {loading ? 'processing' : 'click for loading demo'}
                  </EnhancedButton>
                </div>
              </div>

              {/* With Icons */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">with icons</h3>
                <div className="flex flex-wrap gap-3">
                  <EnhancedButton 
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    }
                  >
                    add item
                  </EnhancedButton>
                  <EnhancedButton 
                    variant="secondary"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    }
                    iconPosition="right"
                  >
                    download
                  </EnhancedButton>
                </div>
              </div>
            </div>
          </section>

          {/* Modern Stats Display */}
          <section className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">modern dashboard stats</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              enhanced stats cards with trend indicators and better visual hierarchy
            </p>
            <StatsSection {...sampleStats} />
          </section>

          {/* Enhanced Participant Cards */}
          <section className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">enhanced participant cards</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              improved debate participant cards with status indicators and hover effects
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sampleParticipants.map((participant) => (
                <ParticipantCard
                  key={participant.id}
                  {...participant}
                  currentSpeakerId={participant.status === 'speaking' ? participant.id : null}
                />
              ))}
            </div>
          </section>

          {/* Enhanced Form Inputs */}
          <section className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">enhanced form inputs</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              floating label inputs with smooth animations and error states
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <EnhancedInput
                label="your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                helperText="enter your full name"
              />
              <EnhancedInput
                label="email address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={formData.email && !formData.email.includes('@') ? 'please enter a valid email' : undefined}
              />
              <div className="md:col-span-2">
                <EnhancedInput
                  label="your message"
                  multiline
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  helperText="share your thoughts with us"
                />
              </div>
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">different sizes</h3>
                <div className="space-y-4">
                  <EnhancedInput label="small input" size="sm" />
                  <EnhancedInput label="medium input" size="md" />
                  <EnhancedInput label="large input" size="lg" />
                </div>
              </div>
            </div>
          </section>

          {/* Toast Notifications */}
          <section className="space-y-4">
            <h2 className="text-xl font-medium text-gray-900 dark:text-white">toast notifications</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              minimalist toast notifications with action buttons
            </p>
            <div className="flex flex-wrap gap-3">
              <EnhancedButton 
                variant="secondary" 
                onClick={() => handleToastDemo('success')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
              >
                success toast
              </EnhancedButton>
              <EnhancedButton 
                variant="secondary" 
                onClick={() => handleToastDemo('error')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
              >
                error toast
              </EnhancedButton>
              <EnhancedButton 
                variant="secondary" 
                onClick={() => handleToastDemo('warning')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                }
              >
                warning toast
              </EnhancedButton>
              <EnhancedButton 
                variant="secondary" 
                onClick={() => handleToastDemo('info')}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              >
                info toast
              </EnhancedButton>
            </div>
          </section>

          {/* Spacing for scroll demo */}
          <div className="h-screen flex items-center justify-center text-gray-400 dark:text-gray-600">
            <p className="text-center">
              scroll up and down to see the navbar collapse effect
              <br />
              <span className="text-sm">(if enhanced navbar is enabled)</span>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function UIDemo() {
  return (
    <ToastProvider>
      <UIDemoContent />
    </ToastProvider>
  );
}