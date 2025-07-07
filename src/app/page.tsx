'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SparklesIcon, BookOpenIcon, MicrophoneIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Navbar from '@/components/layout/Navbar';

const features = [
  {
    name: 'AI Debate Simulator',
    description: 'Practice against intelligent AI opponents in structured debate formats. Get real-time feedback and improve your skills.',
    icon: MicrophoneIcon,
    href: '/debate'
  },
  {
    name: 'AI Speech Feedback',
    description: 'Upload or record your speeches and receive detailed analysis on delivery, pacing, and argument clarity.',
    icon: SparklesIcon,
    href: '/speech-feedback'
  },
  {
    name: 'Wiki Evidence Search',
    description: 'Find relevant debate evidence and articles using our powerful RAG-based search engine, powered by vector search.',
    icon: BookOpenIcon,
    href: '/search'
  },
  {
    name: 'Secure & Private',
    description: 'Your data is protected. We use Supabase for secure authentication and storage, with row-level security.',
    icon: ShieldCheckIcon,
    href: '/auth'
  },
]

export default function HomePage() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Navbar />
      <main>
        {/* Hero section */}
        <div className="pt-8 overflow-hidden sm:pt-12 lg:pt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
                <h1>
                  <span className="mt-1 block text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl">
                    <span className="block text-gray-900 dark:text-white">The Future of Debate</span>
                    <span className="block text-primary-600 dark:text-primary-400">is Here</span>
                  </span>
                </h1>
                <p className="mt-3 text-base text-gray-500 dark:text-gray-300 sm:mt-5 sm:text-xl lg:text-lg xl:text-xl">
                  Welcome to DebateAI, the AI-powered platform that transforms debate training with real-time feedback, evidence search, and interactive simulations.
                </p>
                <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:mx-0 lg:text-left">
                  <Link href="/debate" className="btn btn-primary btn-lg">
                    Start Debating
                  </Link>
                </div>
              </div>
              <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
                <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                  <Image className="w-full" src="/file.svg" alt="" width={500} height={500} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature section */}
        <div className="py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-md px-4 text-center sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
            <h2 className="text-base font-semibold uppercase tracking-wider text-primary-600">Develop Your Skills</h2>
            <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight sm:text-4xl">
              Everything you need to become a master debater
            </p>
            <div className="mt-12">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((feature) => (
                  <div key={feature.name} className="pt-6">
                    <div className="flow-root rounded-lg bg-white dark:bg-gray-800 px-6 pb-8 shadow-lg">
                      <div className="-mt-6">
                        <div>
                          <span className="inline-flex items-center justify-center rounded-md bg-primary-500 p-3 shadow-lg">
                            <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                          </span>
                        </div>
                        <h3 className="mt-8 text-lg font-medium text-gray-900 dark:text-white tracking-tight">{feature.name}</h3>
                        <p className="mt-5 text-base text-gray-500 dark:text-gray-400">{feature.description}</p>
                        <Link href={feature.href} className="mt-6 inline-block text-primary-600 dark:text-primary-400 hover:underline">
                          Learn More &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
