import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import OpenAI from 'openai';
import { withRateLimit } from '@/middleware/rateLimiter';
import { z } from 'zod';
import { addSecurityHeaders } from '@/middleware/inputValidation';

const rateLimiter = {
  tokensPerInterval: 30,
  interval: 60 * 1000, // 1 minute
};

const requestSchema = z.object({
  query: z.string().min(1).max(500),
  debateTopic: z.string(),
  userPerspective: z.enum(['PRO', 'CON']),
  adviceType: z.enum(['strategy', 'counterargument', 'rebuttal', 'general']),
  currentSpeaker: z.string().optional(),
  debateHistory: z.array(z.string()).optional(),
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await withRateLimit(request, rateLimiter);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    // Authentication check
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return addSecurityHeaders(
        NextResponse.json({ 
          error: 'Invalid request data', 
          details: validation.error.errors 
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

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0].message.content || '';
    
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
    console.error('Debate advice error:', error);
    return addSecurityHeaders(
      NextResponse.json({ 
        error: 'Failed to get advice',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    );
  }
}