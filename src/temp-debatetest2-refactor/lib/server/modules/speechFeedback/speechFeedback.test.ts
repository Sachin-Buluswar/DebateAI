/**
 * DebateAI - Speech Feedback Module Tests
 * 
 * Tests for the Speech Feedback module that processes user audio
 * and provides feedback on delivery, content, and structure.
 */

import request from 'supertest';
import express from 'express';
import { jest, describe, it, expect } from '@jest/globals';
import path from 'path';
import speechFeedbackRouter from './index';

// Define basic types for mocks
type MockedOpenAI = {
  audio: {
    transcriptions: {
      create: jest.Mock;
    };
  };
  chat: {
    completions: {
      create: jest.Mock;
    };
  };
};

// Mock OpenAI with proper types
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation((): MockedOpenAI => {
      return {
        audio: {
          transcriptions: {
            // @ts-expect-error - Mocking a private method
            create: jest.fn().mockResolvedValue({
              text: 'This is a sample transcription of a speech about climate change.',
              segments: [
                { start: 0, end: 5, text: 'This is a sample transcription' },
                { start: 5, end: 10, text: ' of a speech about climate change.' }
              ]
            })
          }
        },
        chat: {
          completions: {
            // @ts-expect-error - Mocking a private method
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      overall: 'Good structure, work on pacing.',
                      delivery: ['Pacing was a bit fast.'],
                      content: ['Strong opening argument.'],
                      improvements: ['Slow down during key points.']
                    })
                  }
                }
              ]
            })
          }
        }
      };
    })
  };
});

// Mock formidable to handle file uploads
jest.mock('formidable', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        // @ts-expect-error - Mocking a private method
        parse: jest.fn().mockResolvedValue([
          { 
            topic: ['Climate Change'], 
            userId: ['test-user-123'],
            speechType: ['debate']
          },
          { 
            audio: [{ 
              filepath: path.join(__dirname, 'test-audio.mp3'),
              originalFilename: 'speech.mp3',
              mimetype: 'audio/mpeg',
              size: 1024
            }] 
          }
        ])
      };
    })
  };
});

// Mock file system
jest.mock('fs', () => {
  return {
    promises: {
      // @ts-expect-error - Mocking a private method
      readFile: jest.fn().mockResolvedValue(Buffer.from('test audio content')),
      // @ts-expect-error - Mocking a private method
      writeFile: jest.fn().mockResolvedValue(undefined),
      // @ts-expect-error - Mocking a private method
      unlink: jest.fn().mockResolvedValue(undefined)
    }
  };
});

// Mock supabase admin client
jest.mock('../utils/supabaseClient', () => {
  return {
    supabaseAdmin: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      // @ts-expect-error - Mocking a private method
      limit: jest.fn().mockResolvedValue({ error: null, data: [] }),
      // @ts-expect-error - Mocking a private method
      insert: jest.fn().mockResolvedValue({ error: null })
    }
  };
});

// Mock audio processor
jest.mock('../utils/audioProcessor', () => {
  return {
    __esModule: true,
    default: {
      // @ts-expect-error - Mocking a private method
      processAudioForStorage: jest.fn().mockResolvedValue({
        buffer: Buffer.from('processed audio'),
        fileId: 'test-file-id',
        filePath: '/tmp/test-file-id.mp3',
        durationSeconds: 30
      })
    }
  };
});

// Create a test express app
const app = express();
app.use(express.json());
app.use(speechFeedbackRouter);

describe('Speech Feedback Module', () => {
  describe('POST /api/speech-feedback', () => {
    it('should process audio and return feedback', async () => {
      const response = await request(app)
        .post('/api/speech-feedback')
        .field('topic', 'Climate Change')
        .field('userId', 'test-user-123')
        .field('speechType', 'debate')
        .attach('audio', Buffer.from('test audio content'), 'speech.mp3');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('delivery');
      expect(response.body).toHaveProperty('content');
      expect(response.body).toHaveProperty('improvements');
      
      // Verify the structure of the feedback
      expect(response.body.delivery).toBeInstanceOf(Array);
      expect(response.body.content).toBeInstanceOf(Array);
      expect(response.body.improvements).toBeInstanceOf(Array);
    });

    it('should return 400 if no audio file is provided', async () => {
      const response = await request(app)
        .post('/api/speech-feedback')
        .field('topic', 'Climate Change')
        .field('userId', 'test-user-123');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Audio file is required');
    });

    it('should return 400 if no topic is provided', async () => {
      const response = await request(app)
        .post('/api/speech-feedback')
        .field('userId', 'test-user-123')
        .attach('audio', Buffer.from('test audio content'), 'speech.mp3');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Topic is required');
    });
  });
}); 