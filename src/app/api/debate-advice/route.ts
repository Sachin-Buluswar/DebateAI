import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';
import { openAIService } from '@/backend/services/openaiService';
import { apiLogger as logger } from '@/lib/monitoring/logger';
import { z } from 'zod';

// Extend the validation schema to support legacy format
const requestSchema = validationSchemas.debateAdvice.extend({
  currentSpeaker: z.string().optional(),
  debateHistory: z.array(z.string()).optional(),
  // Support both 'PRO/CON' and 'proposition/opposition' formats
  userPerspective: z.enum(['PRO', 'CON', 'proposition', 'opposition']).transform(val => {
    // Normalize to lowercase format
    if (val === 'PRO') return 'proposition';
    if (val === 'CON') return 'opposition';
    return val;
  }),
  // Support legacy adviceType values
  adviceType: z.enum(['strategy', 'counterargument', 'rebuttal', 'general', 'counter', 'strengthen']).optional().default('general').transform(val => {
    // Map legacy values to new schema
    if (val === 'strategy') return 'strengthen';
    if (val === 'counterargument' || val === 'rebuttal') return 'counter';
    return val;
  }),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting with handler function
  const result = await withRateLimit(request, debateRateLimiter, async () => {
    try {
      // Authentication check
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        );
      }

      // Parse and validate request body
      const validation = await validateRequest(request, requestSchema, { sanitize: true });
      
      if (!validation.success) {
        return addSecurityHeaders(
          NextResponse.json({ 
            error: 'Invalid request data', 
            details: validation.details || validation.error
          }, { status: 400 })
        );
      }

      const { query, debateTopic, userPerspective, adviceType, currentSpeaker, debateHistory } = validation.data;

      // Build context for the AI
      let context = `Debate Topic: ${debateTopic}\n`;
      context += `User's Position: ${userPerspective}\n`;
      
      if (currentSpeaker) {
        context += `Current Speaker: ${currentSpeaker}\n`;
      }
      
      if (debateHistory && debateHistory.length > 0) {
        context += `\nDebate History:\n`;
        debateHistory.forEach((speech, index) => {
          context += `${index + 1}. ${speech}\n`;
        });
      }

      // Build the prompt based on advice type
      let systemPrompt = `You are an expert debate coach providing strategic advice during a live debate. Be concise, practical, and specific.`;
      
      let userPrompt = `${context}\n\nThe debater asks: "${query}"\n\n`;
      
      switch (adviceType) {
        case 'strategy':
          userPrompt += `Provide strategic advice to help them strengthen their position and win the debate.`;
          break;
        case 'counterargument':
          userPrompt += `Suggest effective counter-arguments they can use against the opposing side.`;
          break;
        case 'rebuttal':
          userPrompt += `Help them craft a strong rebuttal to address the opponent's arguments.`;
          break;
        case 'general':
          userPrompt += `Provide general debate advice to improve their performance.`;
          break;
      }
      
      userPrompt += `\n\nFormat your response as:
1. Main advice (2-3 sentences)
2. Key points (if applicable, bullet points)
3. Suggested arguments (if applicable, specific examples)`;

      // Call OpenAI with error recovery
      logger.info('Generating debate advice', {
        userId: user.id,
        metadata: {
          adviceType,
          topic: debateTopic.substring(0, 50) + '...'
        }
      });
      
      const fallbackAdvice = `Based on your ${userPerspective} position on "${debateTopic}", focus on: 1) Clearly stating your main arguments, 2) Anticipating counterarguments, and 3) Using evidence to support your claims. Remember to maintain a respectful tone and engage directly with opposing arguments.`;
      
      const completion = await openAIService.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }, {
        fallbackResponse: fallbackAdvice,
        validateResponse: (response) => response.length > 50 && response.length < 5000
      });

      const responseText = completion.choices[0].message.content || fallbackAdvice;
      
      // Parse the response
      const lines = responseText.split('\n').filter(line => line.trim());
      let advice = '';
      let keyPoints: string[] = [];
      let suggestedArguments: string[] = [];
      
      let currentSection = 'main';
      
      for (const line of lines) {
        if (line.includes('Key points') || line.includes('Key Points')) {
          currentSection = 'keyPoints';
        } else if (line.includes('Suggested arguments') || line.includes('Suggested Arguments')) {
          currentSection = 'arguments';
        } else if (currentSection === 'main' && !line.match(/^\d\./)) {
          advice += line + '\n';
        } else if (currentSection === 'keyPoints' && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d\./))) {
          keyPoints.push(line.replace(/^[-•\d.]\s*/, '').trim());
        } else if (currentSection === 'arguments' && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d\./))) {
          suggestedArguments.push(line.replace(/^[-•\d.]\s*/, '').trim());
        }
      }

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          advice: {
            advice: advice.trim(),
            keyPoints: keyPoints.filter(p => p.length > 0),
            suggestedArguments: suggestedArguments.filter(a => a.length > 0),
          }
        })
      );

    } catch (error) {
      logger.error('Debate advice generation failed', error as Error, {
        userId: 'unknown'
      });
      
      return addSecurityHeaders(
        NextResponse.json({ 
          error: 'Failed to get advice',
          message: 'Our AI coach is temporarily unavailable. Please try again in a moment.'
        }, { status: 500 })
      );
    }
  });
  
  return result;
}