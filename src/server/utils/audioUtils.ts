/**
 * Audio utility functions for Eris Debate
 * Uses file-size estimation for duration calculation.
 */

import * as fs from 'fs';

/**
 * Estimate audio file duration in seconds from file size.
 * Assumes ~128kbps bitrate for spoken word audio.
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    if (!filePath || typeof filePath !== 'string') return 60;
    if (!fs.existsSync(filePath)) return 60;

    const stats = fs.statSync(filePath);
    // Rough estimation: assume 128kbps for compressed audio
    const estimatedDuration = (stats.size * 8) / (128 * 1000);
    if (estimatedDuration > 0 && estimatedDuration < 7200) {
      return Math.round(estimatedDuration);
    }
    return 60;
  } catch {
    return 60;
  }
}
