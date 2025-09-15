'use client';

import Layout from '@/components/layout/Layout';

/**
 * Guest Mode Layout
 *
 * This layout allows EVERYONE to access the app immediately.
 * No authentication checks, no redirects, no loading screens.
 *
 * Guest users use localStorage, authenticated users use cloud storage.
 * The authentication state is handled by individual components.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No authentication checks - just render the layout
  // Individual components will handle guest vs authenticated logic
  return <Layout>{children}</Layout>;
}