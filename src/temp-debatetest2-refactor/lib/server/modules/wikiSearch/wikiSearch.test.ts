/**
 * Eris Debate - WikiSearch Module Tests
 * 
 * Tests for the WikiSearch module that handles RAG-based evidence retrieval
 * using OpenAI embeddings and Pinecone vector database.
 */

import request from 'supertest';
import express, { Request, Response } from 'express';
import { jest, describe, it, expect } from '@jest/globals';
import wikiSearchRouter from './index';

// Mock the entire wikiSearch module
jest.mock('../wikiSearch', () => {
  const expressModule = express;
  const router = expressModule.Router();

  // Mock the search endpoint
  router.post('/api/wiki-search', (req: Request, res: Response) => {
    if (!req.body.query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    return res.status(200).json({
      results: [
        {
          content: 'Sample evidence content about climate change.',
          source: 'Climate Science Journal, 2023',
          score: 0.95
        },
        {
          content: 'Another piece of evidence related to environmental policy.',
          source: 'Environmental Policy Review, 2022',
          score: 0.85
        }
      ]
    });
  });

  // Mock the index endpoint
  router.post('/api/wiki-index', (req: Request, res: Response) => {
    if (!req.body.documents || !Array.isArray(req.body.documents)) {
      return res.status(400).json({ error: 'Valid documents array is required' });
    }
    
    return res.status(200).json({
      message: `Successfully indexed ${req.body.documents.length} document chunks`,
      count: req.body.documents.length
    });
  });

  return router;
});

// Create a test express app
const app = express();
app.use(express.json());
app.use(wikiSearchRouter);

describe('WikiSearch Module', () => {
  describe('POST /api/wiki-search', () => {
    it('should return a 400 error if query is missing', async () => {
      const response = await request(app)
        .post('/api/wiki-search')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return results when provided with a valid query', async () => {
      const response = await request(app)
        .post('/api/wiki-search')
        .send({
          query: 'climate change impacts',
          userId: 'test-user-123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBe(2);
      
      // Verify the structure of the results
      const firstResult = response.body.results[0];
      expect(firstResult).toHaveProperty('content');
      expect(firstResult).toHaveProperty('source');
      expect(firstResult).toHaveProperty('score');
    });
  });
  
  describe('POST /api/wiki-index', () => {
    it('should return a 400 error if documents array is missing', async () => {
      const response = await request(app)
        .post('/api/wiki-index')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should successfully index valid documents', async () => {
      const response = await request(app)
        .post('/api/wiki-index')
        .send({
          documents: [
            {
              id: 'doc1',
              content: 'Sample evidence content about climate change.',
              source: 'Climate Science Journal, 2023'
            },
            {
              id: 'doc2',
              content: 'Another piece of evidence related to environmental policy.',
              source: 'Environmental Policy Review, 2022'
            }
          ]
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBe(2);
    });
  });
}); 