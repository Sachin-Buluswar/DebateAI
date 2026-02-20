/**
 * Audio utility functions for Eris Debate
 * Now with proper audio duration detection using music-metadata
 */

import * as mm from 'music-metadata';
import * as fs from 'fs';

/**
 * Get audio file duration in seconds using music-metadata
 * @param filePath Path to the audio file
 * @returns Duration in seconds
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // Validate file path
    if (!filePath || typeof filePath !== 'string') {
      // PRODUCTION: Console disabled
      // console.error('[audioUtils] Invalid file path provided');
      return 60; // Return default duration
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // PRODUCTION: Console disabled
      // console.error(`[audioUtils] File not found: ${filePath}`);
      return 60; // Return default duration
    }

    // Parse audio metadata using music-metadata
    const metadata = await mm.parseFile(filePath, {
      duration: true, // Ensure duration is calculated
      skipCovers: true // Skip album art for performance
    });

    // Extract duration from metadata
    const duration = metadata.format.duration;
    
    if (duration && !isNaN(duration) && duration > 0) {
      // PRODUCTION: Console disabled
      // console.log(`[audioUtils] Successfully extracted duration: ${duration} seconds for ${path.basename(filePath)}`);
      return Math.round(duration); // Return rounded duration in seconds
    } else {
      // PRODUCTION: Console disabled
      // console.warn(`[audioUtils] Could not extract valid duration from metadata for ${filePath}`);
      // Try to estimate based on file size and bitrate if available
      if (metadata.format.bitrate) {
        const stats = fs.statSync(filePath);
        const estimatedDuration = (stats.size * 8) / metadata.format.bitrate;
        if (estimatedDuration > 0 && !isNaN(estimatedDuration)) {
          // PRODUCTION: Console disabled
          // console.log(`[audioUtils] Estimated duration from bitrate: ${estimatedDuration} seconds`);
          return Math.round(estimatedDuration);
        }
      }
      return 60; // Fallback to default
    }
  } catch (_error) {
    // PRODUCTION: Console disabled
    // console.error('[audioUtils] Error getting audio duration:', _error);

    // Try fallback method using file stats for rough estimation
    try {
      const stats = fs.statSync(filePath);
      // Rough estimation: assume 128kbps for mp3
      const estimatedDuration = (stats.size * 8) / (128 * 1000); // Convert to seconds
      if (estimatedDuration > 0 && estimatedDuration < 7200) { // Cap at 2 hours
        // PRODUCTION: Console disabled
        // console.log(`[audioUtils] Fallback estimation based on file size: ${estimatedDuration} seconds`);
        return Math.round(estimatedDuration);
      }
    } catch (_fallbackError) {
      // PRODUCTION: Console disabled
      // console.error('[audioUtils] Fallback estimation also failed:', _fallbackError);
    }

    return 60; // Return default duration on all errors
  }
}

/**
 * Get audio duration from buffer
 * @param audioBuffer Audio data buffer
 * @param tempFilePath Temporary file path to write buffer
 * @returns Duration in seconds
 */
export async function getAudioDurationFromBuffer(
  audioBuffer: Buffer, 
  tempFilePath: string
): Promise<number> {
  try {
    // Validate inputs
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      // PRODUCTION: Console disabled
      // console.error('[audioUtils] Invalid audio buffer provided');
      return 60;
    }

    if (!tempFilePath || typeof tempFilePath !== 'string') {
      // PRODUCTION: Console disabled
      // console.error('[audioUtils] Invalid temp file path provided');
      return 60;
    }

    // Write buffer to temp file
    await fs.promises.writeFile(tempFilePath, audioBuffer);
    
    // Get duration using the main function
    const duration = await getAudioDuration(tempFilePath);
    
    // Clean up temp file
    await fs.promises.unlink(tempFilePath).catch((_error) => {
      // PRODUCTION: Console disabled
      // console.warn(`[audioUtils] Could not delete temp file ${tempFilePath}:`, _error);
    });

    return duration;
  } catch (_error) {
    // PRODUCTION: Console disabled
    // console.error('[audioUtils] Error processing audio buffer:', _error);
    
    // Try to estimate from buffer size as last resort
    if (audioBuffer && audioBuffer.length > 0) {
      // Rough estimation assuming 128kbps mp3
      const estimatedDuration = (audioBuffer.length * 8) / (128 * 1000);
      if (estimatedDuration > 0 && estimatedDuration < 7200) {
        // PRODUCTION: Console disabled
        // console.log(`[audioUtils] Buffer size estimation: ${estimatedDuration} seconds`);
        return Math.round(estimatedDuration);
      }
    }
    
    return 60; // Return default duration on error
  }
}

/**
 * Validate audio file format
 * @param filePath Path to the audio file
 * @returns Boolean indicating if the file is a valid audio format
 */
export async function isValidAudioFile(filePath: string): Promise<boolean> {
  try {
    const metadata = await mm.parseFile(filePath, {
      duration: false,
      skipCovers: true
    });
    
    // Check if we have valid audio format information
    const validFormats = ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac', 'flac'];
    const container = metadata.format.container?.toLowerCase();
    
    return container ? validFormats.includes(container) : false;
  } catch (_error) {
    // PRODUCTION: Console disabled
    // console.error('[audioUtils] Error validating audio file:', _error);
    return false;
  }
}

/**
 * Get detailed audio metadata
 * @param filePath Path to the audio file
 * @returns Object containing audio metadata
 */
export async function getAudioMetadata(filePath: string): Promise<{
  duration: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  container?: string;
}> {
  try {
    const metadata = await mm.parseFile(filePath, {
      duration: true,
      skipCovers: true
    });
    
    return {
      duration: Math.round(metadata.format.duration || 60),
      bitrate: metadata.format.bitrate,
      sampleRate: metadata.format.sampleRate,
      channels: metadata.format.numberOfChannels,
      codec: metadata.format.codec,
      container: metadata.format.container
    };
  } catch (_error) {
    // PRODUCTION: Console disabled
    // console.error('[audioUtils] Error getting audio metadata:', _error);
    return { duration: 60 };
  }
}