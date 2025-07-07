/**
 * DebateAI - Audio Processing Utility
 * Handles audio file conversion and optimization for storage.
 */

import ffmpeg from 'fluent-ffmpeg';
import { promises as fs, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

// Set up temporary directory for audio processing
const TMP_DIR = '/tmp';

// Default MP3 conversion settings
const DEFAULT_CONVERSION_OPTIONS = {
  bitrate: '64k',       // Standard quality for speech
  sampleRate: 44100,    // Standard audio frequency
  channels: 1,          // Mono for speech is sufficient
  maxDurationMinutes: 65 // Maximum duration in minutes
};

interface ConversionOptions {
  bitrate?: string;
  sampleRate?: number;
  channels?: number;
  maxDurationMinutes?: number;
}

/**
 * Get audio file duration in seconds
 * @param filePath Path to the audio file
 * @returns Duration in seconds
 */
export const getAudioDuration = async (filePath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      
      const durationSeconds = metadata.format.duration || 0;
      resolve(durationSeconds);
    });
  });
};

/**
 * Converts any audio file to MP3 format with optimized settings
 * @param inputFilePath Path to the original audio file
 * @param fileId Optional UUID for the output file (will generate if not provided)
 * @param options Conversion options for audio quality and limitations
 * @returns Object with path to the converted MP3 file and duration in seconds
 */
export const convertToMp3 = async (
  inputFilePath: string, 
  fileId?: string, 
  options: ConversionOptions = {}
): Promise<{ filePath: string; durationSeconds: number }> => {
  // Apply default options if not provided
  const settings = {
    ...DEFAULT_CONVERSION_OPTIONS,
    ...options
  };
  
  // First check the duration to enforce the maximum limit
  const durationSeconds = await getAudioDuration(inputFilePath);
  const maxDurationSeconds = settings.maxDurationMinutes * 60;
  
  if (durationSeconds > maxDurationSeconds) {
    throw new Error(`Audio duration of ${Math.round(durationSeconds / 60)} minutes exceeds the maximum limit of ${settings.maxDurationMinutes} minutes`);
  }
  
  // Generate a unique ID for the file if not provided
  const outputFileId = fileId || uuidv4();
  const outputFilePath = path.join(TMP_DIR, `${outputFileId}.mp3`);
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .outputFormat('mp3')
      .audioBitrate(settings.bitrate)
      .audioChannels(settings.channels)
      .audioFrequency(settings.sampleRate)
      .output(outputFilePath)
      .on('end', () => resolve({ 
        filePath: outputFilePath, 
        durationSeconds 
      }))
      .on('error', (err) => reject(err))
      .run();
  });
};

/**
 * Processes an audio file for storage using streaming to minimize memory usage
 * - Converts to MP3 if not already in MP3 format
 * - Optimizes for storage efficiency
 * - Enforces duration limits
 * - Uses streams instead of loading entire files into memory
 * 
 * @param inputBuffer Buffer containing the audio data
 * @param originalFileName Original file name with extension
 * @param options Conversion options for audio quality and limitations
 * @returns Object containing the processed file path and other metadata
 */
export const processAudioForStorage = async (
  inputBuffer: Buffer, 
  originalFileName: string,
  options: ConversionOptions = {}
): Promise<{
  buffer: Buffer | null, // Will be null when using streams
  filePath: string,
  mimeType: string,
  fileId: string,
  durationSeconds: number,
  stream: () => Readable // Function to get a readable stream of the processed file
}> => {
  // Generate unique ID for the file
  const fileId = uuidv4();
  
  // Determine file extension and if conversion is needed
  const fileExtension = path.extname(originalFileName).toLowerCase();
  const originalFilePath = path.join(TMP_DIR, `${fileId}_original${fileExtension}`);
  
  // Write the buffer to a temporary file using streaming
  const writeStream = createWriteStream(originalFilePath);
  await pipeline(Readable.from(inputBuffer), writeStream);
  
  try {
    // Always convert to MP3 for storage efficiency
    // Even if it's already MP3, we'll optimize it with our settings
    const { filePath: processedFilePath, durationSeconds } = await convertToMp3(originalFilePath, fileId, options);
    
    // Instead of reading the entire file into memory, return a function that creates a readable stream
    return {
      buffer: null, // No buffer, using streams instead
      filePath: processedFilePath,
      mimeType: 'audio/mp3',
      fileId,
      durationSeconds,
      stream: () => createReadStream(processedFilePath)
    };
  } finally {
    // Clean up temporary original file
    await fs.unlink(originalFilePath).catch(err => console.error('Error deleting temp file:', err));
  }
};

/**
 * Gets a readable stream for an audio file
 * @param filePath Path to the audio file
 * @returns Readable stream
 */
export const getAudioStream = (filePath: string): Readable => {
  return createReadStream(filePath);
};

/**
 * Gets a portion of an audio file as a buffer, limiting memory usage
 * @param filePath Path to the audio file
 * @param maxSize Maximum size to read in bytes (defaults to 5MB)
 * @returns Buffer containing the audio data (limited by maxSize)
 */
export const getAudioChunk = async (filePath: string, maxSize: number = 5 * 1024 * 1024): Promise<Buffer> => {
  const stat = await fs.stat(filePath);
  const fileSize = stat.size;
  const size = Math.min(fileSize, maxSize);
  
  // Only read up to maxSize bytes to limit memory usage
  const fd = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(size);
    await fd.read(buffer, 0, size, 0);
    return buffer;
  } finally {
    await fd.close();
  }
};

export default {
  convertToMp3,
  processAudioForStorage,
  getAudioDuration,
  getAudioStream,
  getAudioChunk
}; 