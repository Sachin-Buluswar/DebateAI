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
      return 60; // Return default duration
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
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
      return Math.round(duration); // Return rounded duration in seconds
    } else {
      // Try to estimate based on file size and bitrate if available
      if (metadata.format.bitrate) {
        const stats = fs.statSync(filePath);
        const estimatedDuration = (stats.size * 8) / metadata.format.bitrate;
        if (estimatedDuration > 0 && !isNaN(estimatedDuration)) {
          return Math.round(estimatedDuration);
        }
      }
      return 60; // Fallback to default
    }
  } catch (_error) {

    // Try fallback method using file stats for rough estimation
    try {
      const stats = fs.statSync(filePath);
      // Rough estimation: assume 128kbps for mp3
      const estimatedDuration = (stats.size * 8) / (128 * 1000); // Convert to seconds
      if (estimatedDuration > 0 && estimatedDuration < 7200) { // Cap at 2 hours
        return Math.round(estimatedDuration);
      }
    } catch (_fallbackError) {
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
      return 60;
    }

    if (!tempFilePath || typeof tempFilePath !== 'string') {
      return 60;
    }

    // Write buffer to temp file
    await fs.promises.writeFile(tempFilePath, audioBuffer);
    
    // Get duration using the main function
    const duration = await getAudioDuration(tempFilePath);
    
    // Clean up temp file
    await fs.promises.unlink(tempFilePath).catch((_error) => {
    });

    return duration;
  } catch (_error) {
    
    // Try to estimate from buffer size as last resort
    if (audioBuffer && audioBuffer.length > 0) {
      // Rough estimation assuming 128kbps mp3
      const estimatedDuration = (audioBuffer.length * 8) / (128 * 1000);
      if (estimatedDuration > 0 && estimatedDuration < 7200) {
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
    return { duration: 60 };
  }
}