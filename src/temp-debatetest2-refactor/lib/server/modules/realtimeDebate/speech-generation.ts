import OpenAI from 'openai';
import { env } from '@/shared/env';
import { Participant } from './debate-types';
import { debateConfig } from './debate.config';
import { DifficultyLevel } from './types';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

function fillPromptTemplate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
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
  const phaseKey = phase.toLowerCase() as keyof typeof debateConfig.phasePrompts;
  const phasePromptTemplate = debateConfig.phasePrompts[phaseKey];
  const difficultyConfig = debateConfig.difficultyLevels[difficulty];
  
  if (!personality) {
    console.warn(`Unknown speaker name: ${speaker.name}, using default personality`);
  }
  if (!phasePromptTemplate) {
      console.error(`Invalid debate phase key: ${phaseKey}`);
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

  try {
    const response = await openai.chat.completions.create({
      model: debateConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: difficultyConfig.temperature,
      max_tokens: difficultyConfig.maxTokens,
      frequency_penalty: 0.3, // Keep some interesting params
      presence_penalty: 0.2
    });

    const speech = response.choices[0]?.message?.content?.trim();
    
    if (!speech) {
      console.warn(`OpenAI returned an empty speech for phase ${phase}. Using fallback.`);
      return `As ${personality?.name || speaker.name}, I am considering my response to the topic of "${topic}".`;
    }

    // Simple sanitization
    return speech.replace(/[\*#]/g, '').trim();

  } catch (error) {
    console.error(`Error generating speech for phase ${phase}:`, error);
    return `I am currently unable to generate a response. Please proceed to the next speaker.`;
  }
} 