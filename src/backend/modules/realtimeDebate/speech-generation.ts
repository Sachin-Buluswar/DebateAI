import { openAIService } from '@/backend/services/openaiService';
import { Participant } from './debate-types';
import { debateConfig } from './debate.config';
import { DifficultyLevel } from './types';
import { aiLogger as logger } from '@/lib/monitoring/logger';

function fillPromptTemplate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

/**
 * Map specific debate phases to their generic prompt template key.
 * e.g. PRO_CONSTRUCTIVE → constructive, CON_REBUTTAL → rebuttal
 */
function getPromptKey(phase: string): keyof typeof debateConfig.phasePrompts | null {
  const normalized = phase.toUpperCase();
  if (normalized.includes('CONSTRUCTIVE')) return 'constructive';
  if (normalized.includes('REBUTTAL')) return 'rebuttal';
  if (normalized.includes('SUMMARY') || normalized.includes('FINAL_FOCUS')) return 'summary';
  if (normalized.includes('CROSSFIRE')) return 'crossfire';
  if (normalized.includes('ANALYSIS')) return 'analysis';
  return null;
}

export async function generateSpeech(
  topic: string,
  speaker: Participant,
  phase: string,
  transcript: string,
  opponentSpeech: string = '',
  difficulty: DifficultyLevel = 'intermediate',
  timeLimit: number = 4
): Promise<string> {
  const personality = debateConfig.personalities[speaker.name];
  const phaseKey = getPromptKey(phase);
  const phasePromptTemplate = phaseKey ? debateConfig.phasePrompts[phaseKey] : undefined;
  const difficultyConfig = debateConfig.difficultyLevels[difficulty];
  
  if (!personality) {
  }
  if (!phasePromptTemplate) {
      return "I'm sorry, I'm not sure how to proceed in this phase of the debate.";
  }

  // Extract recent context from transcript
  const recentContext = transcript.split('\n\n').slice(-4).join('\n\n');

  // Enhanced system prompt that includes personality voice prompt
  const systemPrompt = `${debateConfig.baseSystemPrompt}\n\nYour speaking style: ${personality?.voicePrompt || 'Speak naturally and confidently.'}\n\nDifficulty level: ${difficultyConfig.name} (${difficultyConfig.complexityLevel} complexity)`;
  
  const userPrompt = fillPromptTemplate(phasePromptTemplate, {
      phaseName: phase,
      personalityName: personality?.name || speaker.name,
      stance: speaker.team,
      topic: topic,
      opponentSpeech: opponentSpeech,
      lastStatement: recentContext,
      userName: 'human_user', // Placeholder, may need to be passed in
      transcript: transcript,
      timeLimit: timeLimit.toString(),
      complexityLevel: difficultyConfig.complexityLevel,
      crossfireType: 'Grand' // Default, can be made dynamic
  });

  // Define fallback response based on phase and personality
  const fallbackResponse = `As ${personality?.name || speaker.name} representing the ${speaker.team} side, I ${phase === 'Opening' ? 'believe that' : 'argue that'} "${topic}" is ${speaker.team === 'PRO' ? 'an important issue that deserves our support' : 'a matter that requires careful consideration'}. ${phase === 'Rebuttal' ? 'While the opposition has made some points, I maintain my position.' : ''}`;

  try {
    const response = await openAIService.createChatCompletion({
      model: debateConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: difficultyConfig.temperature,
      max_tokens: difficultyConfig.maxTokens,
      frequency_penalty: 0.3,
      presence_penalty: 0.2
    }, {
      fallbackResponse,
      validateResponse: (response) => {
        // Basic validation - ensure response is not empty and is reasonable length
        return response.length > 10 && response.length < 10000;
      }
    });

    const speech = response.choices[0]?.message?.content?.trim();
    
    if (!speech) {
      logger.warn('OpenAI returned empty speech', {
        metadata: {
          phase,
          speaker: speaker.name,
          topic
        }
      });
      return fallbackResponse;
    }

    // Simple sanitization
    const sanitizedSpeech = speech.replace(/[\*#]/g, '').trim();
    
    logger.info('Speech generated successfully', {
      metadata: {
        phase,
        speaker: speaker.name,
        speechLength: sanitizedSpeech.length,
        difficulty
      }
    });
    
    return sanitizedSpeech;

  } catch (error) {
    logger.error('Failed to generate speech', error as Error, {
      metadata: {
        phase,
        speaker: speaker.name,
        topic
      }
    });
    
    // Return a more contextual fallback based on the phase
    return fallbackResponse;
  }
}