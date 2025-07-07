/**
 * Utilities for processing speech feedback data
 */

interface Feedback {
  overall?: string;
  delivery?: {
    overall?: string;
    [key: string]: unknown;
  };
  arguments?: unknown;
  scores?: {
    overall: number;
    delivery: number;
    arguments: number;
    persuasiveness: number;
  };
  score?: number;
  [key: string]: unknown;
}

/**
 * Parse feedback data that might be stored in different formats
 * @param feedbackData - The feedback data from the API or database
 * @returns Parsed feedback object or null if invalid
 */
export function parseFeedbackData(feedbackData: unknown): Feedback | null {
  if (!feedbackData) {
    console.warn('Empty feedback data received in parseFeedbackData');
    return null;
  }
  
  // If it's a string, try to parse it as JSON
  if (typeof feedbackData === 'string') {
    try {
      console.log('Attempting to parse string feedback data');
      return JSON.parse(feedbackData) as Feedback;
    } catch (err) {
      console.error('Error parsing feedback JSON:', err);
      console.error('Problematic feedback string:', 
        feedbackData.length > 100 ? feedbackData.substring(0, 100) + '...' : feedbackData);
      // Return a minimally structured object with the string as overall feedback
      return { overall: feedbackData };
    }
  }
  
  // If it's already an object, return it directly
  if (typeof feedbackData === 'object') {
    const feedback = feedbackData as Feedback;
    // Check if it's properly structured
    if (!feedback.overall && !feedback.delivery && !feedback.arguments) {
      console.warn('Feedback object missing expected properties');
    }
    return feedback;
  }
  
  console.warn(`Unexpected feedback data type: ${typeof feedbackData}`);
  return null;
}

/**
 * Get the overall assessment from feedback data
 * @param feedbackData - The raw feedback data
 * @returns The overall assessment or a default message
 */
export function getOverallFeedback(feedbackData: unknown): string {
  const parsed = parseFeedbackData(feedbackData);
  if (!parsed) return 'Feedback not available';
  
  // Handle different possible locations for the overall assessment
  return parsed.overall || 
         (parsed.delivery && typeof parsed.delivery === 'object' && parsed.delivery.overall) ||
         'Feedback available';
}

/**
 * Safely access nested arrays in feedback data
 * @param feedbackData - The raw feedback data
 * @param path - Dot-separated path to the array (e.g., 'delivery.pronunciation')
 * @returns Array of items at the path or empty array if not found
 */
export function getArrayFromPath(feedbackData: unknown, path: string): string[] {
  const parsed = parseFeedbackData(feedbackData);
  if (!parsed) return [];
  
  const parts = path.split('.');
  let current: unknown = parsed;
  
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      console.warn(`Path ${path} not found in feedback data at part: ${part}`);
      return [];
    }
    current = (current as Record<string, unknown>)[part];
  }
  
  if (!current) {
    console.warn(`Path ${path} resulted in undefined or null value`);
    return [];
  }
  
  // Handle case where we got a string instead of an array
  if (typeof current === 'string') {
    console.warn(`Expected array at path ${path} but got string`);
    return [current];
  }
  
  return Array.isArray(current) ? current.map(String) : [];
}

/**
 * Get scores from feedback data
 * @param feedbackData - The raw feedback data
 * @returns Object with score values or null if not available
 */
export function getFeedbackScores(feedbackData: unknown): { [key: string]: number } | null {
  const parsed = parseFeedbackData(feedbackData);
  if (!parsed) return null;
  
  // Check for scores in the new format
  if (parsed.scores && typeof parsed.scores === 'object') {
    return parsed.scores as { [key: string]: number };
  }
  
  // Check for legacy score format
  if (parsed.score && typeof parsed.score === 'number') {
    // Convert legacy format to new format
    return {
      overall: parsed.score,
      delivery: parsed.score,
      arguments: parsed.score,
      persuasiveness: parsed.score
    };
  }
  
  // If no scores are found but we have a valid feedback object,
  // create a default score of 0.7 (70%) to avoid UI issues
  if (parsed.overall || parsed.delivery || parsed.arguments) {
    console.warn('No scores found in feedback, using default score');
    return {
      overall: 0.7,
      delivery: 0.7,
      arguments: 0.7,
      persuasiveness: 0.7
    };
  }
  
  return null;
}

/**
 * Helper function to parse feedback markdown into sections based on '### ' headings
 * @param markdown - The raw feedback markdown string
 * @returns A dictionary mapping section headings to their content
 */
export const parseFeedbackMarkdown = (markdown: string | undefined | null): { [key: string]: string } => {
  if (!markdown) return {};

  // Sanitize input to handle potential formatting issues
  const sanitizedMarkdown = markdown
    .replace(/\r\n/g, '\n')            // Normalize line endings
    .replace(/#{4,}/g, '###')          // Replace excess # to normalized headings
    .replace(/\n{3,}/g, '\n\n');       // Normalize excessive newlines

  const sections: { [key: string]: string } = {};
  
  // First, try with standard markdown heading pattern
  try {
    // Split by '### ' heading marker
    const parts = sanitizedMarkdown.split(/\n(?=### )/);
    
    for (const part of parts) {
      if (part.trim()) {
        if (part.trim().startsWith('### ')) {
          // Extract heading and content
          const lines = part.substring(4).split('\n');
          const heading = lines[0].trim();
          const content = lines.slice(1).join('\n').trim();
          
          if (heading) {
            sections[heading] = content || '';
          }
        } else if (Object.keys(sections).length === 0) {
          // If first part doesn't start with ###, treat as Overview/Summary
          sections['Overall Summary'] = part.trim();
        }
      }
    }
    
    // If no sections were found but content exists, try alternate parsing
    if (Object.keys(sections).length === 0 && sanitizedMarkdown.trim()) {
      // Try to find headings with alternative formats
      const altHeadings = sanitizedMarkdown.match(/[#]{1,3}\s+([^\n]+)/g);
      
      if (altHeadings && altHeadings.length > 0) {
        // Split content by any heading pattern
        const altParts = sanitizedMarkdown.split(/\n(?=[#]{1,3}\s+)/);
        
        for (const part of altParts) {
          if (part.trim()) {
            const match = part.match(/^[#]{1,3}\s+([^\n]+)/);
            if (match) {
              const heading = match[1].trim();
              const content = part.replace(/^[#]{1,3}\s+([^\n]+)/, '').trim();
              if (heading) {
                sections[heading] = content || '';
              }
            }
          }
        }
      } else {
        // No headings found at all, treat the whole thing as a single section
        sections['Overall Summary'] = sanitizedMarkdown.trim();
      }
    }
    
    return sections;
  } catch (error) {
    console.error('Error parsing feedback markdown:', error);
    // Fallback to treating the whole content as a single section
    return { 'Overall Summary': sanitizedMarkdown };
  }
};


/**
 * Mapping from Markdown headings (expected from AI) to UI display titles
 */
export const feedbackSectionTitles: { [key: string]: string } = {
  'Overall Summary': 'Overall Summary',
  'Structure & Organization': 'Structure & Organization',
  'Argumentation & Evidence': 'Argument Structure',
  'Clarity & Conciseness': 'Clarity & Conciseness',
  'Persuasiveness & Impact': 'Persuasiveness',
  'Delivery Style (Inferred)': 'Delivery Mechanics',
  'Relevance to Speech Type(s)': 'Relevance to Speech Type(s)',
  'Actionable Suggestions': 'Actionable Suggestions'
}; 