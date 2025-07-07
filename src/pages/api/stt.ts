import { NextApiRequest, NextApiResponse } from 'next';
import formidable, { Fields, Files } from 'formidable';
import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';
import { env } from '@/shared/env';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = formidable({});

  form.parse(req, async (err: Error, fields: Fields, files: Files) => {
    if (err) {
      console.error('Error parsing form:', err);
      return res.status(400).json({ error: 'Error parsing form data' });
    }

    const audioFile = files.audio;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const file = Array.isArray(audioFile) ? audioFile[0] : audioFile;
    
    try {
      // Create form data for ElevenLabs API
      const formData = new FormData();
      const fileStream = fs.createReadStream(file.filepath);
      // ElevenLabs STT expects the audio file in the 'file' field
      formData.append('file', fileStream, {
        filename: file.originalFilename || 'audio.webm',
        contentType: file.mimetype || 'audio/webm',
      });

      // ElevenLabs STT requires a model identifier. Allow overriding via env or use a sensible default.
      // See: https://docs.elevenlabs.io/api-reference/speech-to-text
      const modelId = env.ELEVENLABS_STT_MODEL_ID || 'eleven_multilingual_v2';
      const url = `https://api.elevenlabs.io/v1/speech-to-text?model_id=${encodeURIComponent(modelId)}`;

      // Optional: provide language hint if supplied by client (e.g. "en"). This is not mandatory.
      if (fields.language && typeof fields.language === 'string') {
        formData.append('language', fields.language);
      }

      // Call ElevenLabs Speech to Text API
      // Note: ElevenLabs STT is still in beta and may not be available for all accounts
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': env.ELEVENLABS_API_KEY,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs STT error:', response.status, errorText);
        
        // Return a placeholder response if STT is not available
        if (response.status === 404 || response.status === 403) {
          return res.status(200).json({ 
            transcription: "[Speech to text is currently unavailable. This is what the user said during their turn in the debate.]",
            warning: "ElevenLabs Speech-to-Text is not available for your account. Using placeholder text."
          });
        }
        
        return res.status(response.status).json({ 
          error: 'Speech to text failed', 
          details: errorText 
        });
      }

      const data = await response.json();
      
      // Return the transcribed text
      // ElevenLabs STT returns the transcription in the 'text' field
      res.status(200).json({ 
        transcription: data.text || "[Unable to transcribe audio]",
        // Include other fields if available
        ...(data.language_code && { language: data.language_code }),
        ...(data.words && { words: data.words })
      });

    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      // Return placeholder text to keep the debate flowing
      res.status(200).json({ 
        transcription: "[Speech to text encountered an error. User spoke during their turn.]",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
        // Clean up temp file
        if (file && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
    }
  });
} 