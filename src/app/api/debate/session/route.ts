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

// Topic areas modeled on real NSDA Public Forum resolutions (2010-2026).
// ~60% of real PF topics involve the US; ~40% involve international actors,
// organizations (NATO, UN, EU, AU, IMF), or foreign countries as primary actors.
const TOPIC_AREAS = [
  // US domestic policy
  'U.S. criminal justice (e.g. drug legalization, for-profit prisons, plea bargaining, policing reform)',
  'U.S. healthcare policy (e.g. Medicare for All, pharmaceutical price controls, vaccination mandates)',
  'U.S. education policy (e.g. student loan forgiveness, charter schools, standardized testing, free college)',
  'U.S. immigration policy (e.g. H-1B visas, birthright citizenship, border policy, path to citizenship)',
  'U.S. economic and fiscal policy (e.g. capital gains tax, federal debt, universal basic income, income inequality)',
  'U.S. energy and environment (e.g. nuclear energy, carbon tax, offshore drilling, single-use plastics)',
  'U.S. technology and privacy (e.g. Section 230, encryption backdoors, biometric data collection, AI regulation)',
  'U.S. constitutional and institutional reform (e.g. Electoral College, executive orders, war powers, Voting Rights Act)',
  'U.S. gun policy and Second Amendment issues',
  'U.S. housing and urban development (e.g. market-rate housing, corporate homebuying)',
  'U.S. labor and employment (e.g. right-to-work laws, student-athletes as employees, gig worker classification)',
  'U.S. transportation and infrastructure (e.g. high-speed rail, public infrastructure spending)',
  // U.S. foreign policy and military
  'U.S. military presence abroad (e.g. Arctic, Persian Gulf, Okinawa, specific regions)',
  'U.S. defense and military spending (e.g. Space Force, NATO commitments, arms sales)',
  'U.S. nuclear policy (e.g. no first use, nonproliferation, arms control)',
  'U.S. trade agreements and economic sanctions (e.g. bilateral trade deals, embargoes, tariffs)',
  'U.S. cyber operations and national security surveillance (e.g. NSA, offensive cyber, drone strikes)',
  // International actors and organizations
  'NATO and European security (e.g. Baltic defense, membership debates, nuclear sharing)',
  'United Nations reform (e.g. Security Council permanent membership, peacekeeping operations)',
  'European Union policy (e.g. Belt and Road, trade agreements, regulatory frameworks)',
  'African Union and African regional issues (e.g. Sahel conflict, West Africa urbanization, diplomatic recognition)',
  'International economic organizations (e.g. IMF, World Bank, economic globalization)',
  'Foreign country domestic policy (e.g. Japan Article 9, Spain/Catalonia, India Artemis Accords, China resource extraction)',
  'International treaties and agreements (e.g. Rome Statute/ICC, Law of the Sea, Artemis Accords)',
  'Middle East and West Asian conflicts and diplomacy',
  // Cross-cutting topics
  'Space exploration and policy (e.g. public vs. private investment, international cooperation)',
  'Sports and athletics policy (e.g. NCAA athlete compensation, sports betting regulation, public stadium subsidies)',
  'Artificial intelligence and emerging technology (e.g. generative AI in education, autonomous systems)',
  'Climate change and international environmental obligations',
  'Free speech, censorship, and media (e.g. social media and democracy, anonymous speech, cyberbullying)',
  'Bioethics (e.g. genetic engineering, organ donation incentives, public health mandates)',
  'Refugee and humanitarian policy (e.g. humanitarian needs vs. national interests)',
  'Food and agriculture (e.g. genetically modified foods, organic agriculture)',
  'Nuclear proliferation and arms control (e.g. Iran, North Korea, international agreements)',
];

// Resolution structures modeled on real NSDA PF patterns:
//  ~45% "[Actor] should [action]"
//  ~20% "On balance, the benefits of [X] outweigh the harms"
//  ~15% "In [context], [declarative claim]"
//  ~10% "[Thing] is/are [evaluation]"
//  ~5%  "[X] should be prioritized over [Y]"
//  ~5%  "[X] is justified"
const RESOLUTION_STRUCTURES = [
  '"[Specific actor] should [specific action]." — where the actor can be a country, government body, or international organization',
  '"On balance, the benefits of [specific policy or phenomenon] outweigh the harms." or "...produces more benefits than harms."',
  '"In [specific context], [declarative evaluative claim]." — e.g. "In the United States, right-to-work laws do more harm than good."',
  '"[Specific policy or institution] is [evaluation]." — e.g. a legitimate expansion, a threat to, beneficial to, etc.',
  '"[X] should be prioritized over [Y]." — comparing two specific policy approaches',
];

async function generateDebateTopic(): Promise<string> {
  const area = TOPIC_AREAS[Math.floor(Math.random() * TOPIC_AREAS.length)];
  const structure = RESOLUTION_STRUCTURES[Math.floor(Math.random() * RESOLUTION_STRUCTURES.length)];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_GENERATION_MODEL || 'gpt-4o-mini',
    max_tokens: 100,
    temperature: 1,
    messages: [
      {
        role: 'system',
        content: `You generate NSDA-style Public Forum debate resolutions. Your output is used directly as a debate topic, so return ONLY the resolution text — nothing else.

Topic area for this resolution: ${area}

Use this resolution structure: ${structure}

Rules:
- The resolution MUST be a declarative statement that can be affirmed or negated — NEVER a question.
- Be specific: reference real policies, legislation, treaties, organizations, or countries by name when relevant.
- The resolution should be balanced — reasonable arguments should exist on both sides.
- Length: 10-25 words. Real PF resolutions are often detailed and specific.
- Start with "Resolved: " (this is standard PF format).
- Do NOT add quotes, commentary, or preamble — output only the resolution.`,
      },
      { role: 'user', content: 'Generate a resolution.' },
    ],
  });
  const raw = response.choices[0]?.message?.content?.trim() || '';
  // Strip "Resolved: " prefix for display — we store just the resolution statement
  return (
    raw.replace(/^Resolved:\s*/i, '').replace(/^["']|["']$/g, '') ||
    'On balance, the benefits of genetically modified foods outweigh the harms'
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
        aiLogger.error(
          'Failed to create debate session',
          error instanceof Error ? error : undefined,
          {
            service: 'debate-session',
            action: 'create',
            metadata: { errorMessage: error instanceof Error ? error.message : String(error) },
          }
        );
        return NextResponse.json({ error: 'Failed to create debate session' }, { status: 500 });
      }
    });
  });
}
