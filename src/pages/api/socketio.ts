import { Server } from 'socket.io';
import type { NextApiResponse, NextApiRequest } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { initializeSocketIO } from '@/backend/modules/realtimeDebate/SocketManager';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/shared/env';
import { initializeDebateAdapter } from '@/lib/socket/debateSocketAdapter';

// This is a type assertion to add the custom 'io' property to the server object.
interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: Server;
    };
  };
}

// The API route handler for Socket.IO initialization
export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  // Initialize Socket.IO server
  try {
    // Determine allowed origins based on environment
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://debateai.com', 'https://www.debateai.com'])
      : (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001']);
    
    const io = new Server(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    // Add authentication middleware with proper JWT validation
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          // In development, allow anonymous connections for testing
          if (process.env.NODE_ENV === 'development') {
            console.warn('Socket connection without auth token - allowing for development');
            socket.data.user = null;
            socket.data.userId = 'anonymous-' + socket.id;
            return next();
          }
          // In production, reject connections without tokens
          return next(new Error('Authentication token required'));
        }
        
        // Create Supabase client with service role key for JWT validation
        const supabase = createClient(
          env.NEXT_PUBLIC_SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        );
        
        // Verify the JWT token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
          // In development, allow connection but mark as unauthenticated
          if (process.env.NODE_ENV === 'development') {
            console.warn('Invalid auth token - allowing for development:', error?.message);
            socket.data.user = null;
            socket.data.userId = 'anonymous-' + socket.id;
            return next();
          }
          // In production, reject invalid tokens
          return next(new Error('Invalid authentication token'));
        }
        
        // Authentication successful
        socket.data.user = { id: user.id, email: user.email };
        socket.data.userId = user.id;
        console.log('Socket authenticated for user:', user.id);
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        
        // In development, allow connection on error
        if (process.env.NODE_ENV === 'development') {
          socket.data.user = null;
          socket.data.userId = 'anonymous-' + socket.id;
          return next();
        }
        
        // In production, reject on error
        next(new Error('Authentication failed'));
      }
    });
    
    res.socket.server.io = io;
    
    // Delegate all connection logic to the SocketManager
    initializeSocketIO(io);
    // Socket.IO server initialized with authentication
  } catch (error) {
    console.error('Failed to initialize Socket.IO server:', error);
  }
  
  res.end();
} 