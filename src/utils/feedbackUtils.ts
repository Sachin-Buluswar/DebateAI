// Feedback utilities consolidated for main app runtime.
// Source: temp-debatetest2-refactor/lib/utils/feedbackUtils.ts (trimmed slightly for clarity)

interface Feedback {
  overall?: string;
  delivery?: { overall?: string; [key: string]: unknown };
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

export function parseFeedbackData(feedbackData: unknown): Feedback | null {
  if (!feedbackData) return null;
  if (typeof feedbackData === 'string') {
    try {
      return JSON.parse(feedbackData) as Feedback;
    } catch {
      return { overall: feedbackData } as Feedback;
    }
  }
  if (typeof feedbackData === 'object') return feedbackData as Feedback;
  return null;
}

export const parseFeedbackMarkdown = (markdown: string | undefined | null): { [key: string]: string } => {
  if (!markdown) return {};
  const sanitized = markdown.replace(/\r\n/g, '\n').replace(/#{4,}/g, '###').replace(/\n{3,}/g, '\n\n');
  const sections: { [key: string]: string } = {};
  const parts = sanitized.split(/\n(?=### )/);
  for (const part of parts) {
    if (!part.trim()) continue;
    if (part.startsWith('### ')) {
      const lines = part.substring(4).split('\n');
      const heading = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      if (heading) sections[heading] = content;
    } else if (Object.keys(sections).length === 0) {
      sections['Overall Summary'] = part.trim();
    }
  }
  if (Object.keys(sections).length === 0) sections['Overall Summary'] = sanitized.trim();
  return sections;
};

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