import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { env } from '@/shared/env';
import { withRateLimit, apiRateLimiter } from '@/middleware/rateLimiter';
import { requireAuth, AuthenticatedRequest } from '@/lib/auth-middleware';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  return await withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (_authenticatedReq: AuthenticatedRequest) => {
    try {
      const { topic, stance } = await request.json();

    if (!topic || !stance) {
      return NextResponse.json(
        { error: 'Topic and stance are required.' },
        { status: 400 },
      );
    }

    const prompt = `You are an AI debater. Generate a short, compelling opening argument for the ${stance} side on the topic: "${topic}".`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a world-class debater, skilled in rhetoric and persuasive arguments.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 250,
    });

    const argument = response.choices[0].message?.content;

    return NextResponse.json({ argument });
  } catch (error) {
    // PRODUCTION: Logging disabled
// console.error('Error generating argument:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to generate argument.', details: errorMessage },
      { status: 500 },
    );
  }
    });
  });
} 