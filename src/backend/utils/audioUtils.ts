/**
 * Audio utility functions for DebateAI
 */

/**
 * Get audio file duration in seconds
 * @param filePath Path to the audio file
 * @returns Duration in seconds
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // For now, return a default duration of 60 seconds
    // The ffprobe package is causing webpack issues in production
    // TODO: Implement a different solution for getting audio duration
    console.log(`[audioUtils] Using default duration for ${filePath}`);
    return 60;
  } catch (error) {
    console.error('[audioUtils] Error getting audio duration:', error);
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