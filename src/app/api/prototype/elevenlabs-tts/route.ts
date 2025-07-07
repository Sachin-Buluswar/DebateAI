import { NextResponse } from 'next/server';
import { env } from '@/shared/env';
import fetch from 'node-fetch';

// A default voice ID from ElevenLabs. You can find more on their website.
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('ElevenLabs API Error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate audio from ElevenLabs.', details: errorData },
        { status: response.status },
      );
    }

    // Get the readable stream from the response
    const audioStream = response.body;

    if (!audioStream) {
      return NextResponse.json(
        { error: 'Could not get audio stream from response.' },
        { status: 500 },
      );
    }

    // Stream the audio back to the client
    return new Response(audioStream as any, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });
  } catch (error) {
    console.error('Error generating audio:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to generate audio.', details: errorMessage },
      { status: 500 },
    );
  }
} 