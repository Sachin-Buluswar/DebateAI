/**
 * Eris Debate - Speech Feedback Module
 * Processes user-uploaded speech audio and provides AI feedback on delivery and content.
 * 
 * Reference: requirements.md section 2.2.2
 * Tech Stack: OpenAI Whisper, GPT-4o, Audio Processing
 */

import express, { Request, Response } from 'express';
import { promises as fs } from 'fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import * as audioProcessor from '../../../utils/audioProcessor.js';
import dotenv from 'dotenv';
import formidable from 'formidable';

// Storage constants
const SPEECH_BUCKET = 'speech_audio';
const MAX_RECORDING_LENGTH_MINUTES = 70; // 70 minutes max recording
const MAX_USER_STORAGE_BYTES = 600 * 1024 * 1024; // 600MB per user
const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024; // 50MB max upload
const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper limit

const router = express.Router();
dotenv.config({ path: '.env.local' });

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY || '';
if (!openaiApiKey) {
  console.warn('Warning: OPENAI_API_KEY not found in environment. Speech feedback might fail.');
}
const openai = new OpenAI({
  apiKey: openaiApiKey,
});

// Initialize Supabase client (use admin for storage operations)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL or Service Key not found in environment.');
  // Potentially throw an error or handle this case appropriately
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Calculate the total storage used by a user in the speech_audio bucket
 */
async function getUserStorageUsage(userId: string): Promise<number> {
  try {
    // List all files owned by the user
    const { data, error } = await supabaseAdmin
      .storage
      .from(SPEECH_BUCKET)
      .list(userId);
    
    if (error) {
      console.error('Error fetching user storage usage:', error);
      return 0;
    }
    
    // Sum up the sizes of all files
    let totalBytes = 0;
    for (const file of data || []) {
      totalBytes += file.metadata?.size || 0;
    }
    
    return totalBytes;
  } catch (error) {
    console.error('Error calculating user storage:', error);
    return 0;
  }
}

/**
 * Process speech audio and provide detailed feedback
 * POST /api/speech-feedback
 */
router.post('/api/speech-feedback', async (req: Request, res: Response) => {
  try {
    console.log('➡️ Received speech feedback request');
    
    const form = formidable({
      maxFileSize: MAX_UPLOAD_SIZE_BYTES, // Use the updated 50MB limit
    });
    const [fields, files] = await form.parse(req);
    
    // Extract form data
    const topic = fields.topic?.[0];
    const userId = fields.userId?.[0];
    const speechType = fields.speechType?.[0] || 'debate'; // Default to debate if not specified
    const audioFile = files.audio?.[0];
    
    if (!audioFile || !audioFile.filepath) {
      return res.status(400).json({ error: 'Audio file is required' });
    }
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Validate file type
    const validMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
    if (!validMimeTypes.includes(audioFile.mimetype || '')) {
      return res.status(400).json({ error: 'Invalid file type. Please upload MP3, WAV, OGG, or WEBM audio files.' });
    }
    
    // Check file duration (estimate based on size for non-MP3 files)
    // Average bitrate for speech MP3: ~32 kbps = 4KB/s = 240KB/min
    // This is a rough estimate, actual processing will verify during conversion
    const estimatedMinutes = audioFile.size / (240 * 1024);
    if (estimatedMinutes > MAX_RECORDING_LENGTH_MINUTES) {
      return res.status(400).json({ 
        error: `Audio file exceeds the maximum allowed length of ${MAX_RECORDING_LENGTH_MINUTES} minutes` 
      });
    }
    
    // Check user's storage usage
    const currentUsage = await getUserStorageUsage(userId);
    if (currentUsage + audioFile.size > MAX_USER_STORAGE_BYTES) {
      return res.status(400).json({ 
        error: 'You have reached your storage limit. Please delete some existing recordings before uploading new ones.'
      });
    }
    
    // Process audio (convert to MP3 for storage efficiency)
    let processedAudio;
    try {
      // Read the input file as a stream and process it
      const fileBuffer = await fs.readFile(audioFile.filepath);
      processedAudio = await audioProcessor.processAudioForStorage(
        fileBuffer,
        audioFile.originalFilename || 'recording.wav',
        {
          bitrate: '32k',       // Lower bitrate for speech (saves space)
          sampleRate: 22050,    // Lower sample rate for speech (saves space)
          channels: 1,          // Mono (saves space)
          maxDurationMinutes: MAX_RECORDING_LENGTH_MINUTES
        }
      );
    } catch (error: unknown) {
      console.error('Error processing audio:', error);
      if (error instanceof Error && error.message?.includes('duration')) {
        return res.status(400).json({ 
          error: `Audio file exceeds the maximum allowed length of ${MAX_RECORDING_LENGTH_MINUTES} minutes` 
        });
      }
      return res.status(500).json({ error: 'Failed to process audio file. Please try again.' });
    }
    
    // Check if processed audio data is complete - verify filePath exists
    if (!processedAudio.filePath || !processedAudio.durationSeconds || processedAudio.durationSeconds === 0) {
      return res.status(500).json({ error: 'Audio processing failed: incomplete audio data after conversion.' });
    }
    
    // Get the file size without loading the whole file
    const fileStats = await fs.stat(processedAudio.filePath);
    const processedFileSize = fileStats.size;
    
    // Check if processed file exceeds Whisper limit BEFORE transcription
    if (processedFileSize > WHISPER_MAX_BYTES) {
      console.warn(`⚠️ Processed audio size (${processedFileSize} bytes) exceeds Whisper limit (${WHISPER_MAX_BYTES} bytes). Uploading without feedback.`);
      
      // Upload MP3 to Supabase Storage using streaming
      const storagePath = `${userId}/${processedAudio.fileId}.mp3`;
      try {
        console.log(`  ⏳ Uploading large audio (no feedback) to: ${SPEECH_BUCKET}/${storagePath}`);
        
        // Create a readable stream from the processed file - safely handle the stream
        let fileStream;
        if (typeof processedAudio.stream === 'function') {
          // If stream() function is available, use it
          fileStream = processedAudio.stream();
        } else {
          // Fallback: create a read stream from the file path if stream() isn't available
          fileStream = createReadStream(processedAudio.filePath);
        }
        
        const { error: storageError } = await supabaseAdmin
          .storage
          .from(SPEECH_BUCKET)
          .upload(storagePath, fileStream, {
            contentType: 'audio/mpeg',
            cacheControl: '3600',
            upsert: true
          });
        
        if (storageError) throw storageError;

        // Get public URL
        const { data: publicUrlData } = supabaseAdmin.storage.from(SPEECH_BUCKET).getPublicUrl(storagePath);
        const audioUrl = publicUrlData.publicUrl;
        console.log(`  ✅ Large audio public URL generated: ${audioUrl}`);

        // Save placeholder record to database
        const tableExists = await ensureSpeechFeedbackTableExists();
        if (!tableExists) {
          throw new Error('Database configuration error: speech_feedback table missing.');
        }

        const { data: insertedRecord, error: dbError } = await supabaseAdmin
          .from('speech_feedback')
          .insert({
            user_id: userId,
            topic,
            speech_type: speechType,
            feedback: { message: 'Audio file too large for automated feedback.' }, // Placeholder feedback
            audio_url: audioUrl,
            transcription: null, // No transcription
            file_size_bytes: processedFileSize,
            duration_seconds: processedAudio.durationSeconds || 0
          })
          .select('id')
          .single();

        if (dbError) throw dbError;

        // Clean up temp file
        await fs.unlink(processedAudio.filePath).catch(err => console.error('  ⚠️ Error deleting processed file:', err));

        console.log('✅ Large audio uploaded and placeholder record saved.');
        return res.status(202).json({ 
          message: 'File uploaded successfully but was too large for automatic feedback.',
          audio_url: audioUrl,
          feedback_id: insertedRecord?.id
        });

      } catch (uploadError) {
        console.error('❌ Error handling large file upload:', uploadError);
        // Clean up temp file even on error
        await fs.unlink(processedAudio.filePath).catch(err => console.error('  ⚠️ Error deleting processed file during error handling:', err));
        throw uploadError; 
      }
    }
    
    // Get the appropriate prompt based on speech type
    const systemPrompt = getSpeechTypePrompt(speechType, topic);
    
    // Transcribe processed (compressed) MP3 using file stream
    let transcription;
    try {
      const transcriptionFileName = `${processedAudio.fileId}.mp3`;

      // Add exponential backoff retry logic for transcription
      const maxRetries = 3;
      let retryCount = 0;

      while (retryCount < maxRetries) {
        try {
          console.log(`Attempt ${retryCount + 1}/${maxRetries} to transcribe audio file: ${transcriptionFileName}, size: ${processedFileSize} bytes`);

          // Stream the full processed MP3 file to the OpenAI API to avoid truncated transcriptions
          const audioFileStream = createReadStream(processedAudio.filePath);

          transcription = await openai.audio.transcriptions.create({
            // The SDK accepts a ReadStream in Node environments
            file: audioFileStream,
            model: 'whisper-1',
            response_format: 'verbose_json',
            timestamp_granularities: ['segment'],
          });

          console.log('Transcription successful!');
          break; // Success - exit retry loop
        } catch (e: unknown) {
          retryCount++;

          if (retryCount >= maxRetries) {
            console.error('Maximum retry attempts reached');
            throw e; // Re‑throw after max retries
          }

          // Exponential backoff with jitter: 2^retry * 1000ms + random jitter
          const delay = Math.floor((2 ** retryCount) * 1000 + Math.random() * 1000);
          console.log(`Transcription attempt ${retryCount} failed. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error: unknown) {
      console.error('Error transcribing audio:', error);
      // Log detailed error information
      if (typeof error === 'object' && error !== null) {
        console.error('Error details:', 
          Object.getOwnPropertyNames(error).reduce((acc, key) => {
            (acc as Record<string, unknown>)[key] = (error as Record<string, unknown>)[key];
            return acc;
          }, {} as Record<string, unknown>)
        );
      }
      return res.status(500).json({ 
        error: 'Failed to transcribe audio. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown transcription error'
      });
    }
    
    // Generate feedback based on transcription
    let feedbackCompletion;
    try {
      feedbackCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Here is the transcription of my speech:\n\n${JSON.stringify(transcription)}\n\nPlease provide detailed feedback on my delivery and content.` 
          }
        ],
        response_format: { type: 'json_object' },
      });
    } catch (error) {
      console.error('Error generating feedback:', error);
      return res.status(500).json({ error: 'Failed to generate speech feedback. Please try again.' });
    }
    
    // Parse the feedback from OpenAI
    const feedbackContent = feedbackCompletion.choices[0].message.content;
    let feedback;
    
    try {
      feedback = JSON.parse(feedbackContent || '{}');
    } catch (error) {
      console.error('Error parsing feedback JSON:', error);
      feedback = {
        overall: 'Error processing feedback. Please try again.',
        delivery: [],
        content: [],
        improvements: []
      };
    }
    
    // Upload MP3 to Supabase Storage using streaming
    const storagePath = `${userId}/${processedAudio.fileId}.mp3`;
    
    try {
      console.log(`  ⏳ Uploading processed audio to: ${SPEECH_BUCKET}/${storagePath}`);
      
      // Create a readable stream from the processed file
      const fileStream = processedAudio.stream();
      
      // Upload using stream instead of buffer
      const { error: storageError } = await supabaseAdmin
        .storage
        .from(SPEECH_BUCKET)
        .upload(storagePath, fileStream, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: true
        });
      
      if (storageError) {
        console.error('❌ Error uploading audio to storage:', storageError);
        console.error('Full error details:', JSON.stringify(storageError, null, 2));
        
        // Check for specific error types
        if (storageError.message?.includes('AccessDenied')) {
          return res.status(500).json({ 
            error: 'Storage permission error. The server lacks permission to upload files.',
            details: storageError.message,
            code: (storageError as unknown as Record<string, unknown>).code || 'access_denied'
          });
        } else if (storageError.message?.includes('NoSuchBucket')) {
          return res.status(500).json({ 
            error: 'The speech_audio bucket does not exist.',
            details: storageError.message,
            code: 'no_such_bucket'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to upload audio. Please try again.',
            details: storageError.message || 'Unknown storage error',
            code: (storageError as unknown as Record<string, unknown>).code || 'unknown_error'
          });
        }
      }
    } catch (error: unknown) {
      console.error('❌ Unexpected error in storage upload:', error);
      console.error('Error type:', typeof error);
      console.error('Error stringified:', JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: 'Storage configuration error. Please contact support.',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
    
    // Get public URL for the audio
    console.log(`  ⏳ Generating public URL for: ${storagePath}`);
    const { data: publicUrlData } = supabaseAdmin
      .storage
      .from(SPEECH_BUCKET)
      .getPublicUrl(storagePath);
    
    const audioUrl = publicUrlData.publicUrl;
    console.log(`  ✅ Public URL generated: ${audioUrl}`);
    
    // Create speech_feedback table if it doesn't exist
    const tableExists = await ensureSpeechFeedbackTableExists();
    if (!tableExists) {
      return res.status(500).json({ error: 'Database configuration error. Please contact support.' });
    }
    
    // Save the feedback and audio metadata to the database
    const { error: dbError } = await supabaseAdmin
      .from('speech_feedback')
      .insert({
        user_id: userId,
        topic,
        speech_type: speechType,
        feedback,
        audio_url: audioUrl,
        transcription: JSON.stringify(transcription),
        file_size_bytes: processedFileSize,
        duration_seconds: processedAudio.durationSeconds || 0
      });
    
    if (dbError) {
      console.error('Error saving feedback to database:', dbError);
      return res.status(500).json({ error: 'Failed to save feedback. Please try again.' });
    }
    
    // Clean up temp files
    console.log(`  ⏳ Cleaning up temporary file: ${processedAudio.filePath}`);
    await fs.unlink(processedAudio.filePath).catch(err => 
      console.error('  ⚠️ Error deleting processed file:', err)
    );
    console.log('  ✅ Temporary file deleted');
    
    // Return feedback
    console.log('✅ Speech feedback processing complete, returning feedback.');
    return res.status(200).json(feedback);
    
  } catch (error: unknown) {
    console.error('Error processing speech feedback:', error);
    return res.status(500).json({ error: 'Error processing speech feedback request' });
  }
});

/**
 * Ensures the speech_feedback table exists in the database
 */
async function ensureSpeechFeedbackTableExists(): Promise<boolean> {
  try {
    // Check if table exists by querying it
    const { error } = await supabaseAdmin.from('speech_feedback').select('id').limit(1);
    
    // If table doesn't exist (error code 42P01), create it
    if (error && error.code === '42P01') {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS speech_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id),
          topic TEXT NOT NULL,
          speech_type TEXT NOT NULL,
          feedback JSONB,
          audio_url TEXT,
          transcription TEXT,
          file_size_bytes INTEGER,
          duration_seconds INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE speech_feedback ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own speech feedback" 
          ON speech_feedback 
          FOR SELECT 
          USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert own speech feedback" 
          ON speech_feedback 
          FOR INSERT 
          WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete own speech feedback" 
          ON speech_feedback 
          FOR DELETE 
          USING (auth.uid() = user_id);
        
        CREATE INDEX IF NOT EXISTS idx_speech_feedback_user_id ON speech_feedback(user_id);
      `;
      
      const { error: sqlError } = await supabaseAdmin.rpc('run_sql', { query: createTableQuery });
      if (sqlError) {
        console.error('Error creating speech_feedback table:', sqlError);
        return false;
      }
    } else if (error) {
      // Some other database error
      console.error('Error checking speech_feedback table:', error);
      return false;
    }
    
    return true;
  } catch (error: unknown) {
    console.error('Error ensuring speech_feedback table exists:', error);
    return false;
  }
}

/**
 * Generate a system prompt based on the speech type
 * @param speechType The type of speech (debate, persuasive, informative, etc.)
 * @param topic The speech topic
 * @returns A tailored system prompt for the specific speech type
 */
function getSpeechTypePrompt(speechType: string, topic: string): string {
  // Base instructions for the AI model
  const baseInstructions = `You are an expert Public Forum debate coach analyzing a speech.
The topic is: "${topic}".
The user has provided a recording of their speech and its transcription (as a JSON object with text and segments).
Evaluate BOTH the CONTENT (logic, evidence, strategy) and DELIVERY (clarity, pacing, engagement) based on the specific purpose of this speech type in a PF round.
Provide detailed, constructive feedback with specific examples or references to the transcription where possible (using segment timestamps if useful).
Structure your response as a JSON object. Be critical but encouraging. Mention specific strengths and areas for improvement.
Use the following JSON structure:
{
  "speechType": "${speechType}",
  "topic": "${topic}",
  "overallAssessment": "A brief (2-3 sentence) summary of the speech's effectiveness considering its purpose.",
  "contentFeedback": {
    "strengths": ["Specific positive point about content 1", "Specific positive point about content 2", ...],
    "areasForImprovement": ["Specific suggestion for content improvement 1", "Specific suggestion for content improvement 2", ...]
  },
  "deliveryFeedback": {
    "strengths": ["Specific positive point about delivery 1 (e.g., 'Good pacing during the introduction')", "Specific positive point about delivery 2", ...],
    "areasForImprovement": ["Specific suggestion for delivery improvement 1 (e.g., 'Work on clearer pronunciation of technical terms')", "Specific suggestion for delivery improvement 2", ...]
  },
  "actionableTips": ["A concise, actionable tip combining content/delivery feedback 1", "Tip 2", ...]
}`;

  // Specific criteria based on PF speech type
  switch (speechType.toLowerCase()) {
    case 'constructive':
      return `${baseInstructions}

Specific Evaluation Focus for CONSTRUCTIVE:
- Content: Clear labeling/separation of arguments? Strong, relevant, explained evidence? Logical reasoning linking claims to impacts? Defined key terms/framework (if necessary)? Setting a good foundation?
- Delivery: Clear pronunciation? Controlled pacing? Adequate projection/volume? Crisp articulation? Varied tone (not monotone)?`;

    case 'rebuttal':
      return `${baseInstructions}

Specific Evaluation Focus for REBUTTAL:
- Content: Specific, organized, strategic refutations? Effective prioritization of opponent arguments? Strong defense/extension of own arguments? Shaping clash areas?
- Delivery: Responsive/engaged tone? Clarity maintained during quick responses? Smooth transitions between points? Confident delivery?`;

    case 'summary':
      return `${baseInstructions}

Specific Evaluation Focus for SUMMARY:
- Content: Strategic collapsing to key issues? Clear weighing of impacts (magnitude, timeframe, probability)? Effective extension of winning points (no new arguments)? Crystallizing the round?
- Delivery: Confident tone? Controlled pacing to emphasize key ideas? Fluency (minimal fillers)? Focused and concise delivery (not rushed)?`;

    case 'final focus':
      return `${baseInstructions}

Specific Evaluation Focus for FINAL FOCUS:
- Content: Strong crystallization (simple, powerful framing)? Sharp comparative weighing? Specific reasons provided to vote for the team? Persuasive closing?
- Delivery: Persuasive and appropriately emotional tone? Strategic emphasis (voice modulation)? Clear, forceful final words? Energized and decisive delivery?`;

    default:
      // Fallback to a generic debate prompt if type is unknown, though frontend should prevent this.
      console.warn(`Unknown speech type received: ${speechType}. Using generic debate prompt.`);
      return `You are an expert debate coach analyzing a speech on the topic: "${topic}".
Provide detailed, constructive feedback on both CONTENT (arguments, evidence, logic, structure) and DELIVERY (clarity, pacing, volume, intonation, engagement).
Format your response as a JSON object with keys: "overallAssessment", "contentFeedback": {"strengths": [], "areasForImprovement": []}, "deliveryFeedback": {"strengths": [], "areasForImprovement": []}, "actionableTips": [].`;
  }
}

export default router; 