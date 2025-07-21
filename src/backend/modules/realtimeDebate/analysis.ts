import { z } from 'zod';
import { openAIService } from '@/backend/services/openaiService';
import { debateConfig } from './debate.config';
import { aiLogger as logger } from '@/lib/monitoring/logger';

// Define the schema for type safety and validation
const debateAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100),
  strengthsAreas: z.array(z.string()).min(1).max(5),
  improvementAreas: z.array(z.string()).min(1).max(5),
  argumentQuality: z.number().min(0).max(10),
  deliveryClarity: z.number().min(0).max(10),
  evidenceUsage: z.number().min(0).max(10),
  rebuttalEffectiveness: z.number().min(0).max(10),
  detailedFeedback: z.string().min(50).max(1000),
  keyMoments: z.array(z.string()).min(1).max(5),
  recommendedNextSteps: z.array(z.string()).min(1).max(5),
});

type DebateAnalysis = z.infer<typeof debateAnalysisSchema>;

export async function generatePostDebateAnalysis(
  topic: string,
  transcript: string,
  userName: string,
): Promise<DebateAnalysis> {

  const systemPrompt = 'You are an expert debate coach providing detailed, constructive feedback in JSON format to help students improve their debate skills.';
  
  const userPrompt = debateConfig.phasePrompts.analysis
    .replace('{{userName}}', userName)
    .replace('{{transcript}}', transcript);

  // Default fallback analysis
  const fallbackAnalysis: DebateAnalysis = {
    overallScore: 75,
    strengthsAreas: ['Active participation in the debate', 'Maintained focus on the topic'],
    improvementAreas: ['Develop more structured arguments', 'Incorporate more evidence'],
    argumentQuality: 7,
    deliveryClarity: 7,
    evidenceUsage: 6,
    rebuttalEffectiveness: 6,
    detailedFeedback: 'Your debate performance showed good engagement with the topic. To improve, focus on structuring your arguments more clearly and incorporating specific evidence to support your positions. Practice anticipating counterarguments and preparing stronger rebuttals.',
    keyMoments: ['Good opening statement', 'Engaged with opponent\'s arguments'],
    recommendedNextSteps: ['Study argument structure techniques', 'Research evidence for common debate topics', 'Practice timed rebuttals']
  };

  try {
    logger.info('Generating debate analysis', {
      metadata: {
        topic,
        userName,
        transcriptLength: transcript.length
      }
    });

    const analysis = await openAIService.createStructuredOutput<DebateAnalysis>({
      model: debateConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: debateConfig.temperature,
      max_tokens: 1000,
      schema: debateAnalysisSchema,
      schemaName: 'DebateAnalysis'
    });

    logger.info('Debate analysis generated successfully', {
      metadata: {
        overallScore: analysis.overallScore,
        userName
      }
    });

    return analysis;
  } catch (error) {
    logger.error('Failed to generate debate analysis', error as Error, {
      metadata: {
        userName,
        topic
      }
    });
    
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