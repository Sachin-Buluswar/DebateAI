import { Server } from 'socket.io';
import type { NextApiResponse, NextApiRequest } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { initializeSocketIO } from '@/backend/modules/realtimeDebate/SocketManager';

// This is a type assertion to add the custom 'io' property to the server object.
interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: Server;
    };
  };
}

// The API route handler is minimal. It's only responsible for initializing
// the Socket.IO server once and attaching it to the main HTTP server.
export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    console.log('Socket.IO server is already running.');
    res.end();
    return;
  }

  console.log('Socket.IO server is initializing...');
  try {
    // The path option is crucial for the client to connect correctly.
    const io = new Server(res.socket.server, {
      path: '/api/socketio',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
        methods: ["GET", "POST"]
      }
    });
    res.socket.server.io = io;
    
    // Delegate all connection logic to the SocketManager
    initializeSocketIO(io);
    console.log('Socket.IO server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Socket.IO server:', error);
  }
  
  res.end();
} 