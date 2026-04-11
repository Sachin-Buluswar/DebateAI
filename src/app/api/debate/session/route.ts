import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/auth-middleware';
import { withRateLimit, apiRateLimiter } from '@/api-middleware/rateLimiter';
import { aiLogger } from '@/lib/monitoring/logger';
import { z } from 'zod';
import OpenAI from 'openai';

const sessionSchema = z.object({
  topic: z.string().min(3).max(500).optional(),
});

const topicOnlySchema = z.object({
  topicOnly: z.literal(true),
});

const requestSchema = z.union([sessionSchema, topicOnlySchema]);

const TOPIC_CATEGORIES = [
  'criminal justice and policing',
  'environmental policy and climate change',
  'education reform',
  'healthcare and public health',
  'immigration policy',
  'international relations and diplomacy',
  'economic policy and trade',
  'technology regulation and privacy',
  'military and defense policy',
  'space exploration and funding',
  'energy policy and nuclear power',
  'democratic institutions and voting',
  'artificial intelligence governance',
  'bioethics and genetic engineering',
  'housing and urban development',
  'food and agricultural policy',
  'transportation and infrastructure',
  'intellectual property and patents',
  'youth and child welfare',
  'foreign aid and development',
  'nuclear proliferation and arms control',
  'water rights and resource management',
  'censorship and free expression',
  'labor rights and automation',
  'pandemic preparedness',
];

async function generateDebateTopic(): Promise<string> {
  const category = TOPIC_CATEGORIES[Math.floor(Math.random() * TOPIC_CATEGORIES.length)];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini',
    max_tokens: 60,
    temperature: 1,
    messages: [
      {
        role: 'system',
        content: `Generate a single Public Forum debate resolution about ${category}. The resolution MUST be a declarative statement that can be affirmed or negated — NOT a question. Use phrasing like "The United States should...", "On balance, X outweighs Y", "Countries ought to...", or similar declarative forms. It should be specific, balanced, and suitable for high school or college debate. Return ONLY the resolution (under 20 words). No quotes, no "Resolved:" prefix, no preamble.`,
      },
      { role: 'user', content: 'Generate a resolution.' },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ||
    'The United States should substantially increase its investment in nuclear energy'
  );
}

async function getSignedUrl(agentId: string): Promise<string> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
    {
      method: 'GET',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs signed URL request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.signed_url;
}

export async function POST(request: NextRequest) {
  return withRateLimit(request, apiRateLimiter, async () => {
    return requireAuth(request, async (_authenticatedReq: AuthenticatedRequest) => {
      try {
        const body = await request.json();
        const parsed = requestSchema.parse(body);

        // Topic-only mode: just generate a topic without creating a signed URL
        if ('topicOnly' in parsed) {
          const topic = await generateDebateTopic();
          return NextResponse.json({ topic });
        }

        const topic = parsed.topic || (await generateDebateTopic());

        const agentId = process.env.ELEVENLABS_CROSSFIRE_AGENT_ID;
        if (!agentId) {
          return NextResponse.json(
            { error: 'Debate service is not configured. Missing agent ID.' },
            { status: 503 }
          );
        }

        const signedUrl = await getSignedUrl(agentId);

        return NextResponse.json({ signedUrl, topic });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid input', details: error.errors },
            { status: 400 }
          );
        }
        aiLogger.error('Failed to create debate session', error instanceof Error ? error : undefined, {
          service: 'debate-session',
          action: 'create',
          metadata: { errorMessage: error instanceof Error ? error.message : String(error) },
        });
        return NextResponse.json(
          { error: 'Failed to create debate session' },
          { status: 500 }
        );
      }
    });
  });
}
