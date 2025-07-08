/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed the broad /api rewrite. All new API routes (Socket.IO, STT, etc.)
  // are handled directly within Next.js. If you still need to proxy specific
  // legacy endpoints to an external service, add *targeted* rewrites here
  // (e.g., `/legacy/:path*`).
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
    return config;
  },
  // Ensure strict mode is enabled for React
  reactStrictMode: true,
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
  // Configure API specific settings
  api: {
    bodyParser: {
      sizeLimit: '30mb', // Set the body size limit to 30MB (slightly above 25MB)
    },
  },
};

module.exports = nextConfig; 