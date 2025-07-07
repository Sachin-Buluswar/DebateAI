import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { env } from '@/shared/env';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { transcript, userParticipantId } = await request.json();

    if (!transcript || !userParticipantId) {
      return NextResponse.json(
        { error: 'Transcript and userParticipantId are required.' },
        { status: 400 },
      );
    }

    const prompt = `
      You are an impartial and expert debate judge.
      The following is a transcript of a Public Forum debate.
      Your task is to provide a final analysis.

      The user you should provide personalized feedback for is identified by the ID: "${userParticipantId}".

      Please structure your response in three parts:
      1.  **Debate Summary:** A neutral, brief overview of the key arguments and clashes in the debate.
      2.  **Winner Declaration:** Based on the arguments presented, declare a winning team (Pro or Con) and provide a concise justification for your decision.
      3.  **Personalized Feedback for ${userParticipantId}:** Offer specific, constructive feedback for the human user. Comment on their argument strength, clarity, and rebuttal effectiveness. Suggest concrete areas for improvement.

      Transcript:
      ---
      ${transcript}
      ---
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 800,
    });

    const analysis = response.choices[0].message?.content;

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Error generating debate analysis:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to generate analysis.', details: errorMessage },
      { status: 500 },
    );
  }
} 