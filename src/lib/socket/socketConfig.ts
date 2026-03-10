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
    hostname === (process.env.NEXT_PUBLIC_APP_DOMAIN || 'erisdebate.com') ||
    hostname === `www.${process.env.NEXT_PUBLIC_APP_DOMAIN || 'erisdebate.com'}` ||
    // Check for Vercel environment variable in window
    (window as Window & { NEXT_PUBLIC_VERCEL?: string }).NEXT_PUBLIC_VERCEL === '1'
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
    return {
      ...baseConfig,
      transports: ['polling'], // ONLY use polling on Vercel
      upgrade: false, // Never try to upgrade to WebSocket
      rememberUpgrade: false,
      forceNew: true, // Force new connection
    };
  }

  // Use WebSocket with polling fallback in development/other environments
  return {
    ...baseConfig,
    transports: ['websocket', 'polling'],
    upgrade: true,
  };
};

// Create socket connection with proper configuration
export const createSocket = async (token?: string): Promise<Socket> => {
  try {
    // Trigger server-side Socket.IO initialization via the simple init endpoint
    // (avoids 400 from engine.io intercepting /api/socketio without EIO params)
    await fetch('/api/socket-init', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
  } catch (_error) {
    // Continue anyway - the server might already be initialized
  }

  const config = getSocketConfig(token);
  const socket = io(config);
  
  // Add connection logging
  socket.on('connect', () => {
  });
  
  socket.on('connect_error', (_error) => {
  });
  
  return socket;
};

// Helper to check if Socket.IO is available
export const checkSocketIOAvailability = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/socket-init', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response.ok;
  } catch (_error) {
    return false;
  }
};