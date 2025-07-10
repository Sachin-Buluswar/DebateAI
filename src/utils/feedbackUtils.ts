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

// New structured feedback format
export interface StructuredFeedback {
  speakerScore: number;
  scoreJustification: string;
  overallSummary: string;
  structureOrganization: {
    analysis: string;
    examples: string[];
    suggestions: string[];
  };
  argumentationEvidence: {
    analysis: string;
    examples: string[];
    suggestions: string[];
  };
  clarityConciseness: {
    analysis: string;
    examples: string[];
    suggestions: string[];
  };
  persuasivenessImpact: {
    analysis: string;
    examples: string[];
    suggestions: string[];
  };
  deliveryStyle: {
    analysis: string;
    examples: string[];
    suggestions: string[];
  };
  relevanceToSpeechType: {
    analysis: string;
    examples: string[];
    suggestions: string[];
  };
  actionableSuggestions: string[];
  strengths: string[];
  areasForImprovement: string[];
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

// Convert structured feedback to markdown sections
export function convertStructuredFeedbackToMarkdown(feedback: StructuredFeedback): { [key: string]: string } {
  const sections: { [key: string]: string } = {};
  
  // Overall Summary with Score
  sections['Overall Summary'] = `**Speaker Score: ${feedback.speakerScore}/30** (NSDA Public Forum Scale)\n\n${feedback.scoreJustification}\n\n${feedback.overallSummary}`;
  
  // Strengths
  if (feedback.strengths && feedback.strengths.length > 0) {
    sections['Strengths'] = feedback.strengths.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  
  // Areas for Improvement
  if (feedback.areasForImprovement && feedback.areasForImprovement.length > 0) {
    sections['Areas for Improvement'] = feedback.areasForImprovement.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  
  // Actionable Suggestions
  if (feedback.actionableSuggestions && feedback.actionableSuggestions.length > 0) {
    sections['Next Steps'] = feedback.actionableSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  
  // Structure & Organization
  const structSection = feedback.structureOrganization;
  if (structSection) {
    let content = `${structSection.analysis}\n\n`;
    if (structSection.examples && structSection.examples.length > 0) {
      content += `**Examples from your speech:**\n${structSection.examples.map(e => `- ${e}`).join('\n')}\n\n`;
    }
    if (structSection.suggestions && structSection.suggestions.length > 0) {
      content += `**Suggestions:**\n${structSection.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    sections['Structure & Organization'] = content.trim();
  }
  
  // Argumentation & Evidence
  const argSection = feedback.argumentationEvidence;
  if (argSection) {
    let content = `${argSection.analysis}\n\n`;
    if (argSection.examples && argSection.examples.length > 0) {
      content += `**Examples from your speech:**\n${argSection.examples.map(e => `- ${e}`).join('\n')}\n\n`;
    }
    if (argSection.suggestions && argSection.suggestions.length > 0) {
      content += `**Suggestions:**\n${argSection.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    sections['Argumentation & Evidence'] = content.trim();
  }
  
  // Clarity & Conciseness
  const claritySection = feedback.clarityConciseness;
  if (claritySection) {
    let content = `${claritySection.analysis}\n\n`;
    if (claritySection.examples && claritySection.examples.length > 0) {
      content += `**Examples from your speech:**\n${claritySection.examples.map(e => `- ${e}`).join('\n')}\n\n`;
    }
    if (claritySection.suggestions && claritySection.suggestions.length > 0) {
      content += `**Suggestions:**\n${claritySection.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    sections['Clarity & Conciseness'] = content.trim();
  }
  
  // Persuasiveness & Impact
  const persuasiveSection = feedback.persuasivenessImpact;
  if (persuasiveSection) {
    let content = `${persuasiveSection.analysis}\n\n`;
    if (persuasiveSection.examples && persuasiveSection.examples.length > 0) {
      content += `**Examples from your speech:**\n${persuasiveSection.examples.map(e => `- ${e}`).join('\n')}\n\n`;
    }
    if (persuasiveSection.suggestions && persuasiveSection.suggestions.length > 0) {
      content += `**Suggestions:**\n${persuasiveSection.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    sections['Persuasiveness & Impact'] = content.trim();
  }
  
  // Delivery Style
  const deliverySection = feedback.deliveryStyle;
  if (deliverySection) {
    let content = `${deliverySection.analysis}\n\n`;
    if (deliverySection.examples && deliverySection.examples.length > 0) {
      content += `**Examples from your speech:**\n${deliverySection.examples.map(e => `- ${e}`).join('\n')}\n\n`;
    }
    if (deliverySection.suggestions && deliverySection.suggestions.length > 0) {
      content += `**Suggestions:**\n${deliverySection.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    sections['Delivery Style (Inferred)'] = content.trim();
  }
  
  // Relevance to Speech Type
  const relevanceSection = feedback.relevanceToSpeechType;
  if (relevanceSection) {
    let content = `${relevanceSection.analysis}\n\n`;
    if (relevanceSection.examples && relevanceSection.examples.length > 0) {
      content += `**Examples from your speech:**\n${relevanceSection.examples.map(e => `- ${e}`).join('\n')}\n\n`;
    }
    if (relevanceSection.suggestions && relevanceSection.suggestions.length > 0) {
      content += `**Suggestions:**\n${relevanceSection.suggestions.map(s => `- ${s}`).join('\n')}`;
    }
    sections['Relevance to Speech Type(s)'] = content.trim();
  }
  
  return sections;
} 