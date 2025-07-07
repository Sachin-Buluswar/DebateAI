import OpenAI from 'openai';
import { env } from '@/shared/env';
import { debateConfig } from './debate.config';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

interface DebateAnalysis {
  overallScore: number;
  strengthsAreas: string[];
  improvementAreas: string[];
  argumentQuality: number;
  deliveryClarity: number;
  evidenceUsage: number;
  rebuttalEffectiveness: number;
  detailedFeedback: string;
  keyMoments: string[];
  recommendedNextSteps: string[];
}

export async function generatePostDebateAnalysis(
  topic: string,
  transcript: string,
  userName: string,
): Promise<DebateAnalysis> {

  const systemPrompt = 'You are an expert debate coach providing detailed, constructive feedback in JSON format to help students improve their debate skills.';
  
  const userPrompt = debateConfig.phasePrompts.analysis
    .replace('{{userName}}', userName)
    .replace('{{transcript}}', transcript);

  try {
    const response = await openai.chat.completions.create({
      model: debateConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: debateConfig.temperature,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis generated');
    }

    // Parse the JSON response
    const analysis = JSON.parse(content) as DebateAnalysis;
    
    // Validate the analysis structure
    if (!analysis.overallScore || !analysis.strengthsAreas || !analysis.improvementAreas) {
      throw new Error('Invalid analysis format');
    }

    return analysis;
  } catch (error) {
    console.error('Error generating debate analysis:', error);
    
    // Return a fallback analysis
    return {
      overallScore: 75,
      strengthsAreas: ['Participated actively', 'Stayed on topic'],
      improvementAreas: ['Develop stronger arguments', 'Improve evidence usage'],
      argumentQuality: 7,
      deliveryClarity: 7,
      evidenceUsage: 6,
      rebuttalEffectiveness: 6,
      detailedFeedback: 'Your debate performance showed good engagement with the topic. Focus on developing stronger arguments and incorporating more evidence to support your positions.',
      keyMoments: ['Good topic engagement'],
      recommendedNextSteps: ['Practice argument structure', 'Research debate techniques']
    };
  }
} 