'use client';

import Link from 'next/link';
import Navbar from '@/components/layout/Navbar';

const features = [
  {
    name: 'ai debate simulator',
    description: 'practice against intelligent ai opponents. get real-time feedback. improve your skills through structured formats.',
    href: '/debate'
  },
  {
    name: 'speech feedback',
    description: 'upload or record your speeches. receive detailed analysis on delivery, pacing, and clarity. refine your technique.',
    href: '/speech-feedback'
  },
  {
    name: 'evidence search',
    description: 'find relevant debate evidence using our vector-based search. access comprehensive wiki articles instantly.',
    href: '/search'
  },
  {
    name: 'secure platform',
    description: 'your data is protected with row-level security. authenticated access. private practice environment.',
    href: '/auth'
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      
      <main>
        {/* Hero section - Minimal with focus on typography */}
        <section className="breathing-room max-w-6xl mx-auto">
          <div className="space-y-8">
            <h1 className="animate-fade-in">
              <span className="block text-gray-900 dark:text-gray-100">
                master the art
              </span>
              <span className="block text-primary-500 mt-2">
                of debate
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl animate-fade-in stagger-1">
              a distraction-free platform for developing your debate skills through ai-powered practice and analysis
            </p>
            
            <div className="animate-fade-in stagger-2 space-x-4">
              <Link href="/debate" className="btn btn-primary">
                begin practice
              </Link>
              <Link href="/about" className="btn btn-ghost">
                learn more →
              </Link>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-8">
          <div className="divider"></div>
        </div>

        {/* Features section - Text-focused, no icons */}
        <section className="breathing-room max-w-6xl mx-auto">
          <div className="space-y-section">
            <div className="space-y-4">
              <h2 className="text-gray-900 dark:text-gray-100">
                everything you need
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
                focused tools for deliberate practice
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mt-16">
              {features.map((feature, index) => (
                <div 
                  key={feature.name} 
                  className={`space-y-4 animate-fade-in stagger-${index + 1}`}
                >
                  <h3 className="text-primary-500">
                    {feature.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                  <Link 
                    href={feature.href} 
                    className="inline-block text-gray-900 dark:text-gray-100 hover:text-primary-500 transition-colors"
                  >
                    explore →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to action - Minimal and centered */}
        <section className="breathing-room max-w-4xl mx-auto text-center">
          <div className="space-y-8">
            <h2 className="text-gray-900 dark:text-gray-100">
              ready to elevate your debate skills?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              join thousands practicing with focused, ai-powered tools
            </p>
            <div className="space-x-4">
              <Link href="/auth" className="btn btn-primary">
                get started
              </Link>
              <Link href="/debate" className="btn btn-ghost">
                try a demo
              </Link>
            </div>
          </div>
        </section>

        {/* Footer - Ultra minimal */}
        <footer className="border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-8 py-12">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-sm text-gray-500 dark:text-gray-500">
                © 2024 debateai. focused practice for better debates.
              </p>
              <nav className="flex space-x-8">
                <Link href="/about" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100">
                  about
                </Link>
                <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100">
                  privacy
                </Link>
                <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100">
                  terms
                </Link>
              </nav>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}