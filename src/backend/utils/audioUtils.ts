/**
 * Audio utility functions for DebateAI
 */

import { getAudioDurationInSeconds } from 'get-audio-duration';

/**
 * Get audio file duration in seconds
 * @param filePath Path to the audio file
 * @returns Duration in seconds
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // Try to get actual duration using get-audio-duration package
    const durationSeconds = await getAudioDurationInSeconds(filePath);
    console.log(`[audioUtils] Audio duration for ${filePath}: ${durationSeconds} seconds`);
    return Math.round(durationSeconds);
  } catch (error) {
    console.error('[audioUtils] Error getting audio duration:', error);
    // Return a default duration of 60 seconds if we can't read the file
    // This ensures backwards compatibility
    return 60;
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
  const fs = await import('fs/promises');
  
  try {
    // Write buffer to temp file
    await fs.writeFile(tempFilePath, audioBuffer);
    
    // Get duration
    const duration = await getAudioDuration(tempFilePath);
    
    // Clean up temp file
    await fs.unlink(tempFilePath).catch(() => {
      // Ignore errors if file doesn't exist
    });
    
    return duration;
  } catch (error) {
    console.error('[audioUtils] Error processing audio buffer:', error);
    return 60; // Return default duration on error
  }
}