import fetch from 'node-fetch';
import FormData from 'form-data';

// ElevenLabs STT (Scribe) endpoint
const ELEVEN_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

/**
 * Transcribes an audio buffer using ElevenLabs STT.
 * Adds simple exponential-backoff retry (max 3 attempts).
 */
export async function transcribeAudio(audio: Buffer | ArrayBuffer): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[sttService] ELEVENLABS_API_KEY env var missing. Falling back to text prompt.');
    throw new Error('Speech transcription service unavailable');
  }

  const withRetry = async <T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> => {
    let attempt = 0;
    let delay = 400;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (attempt >= maxAttempts) {
          console.error(`[sttService] ${label} failed after ${attempt} attempts.`);
          throw err;
        }
        console.warn(`[sttService] ${label} error (attempt ${attempt}). Retrying in ${delay}ms`, err);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  };

  const form = new FormData();
  form.append('file', audio as Buffer, {
    filename: 'audio.webm',
    contentType: 'audio/webm',
  });
  form.append('model', 'eleven_multilingual_v2');

  const requestFn = () =>
    fetch(ELEVEN_STT_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        ...form.getHeaders(),
      },
      body: form as unknown as any,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ElevenLabs STT error ${res.status}: ${text}`);
      }
      const data = (await res.json()) as { text: string };
      if (!data.text) throw new Error('Invalid response from STT service');
      return data.text;
    });

  return withRetry(requestFn, 'ElevenLabs STT');
} 