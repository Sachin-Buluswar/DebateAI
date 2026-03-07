import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';
import { processSpeechFeedback } from '@/backend/modules/speechFeedback/speechFeedbackService';
import { speechFeedbackRateLimiter, withRateLimit } from '@/middleware/rateLimiter';
import { validateRequest, validationSchemas, addSecurityHeaders, validateAudioFile } from '@/middleware/inputValidation';

export async function POST(request: NextRequest) {
  // Apply rate limiting for speech uploads
  const rateLimitResult = await withRateLimit(request, speechFeedbackRateLimiter, async () => {
    return requireAuth(request, async (authenticatedRequest: AuthenticatedRequest) => {
    try {
      const user = authenticatedRequest.user;

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
        skillLevel: formData.get('skillLevel') as string,
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
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Invalid request data', details: validation.details },
            { status: 400 }
          )
        );
      }

      const { topic, customInstructions } = validation.data;

      // Use authenticated user's ID instead of form data
      const userId = user.id;

      // Verify the userId from form matches authenticated user (if provided)
      if (validation.data.userId && validation.data.userId !== user.id) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden - Cannot submit feedback for another user' },
            { status: 403 }
          )
        );
      }

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

      // Get speech type, user side, and skill level from request
      const speechType = requestData.speechType || 'debate';
      const userSide = requestData.userSide || 'None';
      const skillLevel = (requestData.skillLevel as 'novice' | 'intermediate' | 'advanced') || 'intermediate';

      // Process the speech feedback (service will handle storage with service role)
      const result = await processSpeechFeedback({
        audioBuffer,
        filename: audioFile.name || 'audio.mp3',
        mimeType: audioFile.type || 'audio/mpeg',
        topic,
        userId,
        speechType,
        userSide,
        skillLevel,
        customInstructions
      });

      // Return response with id for frontend redirect
      return addSecurityHeaders(
        NextResponse.json({
          id: result.feedbackId,
          success: true
        }, { status: 200 })
      );

    } catch (error) {
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
        'Access-Control-Allow-Origin': process.env.NODE_ENV === 'development' ? '*' : (process.env.NEXT_PUBLIC_APP_URL || 'https://erisdebate.com'),
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  );
}
