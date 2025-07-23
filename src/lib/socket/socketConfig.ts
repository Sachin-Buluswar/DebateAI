import { io, Socket } from 'socket.io-client';

// Detect if running on Vercel - check multiple indicators
export const isVercel = () => {
  if (typeof window === 'undefined') {
    return process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL === '1';
  }
  
  // Client-side detection
  const hostname = window.location.hostname;
  return (
    hostname.includes('vercel.app') || 
    hostname.includes('vercel.sh') ||
    hostname === 'atlasdebate.com' ||
    hostname === 'www.atlasdebate.com' ||
    // Check for Vercel environment variable in window
    (window as any).NEXT_PUBLIC_VERCEL === '1'
  );
};

// Socket.IO configuration optimized for different environments
export const getSocketConfig = (token?: string) => {
  const baseConfig = {
    path: '/api/socketio',
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  };

  // Check if we're on Vercel or production domain
  const isVercelDeployment = isVercel();
  
  if (isVercelDeployment) {
    console.log('Vercel deployment detected - forcing polling-only transport');
    return {
      ...baseConfig,
      transports: ['polling'], // ONLY use polling on Vercel
      upgrade: false, // Never try to upgrade to WebSocket
      rememberUpgrade: false,
      forceNew: true, // Force new connection
    };
  }

  // Use WebSocket with polling fallback in development/other environments
  console.log('Non-Vercel environment - using WebSocket with polling fallback');
  return {
    ...baseConfig,
    transports: ['websocket', 'polling'],
    upgrade: true,
  };
};

// Create socket connection with proper configuration
export const createSocket = async (token?: string): Promise<Socket> => {
  try {
    // Initialize the socket server first
    const initResponse = await fetch('/api/socketio', {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      }
    });
    
    if (!initResponse.ok) {
      console.warn('Socket.IO initialization returned non-OK status:', initResponse.status);
    }
  } catch (error) {
    console.error('Failed to initialize Socket.IO server:', error);
    // Continue anyway - the server might already be initialized
  }
  
  const config = getSocketConfig(token);
  console.log('Creating socket with config:', {
    transports: config.transports,
    upgrade: config.upgrade,
    path: config.path
  });
  
  const socket = io(config);
  
  // Add connection logging
  socket.on('connect', () => {
    console.log('Socket connected successfully via:', socket.io.engine.transport.name);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });
  
  return socket;
};

// Helper to check if Socket.IO is available
export const checkSocketIOAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/socketio', {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Socket.IO availability check failed:', error);
    return false;
  }
};