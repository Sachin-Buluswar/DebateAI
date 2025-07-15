import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  
  // Add webpack configuration to handle Node.js modules
  webpack: (config, { isServer }) => {
    // If client-side (browser)
    if (!isServer) {
      // Ignore these modules when rendering client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        path: false,
        url: false
      };
    }
    
    // Add rule to ignore markdown files in node_modules
    config.module.rules.push({
      test: /\.md$/,
      loader: 'ignore-loader'
    });
    
    // Add alias to ignore problematic ffprobe sync require
    config.resolve.alias = {
      ...config.resolve.alias,
      '@ffprobe-installer/ffprobe': false
    };
    
    return config;
  },
  
  // Ensure strict mode is enabled for React
  reactStrictMode: true,
  
  // Enable SWC minification for better performance
  swcMinify: true,
  
  // Optimize production builds
  productionBrowserSourceMaps: false,
  
  // Enable experimental optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['recharts', 'react-markdown', '@heroicons/react'],
    instrumentationHook: true, // Enable instrumentation for monitoring
  },
  
  // Adding a custom path for the API server
  serverRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003',
  },
  
  // Configure allowed image domains if needed
  images: {
    domains: [
      // Extract domain from Supabase URL
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '') || 'localhost'
    ],
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG || "debateai",
  project: process.env.SENTRY_PROJECT || "javascript-nextjs",

  // Only upload source maps in production
  silent: process.env.NODE_ENV !== 'production',

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
};

// Export the config wrapped with Sentry
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);