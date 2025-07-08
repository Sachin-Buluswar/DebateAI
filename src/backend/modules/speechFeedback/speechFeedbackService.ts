/**
 * Speech Feedback Service
 * Extracted core logic for processing speech feedback that can be called from Next.js API routes
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';

// Storage constants
export const SPEECH_BUCKET = 'speech_audio';
export const MAX_RECORDING_LENGTH_MINUTES = 70;
export const MAX_USER_STORAGE_BYTES = 600 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

// Initialize clients
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!openaiApiKey) {
  console.warn('[speechFeedbackService] OPENAI_API_KEY not found');
}
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[speechFeedbackService] Supabase credentials missing');
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface SpeechFeedbackInput {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
  topic: string;
  userId: string;
  speechType?: string;
  customInstructions?: string;
}

export interface SpeechFeedbackResult {
  feedback: {
    overallScore: number;
    categories: Record<string, { score: number; feedback: string }>;
    detailedFeedback: string;
    suggestions: string[];
  };
  audioUrl: string;
  feedbackId?: string;
  transcription?: {
    text: string;
    duration: number;
    segments: Array<{ start: number; end: number; text: string }>;
  };
}

/**
 * Calculate total storage used by a user
 */
export async function getUserStorageUsage(userId: string): Promise<number> {
  try {
    const { data, error } = await supabaseAdmin
      .storage
      .from(SPEECH_BUCKET)
      .list(userId);
    
    if (error) {
      console.error('[speechFeedbackService] Error fetching storage:', error);
      return 0;
    }
    
    let totalBytes = 0;
    for (const file of data || []) {
      totalBytes += file.metadata?.size || 0;
    }
    
    return totalBytes;
  } catch (error) {
    console.error('[speechFeedbackService] Storage calculation error:', error);
    return 0;
  }
}

/**
 * Get the system prompt for different speech types
 */
function getSpeechTypePrompt(speechType: string, topic: string): string {
  const basePrompt = `You are an expert debate coach analyzing a ${speechType} on the topic: "${topic}".`;
  
  const prompts: Record<string, string> = {
    debate: `${basePrompt} Focus on argumentation, evidence use, rebuttals, and persuasiveness.`,
    presentation: `${basePrompt} Focus on clarity, organization, engagement, and visual aid references.`,
    speech: `${basePrompt} Focus on delivery, rhetoric, emotional appeal, and audience connection.`,
    constructive: `${basePrompt} This is a constructive speech. Focus on: clear framework establishment, strong evidence and warrants, logical argument structure, impact analysis, and persuasive delivery. Analyze how well they built their case from the ground up.`,
    rebuttal: `${basePrompt} This is a rebuttal speech. Focus on: effective refutation of opponent arguments, defense of own case, clash engagement, impact comparison (outweighing), and time allocation between offense and defense.`,
    'cross-examination': `${basePrompt} This is a cross-examination period. Focus on: strategic questioning to expose weaknesses, clarity of questions, control of the cross-ex, ability to set up future arguments, and professional demeanor under pressure.`,
    summary: `${basePrompt} This is a summary speech. Focus on: crystallization of key voting issues, impact comparison and weighing, narrative construction, judge appeal, and strategic choice of what arguments to go for in the final speech.`,
    'final-focus': `${basePrompt} This is a final focus speech. Focus on: final impact comparison, resolution of key clashes, persuasive conclusion, strategic voting issue selection, and ability to close the debate decisively.`,
    default: `${basePrompt} Provide comprehensive feedback on all aspects of the delivery and argumentation.`
  };
  
  const specificPrompt = prompts[speechType] || prompts.default;
  
  return `${specificPrompt}
  
  Analyze the transcription and provide feedback in JSON format with these fields:
  {
    "overall": "A brief overall assessment (2-3 sentences)",
    "delivery": ["List of specific feedback points about delivery (pace, tone, clarity, etc.)"],
    "content": ["List of specific feedback points about content (arguments, evidence, structure, etc.)"],
    "improvements": ["List of actionable suggestions for improvement"],
    "score": {
      "delivery": 85,  // Score out of 100
      "content": 80,   // Score out of 100
      "overall": 82    // Score out of 100
    }
  }`;
}

/**
 * Main speech feedback processing function
 */
export async function processSpeechFeedback(input: SpeechFeedbackInput): Promise<SpeechFeedbackResult> {
  const { audioBuffer, filename, topic, userId, speechType = 'debate' } = input;
  
  console.log(`[speechFeedbackService] Processing ${filename} for user ${userId}`);
  
  // Validate file size
  if (audioBuffer.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_UPLOAD_SIZE_BYTES / 1024 / 1024}MB`);
  }
  
  // Check user storage
  const currentUsage = await getUserStorageUsage(userId);
  if (currentUsage + audioBuffer.length > MAX_USER_STORAGE_BYTES) {
    throw new Error('Storage limit exceeded. Please delete existing recordings.');
  }
  
  // For now, skip complex audio processing and work with the original buffer
  // In a production environment, you'd want FFmpeg for proper audio processing
  const fileId = `speech_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tempFilePath = `/tmp/${fileId}.mp3`;
  
  // Write buffer to temporary file
  await fs.writeFile(tempFilePath, audioBuffer);
  
  const processedAudio = {
    filePath: tempFilePath,
    fileId,
    durationSeconds: 60 // Mock duration - in production this would be calculated
  };
  
  // Check processed file size
  const processedFileSize = audioBuffer.length;
  
  // Upload to storage
  const storagePath = `${userId}/${processedAudio.fileId}.mp3`;
  
  // Use buffer instead of stream to avoid Node.js stream issues
  const { error: storageError } = await supabaseAdmin
    .storage
    .from(SPEECH_BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: true
    });
  
  if (storageError) {
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }
  
  // Get public URL
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(SPEECH_BUCKET)
    .getPublicUrl(storagePath);
  
  const audioUrl = publicUrlData.publicUrl;
  
  // Handle large files without transcription
  if (processedFileSize > WHISPER_MAX_BYTES) {
    console.warn(`[speechFeedbackService] File too large for transcription (${processedFileSize} bytes)`);
    
    const { data: insertedRecord, error: dbError } = await supabaseAdmin
      .from('speech_feedback')
      .insert({
        user_id: userId,
        topic,
        speech_type: speechType,
        feedback: { message: 'Audio file too large for automated feedback.' },
        audio_url: audioUrl,
        transcription: null,
        file_size_bytes: processedFileSize,
        duration_seconds: processedAudio.durationSeconds || 0
      })
      .select('id')
      .single();
    
    if (dbError) throw dbError;
    
    // Cleanup
    await fs.unlink(processedAudio.filePath).catch(() => {});
    
    return {
      feedback: {
        overallScore: 0,
        categories: {},
        detailedFeedback: 'File uploaded but too large for analysis',
        suggestions: []
      },
      audioUrl,
      feedbackId: insertedRecord?.id
    };
  }
  
  // Transcribe audio using OpenAI Whisper
  let transcription;
  if (!openai) {
    console.warn('[speechFeedbackService] OpenAI client not available, using fallback transcription');
    transcription = {
      text: `Transcription unavailable - OpenAI API key not configured. Speech about ${topic}.`,
      segments: []
    };
  } else {
    try {
      const audioFileStream = createReadStream(processedAudio.filePath);
      
      const whisperResponse = await openai.audio.transcriptions.create({
        file: audioFileStream,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });
      
      transcription = whisperResponse;
      console.log('[speechFeedbackService] Transcription completed successfully');
    } catch (error) {
      console.error('[speechFeedbackService] Transcription failed:', error);
      transcription = {
        text: `Transcription failed due to API error. Speech about ${topic}.`,
        segments: []
      };
    }
  }
  
  // Generate AI feedback using GPT-4o
  let feedback;
  if (!openai) {
    console.warn('[speechFeedbackService] OpenAI client not available, using fallback feedback');
    feedback = {
      overall: `Unable to provide AI analysis - OpenAI API not configured. Manual review recommended for speech about ${topic}.`,
      delivery: ["API configuration required for detailed feedback"],
      content: ["API configuration required for detailed feedback"],
      improvements: ["Configure OpenAI API key to enable AI-powered feedback"],
      score: { delivery: 0, content: 0, overall: 0 }
    };
  } else {
    try {
      const systemPrompt = getSpeechTypePrompt(speechType, topic);
      
      const feedbackCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Here is the transcription of my speech:\n\n${JSON.stringify(transcription)}\n\nPlease provide detailed feedback in the specified JSON format.` 
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });
      
      const feedbackContent = feedbackCompletion.choices[0].message.content;
      
      try {
        feedback = JSON.parse(feedbackContent || '{}');
        console.log('[speechFeedbackService] AI feedback generated successfully');
      } catch (parseError) {
        console.error('[speechFeedbackService] Failed to parse AI feedback:', parseError);
        feedback = {
          overall: 'AI feedback generated but could not be parsed properly.',
          delivery: ["Unable to parse detailed feedback"],
          content: ["Unable to parse detailed feedback"],
          improvements: ["Please try uploading your speech again"],
          score: { delivery: 50, content: 50, overall: 50 }
        };
      }
    } catch (error) {
      console.error('[speechFeedbackService] AI feedback generation failed:', error);
      feedback = {
        overall: `Speech analysis failed due to API error. Basic assessment: Speech about ${topic} was recorded successfully.`,
        delivery: ["Unable to analyze delivery due to API error"],
        content: ["Unable to analyze content due to API error"],  
        improvements: ["Please try again later or contact support"],
        score: { delivery: 0, content: 0, overall: 0 }
      };
    }
  }
  
  // Save to database
  let insertedRecord;
  try {
    const { data, error: dbError } = await supabaseAdmin
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
      })
      .select('id')
      .single();
    
    if (dbError) {
      console.error('[speechFeedbackService] Database save failed:', dbError);
      // Continue with execution but use a mock ID
      insertedRecord = { id: `temp-feedback-${Date.now()}` };
    } else {
      insertedRecord = data;
      console.log('[speechFeedbackService] Feedback saved to database successfully');
    }
  } catch (error) {
    console.error('[speechFeedbackService] Database operation failed:', error);
    insertedRecord = { id: `temp-feedback-${Date.now()}` };
  }
  
  // Cleanup
  await fs.unlink(processedAudio.filePath).catch(() => {});
  
  return {
    feedback,
    audioUrl,
    feedbackId: insertedRecord?.id,
    transcription: transcription ? {
      text: transcription.text,
      duration: transcription.duration || 0,
      segments: transcription.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text
      })) || []
    } : undefined
  };
} 