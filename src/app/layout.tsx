import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/styles/mobile-fixes.css";
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load providers and error boundary for better initial load
const ThemeProvider = dynamic(() => import('@/components/providers/ThemeProvider').then(mod => ({ default: mod.ThemeProvider })), {
  ssr: true,
});

const PreferencesProvider = dynamic(() => import('@/components/providers/PreferencesProvider').then(mod => ({ default: mod.PreferencesProvider })), {
  ssr: true,
});

const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary'), {
  ssr: true,
});

const ToastProvider = dynamic(() => import('@/components/ui/Toast').then(mod => ({ default: mod.ToastProvider })), {
  ssr: true,
});
import Link from 'next/link';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DebateAI",
  description: "AI-powered debate practice and speech feedback platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.variable} font-sans antialiased h-full w-full transition-colors duration-300`}>
        <Suspense fallback={<LoadingSpinner fullScreen text="Loading..." />}>
          <ThemeProvider>
            <PreferencesProvider>
              <ToastProvider>
                <ErrorBoundary fallback={
                <div className="flex min-h-screen items-center justify-center flex-col p-4">
                  <div className="bg-red-100 text-red-600 p-6 rounded-lg shadow-md max-w-lg">
                    <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
                    <p className="mb-4">We encountered an error while loading this page. Please try refreshing or return to the homepage.</p>
                    <Link href="/" className="inline-block bg-primary-500 text-white px-4 py-2 rounded font-medium hover:bg-primary-600 transition-colors">
                      Return Home
                    </Link>
                  </div>
                </div>
              }>
                {children}
              </ErrorBoundary>
              </ToastProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
