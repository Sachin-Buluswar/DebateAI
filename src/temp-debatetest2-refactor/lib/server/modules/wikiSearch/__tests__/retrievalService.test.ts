import { searchVectorStore } from '../retrievalService';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('searchVectorStore', () => {
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = {
      vectorStores: {
        query: jest.fn(),
      },
      beta: {
        assistants: {
          create: jest.fn(),
          delete: jest.fn(),
        },
        threads: {
          create: jest.fn(),
          delete: jest.fn(),
          messages: {
            create: jest.fn(),
            list: jest.fn(),
          },
          runs: {
            create: jest.fn(),
            retrieve: jest.fn(),
            submitToolOutputs: jest.fn(),
          },
        },
      },
    };
  });

  describe('direct vectorStores.query path', () => {
    it('should successfully query vector store', async () => {
      const mockResults = {
        data: [
          { text: 'Result 1', file_id: 'file1', score: 0.9 },
          { text: 'Result 2', document_id: 'doc2', score: 0.8 },
        ],
      };
      mockOpenAI.vectorStores.query.mockResolvedValue(mockResults);

      const results = await searchVectorStore(
        mockOpenAI as unknown as OpenAI,
        'test-vector-store-id',
        'test query',
        5
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        content: 'Result 1',
        source: 'file1',
        score: 0.9,
      });
      expect(mockOpenAI.vectorStores.query).toHaveBeenCalledWith('test-vector-store-id', {
        query: 'test query',
        top_k: 5,
      });
    });

    it('should retry on transient errors', async () => {
      mockOpenAI.vectorStores.query
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ data: [{ text: 'Success', score: 0.95 }] });

      const results = await searchVectorStore(
        mockOpenAI as unknown as OpenAI,
        'test-store',
        'query',
        3
      );

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Success');
      expect(mockOpenAI.vectorStores.query).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockOpenAI.vectorStores.query.mockRejectedValue(new Error('Persistent error'));

      await expect(
        searchVectorStore(mockOpenAI as unknown as OpenAI, 'store', 'query', 5)
      ).rejects.toThrow('Persistent error');

      expect(mockOpenAI.vectorStores.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('assistant-based fallback', () => {
    beforeEach(() => {
      // Remove vectorStores.query to trigger fallback
      delete mockOpenAI.vectorStores;
    });

    it('should fall back to assistant search when vectorStores.query unavailable', async () => {
      const mockAssistant = { id: 'asst_123' };
      const mockThread = { id: 'thread_456' };
      const mockRun = { id: 'run_789', status: 'completed' };
      const mockMessages = {
        data: [
          {
            role: 'assistant',
            content: [{
              type: 'text',
              text: {
                value: 'Fallback result',
                annotations: [
                  { type: 'file_citation', file_citation: { file_id: 'file_fallback' } }
                ],
              },
            }],
          },
        ],
      };

      mockOpenAI.beta.assistants.create.mockResolvedValue(mockAssistant);
      mockOpenAI.beta.threads.create.mockResolvedValue(mockThread);
      mockOpenAI.beta.threads.runs.create.mockResolvedValue(mockRun);
      mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue(mockRun);
      mockOpenAI.beta.threads.messages.list.mockResolvedValue(mockMessages);

      const results = await searchVectorStore(
        mockOpenAI as unknown as OpenAI,
        'store',
        'query',
        5
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        content: 'Fallback result',
        source: 'file_fallback',
      });
      expect(mockOpenAI.beta.assistants.delete).toHaveBeenCalledWith('asst_123');
      expect(mockOpenAI.beta.threads.delete).toHaveBeenCalledWith('thread_456');
    });
  });
}); 