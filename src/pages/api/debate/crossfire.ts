import { WebSocketServer } from 'ws';
import { ConversationalAIService } from '@/backend/modules/realtimeDebate/conversational-ai';
import { env } from '@/shared/env';
import type { Server, IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: Socket & {
    server: Server & {
      ws?: WebSocketServer;
    };
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.ws) {
    console.log('Socket is already running.');
  } else {
    console.log('Socket is initializing');
    const wss = new WebSocketServer({ noServer: true });
    res.socket.server.ws = wss;

    wss.on('connection', (clientWs) => {
      console.log('Client connected to crossfire proxy');

      const conversationalAI = new ConversationalAIService({
        onMessage: (aiAudioChunk: unknown) => {
          // Forward AI audio to the client
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(Buffer.from(aiAudioChunk as ArrayBuffer));
          }
        },
        onError: (error) => {
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: error.message }));
          }
        },
        onClose: () => {
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.close();
          }
        }
      });

      // Connect to ElevenLabs service
      conversationalAI.connect(env.ELEVENLABS_API_KEY);

      // When the client sends audio, forward it to the AI
      clientWs.on('message', (clientAudioChunk) => {
        conversationalAI.send(clientAudioChunk as ArrayBuffer);
      });

      clientWs.on('close', () => {
        console.log('Client disconnected from crossfire proxy');
        conversationalAI.close();
      });
    });

    res.socket.server.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
  }
  res.end();
} 