/**
 * Score Standardization Utilities
 * Centralizes all score conversion logic and ensures consistency
 * across the application.
 */

/**
 * Score format types that exist in the system
 */
export enum ScoreFormat {
  NSDA = 'nsda',           // 25-30 point scale
  PERCENTAGE = 'percentage', // 0-100 scale
  TEN_POINT = 'ten_point',  // 1-10 scale
  JSON_OBJECT = 'json_object', // Legacy format with nested scores
}

/**
 * Interface for standardized score data
 */
export interface StandardizedScore {
  percentage: number;       // Always 0-100
  nsda: number;           // Always 25-30
  displayValue: string;    // Human-readable format
  originalFormat: ScoreFormat;
  originalValue: any;
}

/**
 * Convert NSDA score (25-30) to percentage (0-100)
 */
export function nsdaToPercentage(score: number): number {
  if (score < 25 || score > 30) {
    // PRODUCTION: Console disabled
    // console.warn(`[scoreStandardization] NSDA score ${score} out of valid range (25-30)`);
    score = Math.max(25, Math.min(30, score)); // Clamp to valid range
  }
  return Math.round(((score - 25) / 5) * 100);
}

/**
 * Convert percentage (0-100) to NSDA score (25-30)
 * Uses half-point scoring (rounds to nearest 0.5)
 */
export function percentageToNSDA(percentage: number): number {
  if (percentage < 0 || percentage > 100) {
    // PRODUCTION: Console disabled
    // console.warn(`[scoreStandardization] Percentage ${percentage} out of valid range (0-100)`);
    percentage = Math.max(0, Math.min(100, percentage)); // Clamp to valid range
  }
  const nsdaScore = 25 + (percentage / 100) * 5;
  return Math.round(nsdaScore * 2) / 2; // Round to nearest 0.5 (half-point scoring)
}

/**
 * Convert 10-point scale to percentage
 */
export function tenPointToPercentage(score: number): number {
  if (score < 0 || score > 10) {
    // PRODUCTION: Console disabled
    // console.warn(`[scoreStandardization] Ten-point score ${score} out of valid range (0-10)`);
    score = Math.max(0, Math.min(10, score)); // Clamp to valid range
  }
  return Math.round((score / 10) * 100);
}

/**
 * Convert percentage to 10-point scale
 */
export function percentageToTenPoint(percentage: number): number {
  if (percentage < 0 || percentage > 100) {
    // PRODUCTION: Console disabled
    // console.warn(`[scoreStandardization] Percentage ${percentage} out of valid range (0-100)`);
    percentage = Math.max(0, Math.min(100, percentage)); // Clamp to valid range
  }
  return Math.round((percentage / 100) * 10 * 10) / 10; // Round to 1 decimal
}

/**
 * Detect score format based on value and context
 */
export function detectScoreFormat(score: any): ScoreFormat {
  // Check if it's a JSON object (legacy format)
  if (typeof score === 'object' && score !== null && !Array.isArray(score)) {
    return ScoreFormat.JSON_OBJECT;
  }
  
  // Check if it's a number
  if (typeof score === 'number') {
    if (score >= 25 && score <= 30) {
      return ScoreFormat.NSDA;
    } else if (score >= 0 && score <= 10) {
      return ScoreFormat.TEN_POINT;
    } else if (score >= 0 && score <= 100) {
      return ScoreFormat.PERCENTAGE;
    }
  }
  
  // Try to parse string as number
  if (typeof score === 'string') {
    const parsed = parseFloat(score);
    if (!isNaN(parsed)) {
      return detectScoreFormat(parsed);
    }
  }
  
  // PRODUCTION: Console disabled
  
  // console.warn(`[scoreStandardization] Unable to detect format for score:`, score);
  return ScoreFormat.PERCENTAGE; // Default fallback
}

/**
 * Extract score from legacy JSON object format
 */
export function extractFromJsonObject(scoreObj: any): number | null {
  if (!scoreObj || typeof scoreObj !== 'object') {
    return null;
  }
  
  // Try different possible keys in order of preference
  const possibleKeys = ['overall', 'total', 'average', 'score', 'content'];
  
  for (const key of possibleKeys) {
    if (scoreObj[key] !== undefined && scoreObj[key] !== null) {
      const value = parseFloat(scoreObj[key]);
      if (!isNaN(value)) {
        return value;
      }
    }
  }
  
  // If no direct score found, try to calculate average from components
  const components = ['content', 'delivery', 'argumentation'];
  const validScores = components
    .map(key => parseFloat(scoreObj[key]))
    .filter(val => !isNaN(val));
  
  if (validScores.length > 0) {
    return validScores.reduce((sum, val) => sum + val, 0) / validScores.length;
  }
  
  return null;
}

/**
 * Standardize any score format to percentage
 */
export function standardizeToPercentage(score: any): number | null {
  if (score === null || score === undefined) {
    return null;
  }
  
  const format = detectScoreFormat(score);
  
  switch (format) {
    case ScoreFormat.NSDA:
      return nsdaToPercentage(parseFloat(score));
      
    case ScoreFormat.PERCENTAGE:
      return Math.round(parseFloat(score));
      
    case ScoreFormat.TEN_POINT:
      return tenPointToPercentage(parseFloat(score));
      
    case ScoreFormat.JSON_OBJECT:
      const extracted = extractFromJsonObject(score);
      if (extracted !== null) {
        // Recursively standardize the extracted value
        return standardizeToPercentage(extracted);
      }
      return null;
      
    default:
      // PRODUCTION: Console disabled
      // console.warn(`[scoreStandardization] Unknown format, treating as percentage:`, score);
      const parsed = parseFloat(score);
      return isNaN(parsed) ? null : Math.round(parsed);
  }
}

/**
 * Get comprehensive standardized score object
 */
export function getStandardizedScore(score: any): StandardizedScore | null {
  const percentage = standardizeToPercentage(score);
  
  if (percentage === null) {
    return null;
  }
  
  const format = detectScoreFormat(score);
  const nsda = percentageToNSDA(percentage);
  
  return {
    percentage,
    nsda,
    displayValue: formatScoreDisplay(percentage, format),
    originalFormat: format,
    originalValue: score
  };
}

/**
 * Format score for display based on original format
 */
export function formatScoreDisplay(percentage: number, originalFormat?: ScoreFormat): string {
  if (!originalFormat) {
    return `${Math.round(percentage)}%`;
  }
  
  switch (originalFormat) {
    case ScoreFormat.NSDA:
      const nsda = percentageToNSDA(percentage);
      // Show .0 decimals only when needed (e.g., 27 instead of 27.0, but 27.5 stays 27.5)
      return `${nsda % 1 === 0 ? nsda.toFixed(0) : nsda.toFixed(1)}/30`;
      
    case ScoreFormat.TEN_POINT:
      const tenPoint = percentageToTenPoint(percentage);
      return `${tenPoint.toFixed(1)}/10`;
      
    case ScoreFormat.PERCENTAGE:
    case ScoreFormat.JSON_OBJECT:
    default:
      return `${Math.round(percentage)}%`;
  }
}

/**
 * Extract score from feedback object (handles all legacy formats)
 * Returns the score in NSDA format (25-30) for consistency
 */
export function extractScoreFromFeedback(feedback: any): number | null {
  if (!feedback) return null;
  
  // Priority 1: New format - speakerScore (NSDA scale 25-30)
  if (typeof feedback.speakerScore === 'number') {
    return feedback.speakerScore;
  }
  
  // Priority 2: Check for already standardized score (percentage) and convert to NSDA
  if (typeof feedback.standardizedScore === 'number') {
    return percentageToNSDA(feedback.standardizedScore);
  }
  
  // Priority 3: Check for overall_score (database column - stored as percentage)
  if (typeof feedback.overall_score === 'number') {
    return percentageToNSDA(feedback.overall_score);
  }
  
  // Priority 4: Legacy format - scores.overall (percentage)
  if (feedback.scores?.overall !== undefined && feedback.scores?.overall !== null) {
    const percentage = standardizeToPercentage(feedback.scores.overall);
    return percentage !== null ? percentageToNSDA(percentage) : null;
  }
  
  // Priority 5: Old format - score field (could be various formats)
  if (feedback.score !== undefined && feedback.score !== null) {
    // Check if it's a JSON string that needs parsing
    if (typeof feedback.score === 'string' && feedback.score.startsWith('{')) {
      try {
        const parsed = JSON.parse(feedback.score);
        const percentage = standardizeToPercentage(parsed);
        return percentage !== null ? percentageToNSDA(percentage) : null;
      } catch (e) {
        // PRODUCTION: Console disabled
        // console.error('[scoreStandardization] Failed to parse JSON score:', e);
      }
    }
    const percentage = standardizeToPercentage(feedback.score);
    return percentage !== null ? percentageToNSDA(percentage) : null;
  }
  
  return null;
}

/**
 * Validate score is within expected range
 */
export function validateScore(score: number, format: ScoreFormat): boolean {
  switch (format) {
    case ScoreFormat.NSDA:
      return score >= 25 && score <= 30;
    case ScoreFormat.PERCENTAGE:
      return score >= 0 && score <= 100;
    case ScoreFormat.TEN_POINT:
      return score >= 0 && score <= 10;
    default:
      return false;
  }
}

/**
 * Get score quality level for UI display
 */
export function getScoreQuality(percentage: number): {
  level: 'excellent' | 'good' | 'fair' | 'needs-improvement';
  color: string;
  label: string;
} {
  if (percentage >= 90) {
    return {
      level: 'excellent',
      color: 'text-green-600 dark:text-green-400',
      label: 'Excellent'
    };
  } else if (percentage >= 75) {
    return {
      level: 'good',
      color: 'text-blue-600 dark:text-blue-400',
      label: 'Good'
    };
  } else if (percentage >= 60) {
    return {
      level: 'fair',
      color: 'text-yellow-600 dark:text-yellow-400',
      label: 'Fair'
    };
  } else {
    return {
      level: 'needs-improvement',
      color: 'text-red-600 dark:text-red-400',
      label: 'Needs Improvement'
    };
  }
}

/**
 * Calculate average score from multiple scores
 * Rounds to nearest 0.5 for NSDA-compatible scoring
 */
export function calculateAverageScore(scores: (number | null)[]): number | null {
  const validScores = scores.filter((s): s is number => s !== null && !isNaN(s));
  
  if (validScores.length === 0) {
    return null;
  }
  
  const sum = validScores.reduce((acc, score) => acc + score, 0);
  const average = sum / validScores.length;
  return Math.round(average * 2) / 2; // Round to nearest 0.5 (half-point scoring)
}

/**
 * Batch standardize multiple feedback records
 */
export function batchStandardizeScores(feedbackRecords: any[]): {
  id: string;
  originalScore: any;
  standardizedScore: number | null;
}[] {
  return feedbackRecords.map(record => ({
    id: record.id,
    originalScore: record.feedback,
    standardizedScore: extractScoreFromFeedback(record.feedback)
  }));
}