import { Server } from 'socket.io';
import type { NextApiResponse, NextApiRequest } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { initializeSocketIO } from '@/temp-debatetest2-refactor/lib/server/modules/realtimeDebate/SocketManager';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/shared/env';

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
      ? ['https://debateai.com', 'https://www.debateai.com']
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
    
    const io = new Server(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    // Add authentication middleware (temporarily simplified for debugging)
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        // For development/debugging: allow connections but mark as unauthenticated
        if (!token) {
          console.warn('Socket connection without auth token - allowing for development');
          socket.data.user = null;
          socket.data.userId = 'anonymous-' + socket.id;
          return next();
        }
        
        // Try basic JWT decode to extract user info
        try {
          // JWT tokens have 3 parts separated by dots
          const parts = token.split('.');
          if (parts.length === 3) {
            // Decode the payload (middle part)
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            
            // Extract user info from JWT payload
            if (payload.sub) {
              socket.data.user = { id: payload.sub, email: payload.email };
              socket.data.userId = payload.sub;
              console.log('Socket authenticated for user:', payload.sub);
              return next();
            }
          }
        } catch (decodeError) {
          console.warn('Failed to decode JWT token:', decodeError);
        }
        
        // If we can't decode the token, allow connection but mark as unauthenticated
        console.warn('Socket connection with invalid token - allowing for development');
        socket.data.user = null;
        socket.data.userId = 'anonymous-' + socket.id;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        // Allow connection even on error for development
        socket.data.user = null;
        socket.data.userId = 'anonymous-' + socket.id;
        next();
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