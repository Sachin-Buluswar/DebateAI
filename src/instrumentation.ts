/**
 * Next.js instrumentation file
 * This runs before any other code when the Next.js server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry for server-side
    await import('../sentry.server.config');
    
    // Import monitoring initialization
    const { initializeMonitoring } = await import('./lib/monitoring');
    
    // Initialize monitoring systems
    initializeMonitoring();
    
    // Log server startup
    console.log('DebateAI server instrumentation initialized');
    
    // Register shutdown handlers
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      const { shutdownMonitoring } = await import('./lib/monitoring');
      await shutdownMonitoring();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      const { shutdownMonitoring } = await import('./lib/monitoring');
      await shutdownMonitoring();
      process.exit(0);
    });
  }
  
  if (process.env.NEXT_RUNTIME === 'edge') {
    // Initialize Sentry for edge runtime
    await import('../sentry.edge.config');
  }
}