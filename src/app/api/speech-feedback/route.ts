import { NextResponse } from 'next/server';
import { processSpeechFeedback } from '@/backend/modules/speechFeedback/speechFeedbackService';
import { speechFeedbackRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders, validateAudioFile } from '@/middleware/inputValidation';

export async function POST(request: Request) {
  // Apply rate limiting for speech uploads
  const rateLimitResult = await withRateLimit(request, speechFeedbackRateLimiter, async () => {
    try {
      console.log('[speech-feedback] Processing incoming request');
      
      // Parse FormData from the request
      const formData = await request.formData();
      
      // Extract and validate audio file
      const audioFile = formData.get('audio') as File;
      if (!audioFile || !(audioFile instanceof File)) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'No audio file provided or invalid file format' },
            { status: 400 }
          )
        );
      }

      // Validate audio file
      const fileValidation = validateAudioFile(audioFile);
      if (!fileValidation.valid) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: fileValidation.error },
            { status: 400 }
          )
        );
      }

      // Create data object for validation
      const requestData = {
        topic: formData.get('topic') as string,
        speechType: formData.get('speechType') as string,
        userSide: formData.get('userSide') as string,
        customInstructions: formData.get('customInstructions') as string,
        userId: formData.get('userId') as string,
      };

      // Validate text fields using the validation schema
      const validation = await validateRequest(
        new Request(request.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(requestData)
        }),
        validationSchemas.speechFeedback,
        { body: true, sanitize: true }
      );

      if (!validation.success) {
        console.warn('[speech-feedback] Invalid request:', validation.error);
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Invalid request data', details: validation.details },
            { status: 400 }
          )
        );
      }

      const { topic, userId, customInstructions } = validation.data;
      
      // Convert audio to buffer
      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      
      // Additional security checks
      if (audioBuffer.length === 0) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Empty audio file provided' },
            { status: 400 }
          )
        );
      }

      // Get speech type and user side from request
      const speechType = requestData.speechType || 'debate';
      const userSide = requestData.userSide || 'None';
      
      console.log(`[speech-feedback] Processing audio file: ${audioFile.name} (${audioBuffer.length} bytes) for user ${userId}`);

      // Process the speech feedback
      const result = await processSpeechFeedback({
        audioBuffer,
        filename: audioFile.name || 'audio.mp3',
        mimeType: audioFile.type || 'audio/mpeg',
        topic,
        userId,
        speechType,
        userSide,
        customInstructions
      });
      
      console.log('[speech-feedback] Processing complete, returning feedback');
      
      // Return response with id for frontend redirect
      return addSecurityHeaders(
        NextResponse.json({
          id: result.feedbackId,
          success: true
        }, { status: 200 })
      );
      
    } catch (error) {
      console.error('[speech-feedback] Error processing request:', error);
      
      // Enhanced error handling
      if (error instanceof Error) {
        if (error.message.includes('Storage limit exceeded')) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'Storage limit exceeded. Please delete some existing recordings.' },
              { status: 413 }
            )
          );
        }
        
        if (error.message.includes('File exceeds maximum size')) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'Audio file too large. Maximum size is 50MB.' },
              { status: 413 }
            )
          );
        }

        if (error.message.includes('Rate limit') || error.message.includes('quota')) {
          return addSecurityHeaders(
            NextResponse.json(
              { error: 'Service temporarily overloaded. Please try again in a few minutes.' },
              { status: 503 }
            )
          );
        }
      }

      // Generic error (don't expose internal details)
      return addSecurityHeaders(
        NextResponse.json(
          { error: 'Failed to process speech feedback. Please try again later.' },
          { status: 500 }
        )
      );
    }
  });

  // Return rate limit response if blocked
  if (rateLimitResult instanceof Response) {
    return addSecurityHeaders(rateLimitResult);
  }

  return rateLimitResult;
}

export async function GET() {
  return addSecurityHeaders(
    NextResponse.json(
      { error: 'Method not allowed. Use POST to upload speech for feedback.' },
      { status: 405 }
    )
  );
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return addSecurityHeaders(
    new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : 'https://debateai.com',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
} 