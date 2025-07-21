/**
 * Eris Debate - Realtime AI Debate Simulator Module
 * Provides a live, interactive debate environment with realistic turn-based conversation flow.
 * Captures real-time audio input from the user, processes it with OpenAI's GPT-4o Realtime API,
 * and returns the AI's response in both text and audio formats.
 * 
 * Reference: requirements.md section 2.2.3
 * Tech Stack: OpenAI GPT-4o Realtime API, Socket.IO
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { DebateManager } from './DebateManager'; // Import the new manager

// Create Express app and HTTP server
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store active debate managers
const debateManagers = new Map<string, DebateManager>();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // The manager's internal cleanup will be called via its own listener
    debateManagers.delete(socket.id);
  });
});

// All the old logic for 'startDebate' and 'userAudio' is now handled inside DebateManager.
// This file is now just for setting up the server and managing connections.

export default { router: app, server };