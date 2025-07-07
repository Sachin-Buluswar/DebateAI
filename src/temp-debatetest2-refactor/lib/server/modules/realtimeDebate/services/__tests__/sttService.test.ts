import { transcribeAudio } from '../sttService';
import fetch from 'node-fetch';

// Mock dependencies
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('transcribeAudio', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ELEVENLABS_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should successfully transcribe audio', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ text: 'Hello, this is a test transcription.' }),
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    const testAudio = Buffer.from('fake audio data');
    const result = await transcribeAudio(testAudio);

    expect(result).toBe('Hello, this is a test transcription.');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(callArgs[1]?.method).toBe('POST');
    expect(callArgs[1]?.headers).toMatchObject({
      'xi-api-key': 'test-api-key',
    });
  });

  it('should throw error when API key is missing', async () => {
    delete process.env.ELEVENLABS_API_KEY;

    await expect(transcribeAudio(Buffer.from('audio'))).rejects.toThrow(
      'Speech transcription service unavailable'
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should retry on transient errors', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
    };
    const mockSuccessResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ text: 'Success after retry' }),
    };

    mockFetch
      .mockResolvedValueOnce(mockErrorResponse as any)
      .mockResolvedValueOnce(mockErrorResponse as any)
      .mockResolvedValueOnce(mockSuccessResponse as any);

    const result = await transcribeAudio(Buffer.from('audio'));

    expect(result).toBe('Success after retry');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should fail after max retries', async () => {
    const mockErrorResponse = {
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue('Service Unavailable'),
    };
    mockFetch.mockResolvedValue(mockErrorResponse as any);

    await expect(transcribeAudio(Buffer.from('audio'))).rejects.toThrow(
      'ElevenLabs STT error 503: Service Unavailable'
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should handle invalid response format', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ noTextField: 'invalid' }),
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    await expect(transcribeAudio(Buffer.from('audio'))).rejects.toThrow(
      'Invalid response from STT service'
    );
  });

  it('should handle authentication errors', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized: Invalid API key'),
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    await expect(transcribeAudio(Buffer.from('audio'))).rejects.toThrow(
      'ElevenLabs STT error 401: Unauthorized: Invalid API key'
    );
    expect(mockFetch).toHaveBeenCalledTimes(3); // Still retries
  });
}); 