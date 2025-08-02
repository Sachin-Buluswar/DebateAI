/**
 * @file src/app/api/debate/analyze/route.ts
 * @description API endpoint for AI-powered debate analysis and feedback
 * 
 * This endpoint provides comprehensive debate analysis using GPT-4, including:
 * - Neutral debate summary
 * - Winner determination with justification
 * - Personalized feedback for human participants
 * 
 * The analysis is performed on complete debate transcripts and provides
 * actionable feedback to help users improve their debate skills.
 * 
 * Flow:
 * 1. Client sends complete debate transcript after debate ends
 * 2. Server validates user authentication and request data
 * 3. GPT-4 analyzes the transcript with structured prompts
 * 4. Returns formatted analysis with three sections
 * 
 * Related files:
 * - src/app/api/debate/speech/route.ts - Saves speeches that form transcript
 * - src/backend/services/openaiService.ts - OpenAI integration with retry logic
 * - src/components/debate/DebateAnalysis.tsx - Displays analysis results
 * - src/app/debate/[id]/analysis/page.tsx - Analysis page UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withRateLimit, debateRateLimiter } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders } from '@/middleware/inputValidation';
import { openAIService } from '@/backend/services/openaiService';
import { apiLogger as logger } from '@/lib/monitoring/logger';

/**
 * POST /api/debate/analyze
 * 
 * Generates AI-powered analysis of a completed debate
 * 
 * Request body (validated by validationSchemas.debateAnalysis):
 * {
 *   transcript: Array<{
 *     participantId: string - UUID of speaker
 *     participantName: string - Display name
 *     content: string - Speech content
 *   }>
 *   userParticipantId: string - ID of human user for personalized feedback
 *   debateTopic?: string - The debate resolution/topic
 *   debateFormat?: string - Format type (e.g., 'Public Forum', 'Lincoln-Douglas')
 * }
 * 
 * Response:
 * Success (200): { success: true, analysis: string }
 * Error (400): { error: 'Invalid request data', details: object }
 * Error (401): { error: 'Unauthorized' }
 * Error (500): { error: 'Failed to generate analysis', message: string }
 * 
 * Authentication: Requires valid Supabase session
 * Rate limiting: Uses debateRateLimiter to prevent API abuse
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting with handler function
  // This prevents users from spamming analysis requests which are expensive
  const result = await withRateLimit(request, debateRateLimiter, async () => {
    try {
      // Authentication check - ensure user is logged in
      // Uses server-side Supabase client that reads auth cookies
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // No valid session - user must be authenticated to get analysis
        return addSecurityHeaders(
          NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        );
      }

      // Validate request body using predefined schema
      // The sanitize option removes any potentially harmful content
      const validation = await validateRequest(request, validationSchemas.debateAnalysis, { sanitize: true });
      
      if (!validation.success) {
        // Return specific validation errors to help client fix request
        return addSecurityHeaders(
          NextResponse.json({ 
            error: 'Invalid request data', 
            details: validation.details || validation.error // Include field-specific errors
          }, { status: 400 })
        );
      }

      const { transcript, userParticipantId, debateTopic, debateFormat } = validation.data;

      // Build transcript text from structured data
      // Format: "Speaker Name: Speech content" with double newlines between speeches
      const transcriptText = transcript.map(entry => 
        `${entry.participantName}: ${entry.content}`
      ).join('\n\n');
      
      // Extract user's speeches for personalized feedback
      const userEntries = transcript.filter(entry => entry.participantId === userParticipantId);
      const userName = userEntries[0]?.participantName || 'User'; // Fallback name if not found
      
      // Construct GPT-4 prompt for debate analysis
      // The prompt is carefully structured to ensure consistent output format
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

      // Log analysis request for monitoring and debugging
      // Includes metadata but no sensitive content
      logger.info('Generating debate analysis', {
        userId: user.id,
        metadata: {
          transcriptEntries: transcript.length, // Number of speeches in debate
          userParticipantId // Track which participant needs feedback
        }
      });
      
      // Fallback analysis used if OpenAI call fails
      // Provides generic but helpful feedback to avoid complete failure
      const fallbackAnalysis = `
**Debate Summary:** The debate covered various arguments on both sides of the topic.

**Winner Declaration:** Based on the arguments presented, it's difficult to declare a clear winner without full analysis.

**Personalized Feedback:** Continue developing your argumentation skills and practice clear, evidence-based presentations.
      `;
      
      // Call OpenAI GPT-4 for debate analysis
      // Uses openAIService which includes retry logic and error handling
      const response = await openAIService.createChatCompletion({
        model: 'gpt-4o', // GPT-4 Optimized model for better analysis quality
        messages: [{ role: 'system', content: prompt }], // System message sets context
        max_tokens: 800, // Limit response length for cost control
      }, {
        fallbackResponse: fallbackAnalysis, // Use if API fails
        validateResponse: (response) => 
          // Ensure response contains required sections
          response.includes('**Debate Summary**') && 
          response.includes('**Winner Declaration**')
      });

      // Extract analysis from OpenAI response
      const analysis = response.choices[0].message?.content || fallbackAnalysis;
      
      // Log successful generation for monitoring
      logger.info('Debate analysis generated successfully', {
        userId: user.id,
        metadata: {
          analysisLength: analysis.length // Track response size
        }
      });

      return addSecurityHeaders(
        NextResponse.json({ 
          success: true,
          analysis 
        })
      );
    } catch (error) {
      // Log error for debugging while keeping user-facing message generic
      logger.error('Debate analysis generation failed', error as Error, {
        userId: 'unknown' // User might not be authenticated if error occurred early
      });
      
      // Return user-friendly error message without exposing internals
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