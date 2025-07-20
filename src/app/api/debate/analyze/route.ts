import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';
import { openAIService } from '@/backend/services/openaiService';
import { apiLogger as logger } from '@/lib/monitoring/logger';

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

      // Validate request body
      const validation = await validateRequest(request, validationSchemas.debateAnalysis, { sanitize: true });
      
      if (!validation.success) {
        return addSecurityHeaders(
          NextResponse.json({ 
            error: 'Invalid request data', 
            details: validation.details || validation.error
          }, { status: 400 })
        );
      }

      const { transcript, userParticipantId, debateTopic, debateFormat } = validation.data;

      // Build transcript text from structured data
      const transcriptText = transcript.map(entry => 
        `${entry.participantName}: ${entry.content}`
      ).join('\n\n');
      
      const userEntries = transcript.filter(entry => entry.participantId === userParticipantId);
      const userName = userEntries[0]?.participantName || 'User';
      
      const prompt = `
        You are an impartial and expert debate judge.
        The following is a transcript of a ${debateFormat || 'Public Forum'} debate${debateTopic ? ` on the topic: "${debateTopic}"` : ''}.
        Your task is to provide a final analysis.

        The user you should provide personalized feedback for is "${userName}" (ID: ${userParticipantId}).

        Please structure your response in three parts:
        1.  **Debate Summary:** A neutral, brief overview of the key arguments and clashes in the debate.
        2.  **Winner Declaration:** Based on the arguments presented, declare a winning team (Pro or Con) and provide a concise justification for your decision.
        3.  **Personalized Feedback for ${userName}:** Offer specific, constructive feedback for the human user. Comment on their argument strength, clarity, and rebuttal effectiveness. Suggest concrete areas for improvement.

        Transcript:
        ---
        ${transcriptText}
        ---
      `;

      logger.info('Generating debate analysis', {
        userId: user.id,
        metadata: {
          transcriptEntries: transcript.length,
          userParticipantId
        }
      });
      
      const fallbackAnalysis = `
**Debate Summary:** The debate covered various arguments on both sides of the topic.

**Winner Declaration:** Based on the arguments presented, it's difficult to declare a clear winner without full analysis.

**Personalized Feedback:** Continue developing your argumentation skills and practice clear, evidence-based presentations.
      `;
      
      const response = await openAIService.createChatCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: prompt }],
        max_tokens: 800,
      }, {
        fallbackResponse: fallbackAnalysis,
        validateResponse: (response) => response.includes('**Debate Summary**') && response.includes('**Winner Declaration**')
      });

      const analysis = response.choices[0].message?.content || fallbackAnalysis;
      
      logger.info('Debate analysis generated successfully', {
        userId: user.id,
        metadata: {
          analysisLength: analysis.length
        }
      });

      return addSecurityHeaders(
        NextResponse.json({ 
          success: true,
          analysis 
        })
      );
    } catch (error) {
      logger.error('Debate analysis generation failed', error as Error, {
        userId: 'unknown'
      });
      
      return addSecurityHeaders(
        NextResponse.json(
          { 
            error: 'Failed to generate analysis',
            message: 'Our analysis service is temporarily unavailable. Please try again later.'
          },
          { status: 500 }
        )
      );
    }
  });
  
  return result;
} 