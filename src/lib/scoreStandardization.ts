/**
 * Score Standardization Utilities
 * Centralizes all score conversion logic and ensures consistency
 * across the application.
 */

/**
 * Score format types that exist in the system
 */
enum ScoreFormat {
  NSDA = 'nsda',           // 25-30 point scale
  PERCENTAGE = 'percentage', // 0-100 scale
  TEN_POINT = 'ten_point',  // 1-10 scale
  JSON_OBJECT = 'json_object', // Legacy format with nested scores
}

/**
 * Convert NSDA score (25-30) to percentage (0-100)
 */
export function nsdaToPercentage(score: number): number {
  if (score < 25 || score > 30) {
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
    score = Math.max(0, Math.min(10, score)); // Clamp to valid range
  }
  return Math.round((score / 10) * 100);
}

/**
 * Detect score format based on value and context
 */
function detectScoreFormat(score: unknown): ScoreFormat {
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
  
  
  return ScoreFormat.PERCENTAGE; // Default fallback
}

/**
 * Extract score from legacy JSON object format
 */
function extractFromJsonObject(scoreObj: unknown): number | null {
  if (!scoreObj || typeof scoreObj !== 'object') {
    return null;
  }

  const obj = scoreObj as Record<string, unknown>;

  // Try different possible keys in order of preference
  const possibleKeys = ['overall', 'total', 'average', 'score', 'content'];

  for (const key of possibleKeys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      const value = parseFloat(String(obj[key]));
      if (!isNaN(value)) {
        return value;
      }
    }
  }

  // If no direct score found, try to calculate average from components
  const components = ['content', 'delivery', 'argumentation'];
  const validScores = components
    .map(key => parseFloat(String(obj[key])))
    .filter(val => !isNaN(val));
  
  if (validScores.length > 0) {
    return validScores.reduce((sum, val) => sum + val, 0) / validScores.length;
  }
  
  return null;
}

/**
 * Standardize any score format to percentage
 */
export function standardizeToPercentage(score: unknown): number | null {
  if (score === null || score === undefined) {
    return null;
  }
  
  const format = detectScoreFormat(score);
  
  switch (format) {
    case ScoreFormat.NSDA:
      return nsdaToPercentage(parseFloat(String(score)));

    case ScoreFormat.PERCENTAGE:
      return Math.round(parseFloat(String(score)));

    case ScoreFormat.TEN_POINT:
      return tenPointToPercentage(parseFloat(String(score)));

    case ScoreFormat.JSON_OBJECT: {
      const extracted = extractFromJsonObject(score);
      if (extracted !== null) {
        // Recursively standardize the extracted value
        return standardizeToPercentage(extracted);
      }
      return null;
    }

    default: {
      const parsed = parseFloat(String(score));
      return isNaN(parsed) ? null : Math.round(parsed);
    }
  }
}

/**
 * Extract score from feedback object (handles all legacy formats)
 * Returns the score in NSDA format (25-30) for consistency
 */
export function extractScoreFromFeedback(feedback: Record<string, unknown> | null | undefined): number | null {
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
  const scores = feedback.scores;
  if (scores && typeof scores === 'object' && !Array.isArray(scores)) {
    const scoresObj = scores as Record<string, unknown>;
    if (scoresObj.overall !== undefined && scoresObj.overall !== null) {
      const percentage = standardizeToPercentage(scoresObj.overall);
      return percentage !== null ? percentageToNSDA(percentage) : null;
    }
  }

  // Priority 5: Old format - score field (could be various formats)
  if (feedback.score !== undefined && feedback.score !== null) {
    // Check if it's a JSON string that needs parsing
    if (typeof feedback.score === 'string' && feedback.score.startsWith('{')) {
      try {
        const parsed = JSON.parse(feedback.score);
        const percentage = standardizeToPercentage(parsed);
        return percentage !== null ? percentageToNSDA(percentage) : null;
      } catch {
      }
    }
    const percentage = standardizeToPercentage(feedback.score);
    return percentage !== null ? percentageToNSDA(percentage) : null;
  }
  
  return null;
}

// ---------------------------------------------------------------------------
// Legacy-compatible helpers (formerly in utils/scoring.ts)
// ---------------------------------------------------------------------------

type ScoreType = 'nsda' | 'percentage' | 'ten-point';

export interface ScoreInfo {
  value: number;
  type: ScoreType;
  display: string;
  description: string;
}

/**
 * Detect score type based on numeric value
 */
function detectScoreType(score: number): ScoreType {
  if (score >= 25 && score <= 30) return 'nsda';
  if (score >= 1 && score <= 10) return 'ten-point';
  return 'percentage';
}

/**
 * Format score for display with appropriate scale indicator
 */
export function formatScore(score: number, type?: ScoreType): ScoreInfo {
  const scoreType = type || detectScoreType(score);

  switch (scoreType) {
    case 'nsda':
      return {
        value: score,
        type: 'nsda',
        display: `${score % 1 === 0 ? score.toFixed(0) : score.toFixed(1)}/30`,
        description: 'NSDA Public Forum scale (half-point scoring)',
      };
    case 'ten-point':
      return {
        value: score,
        type: 'ten-point',
        display: `${score.toFixed(1)}/10`,
        description: '10-point scale',
      };
    case 'percentage':
    default:
      return {
        value: score,
        type: 'percentage',
        display: `${Math.round(score)}%`,
        description: 'Percentage score',
      };
  }
}

/**
 * Get Tailwind color class based on score value
 */
export function getScoreColor(score: number, type?: ScoreType): string {
  const scoreType = type || detectScoreType(score);
  let percentage = score;

  if (scoreType === 'nsda') percentage = nsdaToPercentage(score);
  else if (scoreType === 'ten-point') percentage = tenPointToPercentage(score);

  if (percentage >= 90) return 'text-green-600 dark:text-green-400';
  if (percentage >= 75) return 'text-blue-600 dark:text-blue-400';
  if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}