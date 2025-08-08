/**
 * Unified scoring utilities for handling different scoring systems
 * 
 * The platform uses THREE different scoring systems:
 * 1. NSDA: 25-30 points (speaker scores in debates)
 * 2. Percentage: 0-100 (component scores, dashboard)
 * 3. 10-Point: 1-10 (debate analysis metrics)
 */

export type ScoreType = 'nsda' | 'percentage' | 'ten-point';

export interface ScoreInfo {
  value: number;
  type: ScoreType;
  display: string;
  description: string;
}

/**
 * Convert NSDA score (25-30) to percentage (0-100)
 */
export function nsdaToPercentage(score: number): number {
  const MIN_NSDA = 25;
  const MAX_NSDA = 30;
  const normalized = (score - MIN_NSDA) / (MAX_NSDA - MIN_NSDA);
  return Math.round(normalized * 100);
}

/**
 * Convert percentage (0-100) to NSDA score (25-30)
 * Rounds to nearest 0.5 (half-point scoring)
 */
export function percentageToNSDA(percentage: number): number {
  const MIN_NSDA = 25;
  const MAX_NSDA = 30;
  const nsdaScore = MIN_NSDA + (percentage / 100) * (MAX_NSDA - MIN_NSDA);
  return Math.round(nsdaScore * 2) / 2; // Round to nearest 0.5 (half-point scoring)
}

/**
 * Convert 10-point scale to percentage
 */
export function tenPointToPercentage(score: number): number {
  return Math.round((score / 10) * 100);
}

/**
 * Detect score type based on value
 */
export function detectScoreType(score: number): ScoreType {
  if (score >= 25 && score <= 30) {
    return 'nsda';
  } else if (score >= 1 && score <= 10) {
    return 'ten-point';
  } else {
    return 'percentage';
  }
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
        description: 'NSDA Public Forum scale (half-point scoring)'
      };
    
    case 'ten-point':
      return {
        value: score,
        type: 'ten-point',
        display: `${score.toFixed(1)}/10`,
        description: '10-point scale'
      };
    
    case 'percentage':
    default:
      return {
        value: score,
        type: 'percentage',
        display: `${Math.round(score)}%`,
        description: 'Percentage score'
      };
  }
}

/**
 * Get score color based on percentage value
 */
export function getScoreColor(score: number, type?: ScoreType): string {
  // Convert to percentage for consistent color mapping
  let percentage = score;
  
  const scoreType = type || detectScoreType(score);
  if (scoreType === 'nsda') {
    percentage = nsdaToPercentage(score);
  } else if (scoreType === 'ten-point') {
    percentage = tenPointToPercentage(score);
  }
  
  if (percentage >= 90) return 'text-green-600 dark:text-green-400';
  if (percentage >= 75) return 'text-blue-600 dark:text-blue-400';
  if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get appropriate scale label for score type
 */
export function getScaleLabel(type: ScoreType): string {
  switch (type) {
    case 'nsda':
      return 'out of 30 (NSDA)';
    case 'ten-point':
      return 'out of 10';
    case 'percentage':
    default:
      return 'out of 100';
  }
}