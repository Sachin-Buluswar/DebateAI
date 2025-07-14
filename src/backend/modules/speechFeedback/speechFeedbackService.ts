/**
 * Speech Feedback Service
 * Extracted core logic for processing speech feedback that can be called from Next.js API routes
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { getAudioDuration } from '@/backend/utils/audioUtils';

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
  userSide?: string;
  customInstructions?: string;
}

export interface SpeechFeedbackResult {
  feedback: Record<string, unknown>; // Using Record<string, unknown> instead of any
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
function getSpeechTypePrompt(speechType: string, topic: string, userSide?: string, customInstructions?: string): string {
  const sideContext = userSide && userSide !== 'None' ? ` The speaker is on the ${userSide} side.` : '';
  const basePrompt = `You are an expert Public Forum debate coach with 20+ years of experience judging at the highest levels of competition including NSDA Nationals and TOC. You are analyzing a ${speechType} on the topic: "${topic}".${sideContext}`;
  
  const prompts: Record<string, string> = {
    // Legacy types for backward compatibility
    debate: `${basePrompt} Focus on argumentation, evidence use, rebuttals, and persuasiveness.`,
    presentation: `${basePrompt} Focus on clarity, organization, engagement, and visual aid references.`,
    speech: `${basePrompt} Focus on delivery, rhetoric, emotional appeal, and audience connection.`,
    constructive: `${basePrompt} This is a constructive speech. Focus on: clear framework establishment, strong evidence and warrants, logical argument structure, impact analysis, and persuasive delivery. Analyze how well they built their case from the ground up.`,
    rebuttal: `${basePrompt} This is a rebuttal speech. Focus on: effective refutation of opponent arguments, defense of own case, clash engagement, impact comparison (outweighing), and time allocation between offense and defense.`,
    'cross-examination': `${basePrompt} This is a cross-examination period. Focus on: strategic questioning to expose weaknesses, clarity of questions, control of the cross-ex, ability to set up future arguments, and professional demeanor under pressure.`,
    summary: `${basePrompt} This is a summary speech. Focus on: crystallization of key voting issues, impact comparison and weighing, narrative construction, judge appeal, and strategic choice of what arguments to go for in the final speech.`,
    'final-focus': `${basePrompt} This is a final focus speech. Focus on: final impact comparison, resolution of key clashes, persuasive conclusion, strategic voting issue selection, and ability to close the debate decisively.`,
    
    // Specific debate speech types
    '1AC': `${basePrompt} This is the 1st Affirmative Constructive (1AC). Focus on: establishing a clear framework/definitions, presenting the affirmative case with strong contentions, providing solid evidence with proper citations, establishing clear impacts and link chains, setting up the narrative for the round, and delivering with confidence and clarity. The 1AC sets the foundation for the entire debate.`,
    '1NC': `${basePrompt} This is the 1st Negative Constructive (1NC). Focus on: effectively responding to the 1AC framework, presenting negative case/disadvantages, attacking affirmative contentions with evidence, establishing negative ground in the debate, time allocation between offense and defense, and maintaining organization while covering multiple arguments.`,
    '2AC': `${basePrompt} This is the 2nd Affirmative Constructive (2AC). Focus on: defending the affirmative case against 1NC attacks, rebuilding/extending affirmative arguments, responding to negative case/disadvantages, frontlining key arguments, maintaining offensive pressure, and efficiently covering the flow while adding new evidence.`,
    '2NC': `${basePrompt} This is the 2nd Negative Constructive (2NC). Focus on: extending and developing negative arguments, responding to 2AC frontlines, deepening attacks on affirmative case, strategic argument selection, impact comparison, and working effectively with their partner to divide labor.`,
    '1NR': `${basePrompt} This is the 1st Negative Rebuttal (1NR). Focus on: extending specific arguments from constructives, covering arguments not addressed by 2NR, efficiency in a short speech (3 minutes), clear impact comparison, maintaining negative strategy, and setting up voting issues for the 2NR.`,
    '1AR': `${basePrompt} This is the 1st Affirmative Rebuttal (1AR). Focus on: covering the entire flow efficiently in limited time (4 minutes), extending key affirmative arguments, responding to negative voting issues, re-establishing affirmative narrative, smart argument selection, and maintaining composure under time pressure.`,
    '2NR': `${basePrompt} This is the 2nd Negative Rebuttal (2NR). Focus on: crystallizing 1-2 key voting issues, impact comparison and outweighing, telling the negative ballot story, responding to 1AR coverage, strategic argument selection (going for the right arguments), and closing the debate persuasively.`,
    '2AR': `${basePrompt} This is the 2nd Affirmative Rebuttal (2AR). Focus on: winning the key voting issues identified by 2NR, final impact comparison, resolving major clashes in the debate, appealing to the judge's decision calculus, maintaining consistency with earlier speeches, and delivering a persuasive final message.`,
    
    // Public Forum specific speech types
    'pro_case': `${basePrompt} This is a Pro Team Case in Public Forum debate. Focus on: establishing a clear framework and definitions, presenting pro contentions with strong evidence, creating compelling narratives, establishing clear impacts and weighing mechanisms, setting up the debate structure, and delivering with confidence. The case should be accessible to lay judges while maintaining competitive rigor.`,
    
    'con_case': `${basePrompt} This is a Con Team Case in Public Forum debate. Focus on: responding to the pro framework when necessary, presenting con contentions with strong evidence, establishing why the status quo is preferable or why the pro side fails, creating compelling counter-narratives, providing clear impacts and weighing, and setting up negative ground for the round.`,
    
    'pro_rebuttal': `${basePrompt} This is a Pro Team Rebuttal in Public Forum debate. Focus on: effectively attacking con contentions with evidence and logic, defending the pro case against con attacks, establishing clash on key issues, beginning impact comparison, maintaining organization across multiple arguments, and efficiently using time to cover the most important arguments.`,
    
    'con_rebuttal': `${basePrompt} This is a Con Team Rebuttal in Public Forum debate. Focus on: effectively attacking pro contentions with evidence and logic, defending the con case against pro attacks, establishing clash on key issues, beginning impact comparison, maintaining organization across multiple arguments, and efficiently using time to cover the most important arguments.`,
    
    'pro_summary': `${basePrompt} This is a Pro Team Summary in Public Forum debate. Focus on: crystallizing the key voting issues in the round, providing clear impact comparison and weighing analysis, extending the most important arguments from earlier speeches, responding to major con claims, creating a clear narrative for why pro should win, and making strategic choices about which arguments to prioritize.`,
    
    'con_summary': `${basePrompt} This is a Con Team Summary in Public Forum debate. Focus on: crystallizing the key voting issues in the round, providing clear impact comparison and weighing analysis, extending the most important arguments from earlier speeches, responding to major pro claims, creating a clear narrative for why con should win, and making strategic choices about which arguments to prioritize.`,
    
    'pro_final_focus': `${basePrompt} This is a Pro Team Final Focus in Public Forum debate. Focus on: making the final case for why pro should win the round, providing ultimate impact comparison and weighing, resolving key clashes identified in summary speeches, appealing directly to the judge's decision-making process, maintaining consistency with the pro summary, and delivering a compelling closing argument that crystallizes the pro ballot story.`,
    
    'con_final_focus': `${basePrompt} This is a Con Team Final Focus in Public Forum debate. Focus on: making the final case for why con should win the round, providing ultimate impact comparison and weighing, resolving key clashes identified in summary speeches, appealing directly to the judge's decision-making process, maintaining consistency with the con summary, and delivering a compelling closing argument that crystallizes the con ballot story.`,
    
    default: `${basePrompt} Provide comprehensive feedback on all aspects of the delivery and argumentation.`
  };
  
  const specificPrompt = prompts[speechType] || prompts.default;
  
  return `${specificPrompt}

${customInstructions ? `Additional instructions from the user: ${customInstructions}\n` : ''}

You must provide COMPREHENSIVE feedback as an expert debate coach would. Be specific with examples from the speech. Your feedback should be constructive, detailed, and actionable.

Analyze the transcription and provide feedback in JSON format with these exact fields:
{
  "speakerScore": 27,  // NSDA Public Forum speaker points (25-30 scale, half points allowed)
  "scoreJustification": "Explain why this specific score was awarded based on NSDA criteria",
  "overallSummary": "2-3 paragraph comprehensive summary of the speech performance, highlighting key strengths and areas for improvement",
  "structureOrganization": {
    "analysis": "Detailed analysis of speech structure, flow, transitions, and organization",
    "examples": ["Specific example from speech showing good/poor structure", "Another example"],
    "suggestions": ["Specific suggestion for improvement", "Another suggestion"]
  },
  "argumentationEvidence": {
    "analysis": "Detailed analysis of argument quality, evidence use, warrants, and logical reasoning",
    "examples": ["Quote or paraphrase showing strong/weak argumentation", "Example of evidence use"],
    "suggestions": ["How to strengthen arguments", "Better evidence usage tips"]
  },
  "clarityConciseness": {
    "analysis": "Analysis of clarity, word economy, avoiding redundancy, and message precision",
    "examples": ["Example of clear/unclear communication from the speech", "Instance of redundancy"],
    "suggestions": ["Ways to improve clarity", "How to be more concise"]
  },
  "persuasivenessImpact": {
    "analysis": "Analysis of persuasive techniques, impact calculus, and emotional appeal",
    "examples": ["Example of effective/ineffective persuasion", "Impact comparison attempt"],
    "suggestions": ["How to be more persuasive", "Better impact framing techniques"]
  },
  "deliveryStyle": {
    "analysis": "Analysis of speaking pace, tone variation, confidence, and vocal delivery",
    "examples": ["Noted delivery characteristic", "Specific moment of strong/weak delivery"],
    "suggestions": ["Delivery improvement tips", "Vocal technique suggestions"]
  },
  "relevanceToSpeechType": {
    "analysis": "How well the speech fulfilled the specific requirements of a ${speechType}",
    "examples": ["Example showing understanding/misunderstanding of speech type", "Another example"],
    "suggestions": ["Better ways to approach this speech type", "Key elements to include next time"]
  },
  "actionableSuggestions": [
    "Top priority: Most important thing to work on",
    "Second priority: Next area for improvement",
    "Third priority: Additional improvement area",
    "Long-term goal: Skill to develop over time"
  ],
  "strengths": [
    "First key strength demonstrated",
    "Second key strength",
    "Third key strength"
  ],
  "areasForImprovement": [
    "Primary area needing work",
    "Secondary area for improvement",
    "Additional improvement opportunity"
  ]
}`
}

/**
 * Main speech feedback processing function
 */
export async function processSpeechFeedback(input: SpeechFeedbackInput): Promise<SpeechFeedbackResult> {
  const { audioBuffer, filename, topic, userId, speechType = 'debate', userSide } = input;
  
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
  
  // Get actual audio duration
  const durationSeconds = await getAudioDuration(tempFilePath);
  
  // Validate duration
  const durationMinutes = durationSeconds / 60;
  if (durationMinutes > MAX_RECORDING_LENGTH_MINUTES) {
    // Clean up temp file
    await fs.unlink(tempFilePath).catch(() => {});
    throw new Error(`Recording duration of ${Math.round(durationMinutes)} minutes exceeds maximum of ${MAX_RECORDING_LENGTH_MINUTES} minutes`);
  }
  
  const processedAudio = {
    filePath: tempFilePath,
    fileId,
    durationSeconds
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
        user_side: userSide,
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
        speakerScore: 0,
        scoreJustification: 'File too large for automated analysis',
        overallSummary: 'Audio file uploaded successfully but is too large for automated feedback.',
        message: 'Audio file too large for automated feedback.' 
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
      speakerScore: 0,
      scoreJustification: "Unable to provide score - OpenAI API not configured",
      overallSummary: `Unable to provide AI analysis - OpenAI API not configured. Manual review recommended for speech about ${topic}.`,
      structureOrganization: {
        analysis: "API configuration required for detailed feedback",
        examples: [],
        suggestions: []
      },
      argumentationEvidence: {
        analysis: "API configuration required for detailed feedback",
        examples: [],
        suggestions: []
      },
      clarityConciseness: {
        analysis: "API configuration required for detailed feedback",
        examples: [],
        suggestions: []
      },
      persuasivenessImpact: {
        analysis: "API configuration required for detailed feedback",
        examples: [],
        suggestions: []
      },
      deliveryStyle: {
        analysis: "API configuration required for detailed feedback",
        examples: [],
        suggestions: []
      },
      relevanceToSpeechType: {
        analysis: "API configuration required for detailed feedback",
        examples: [],
        suggestions: []
      },
      actionableSuggestions: ["Configure OpenAI API key to enable AI-powered feedback"],
      strengths: ["Unable to analyze without API"],
      areasForImprovement: ["Unable to analyze without API"]
    };
  } else {
    try {
      const systemPrompt = getSpeechTypePrompt(speechType, topic, userSide, input.customInstructions);
      
      const feedbackCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Here is the transcription of my speech:\n\n${JSON.stringify(transcription)}\n\nPlease provide detailed feedback in the specified JSON format. Remember to be specific with examples from the speech and provide constructive, actionable feedback.` 
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
          speakerScore: 25,
          scoreJustification: "Default score due to parsing error",
          overallSummary: 'AI feedback generated but could not be parsed properly. Please try uploading your speech again.',
          structureOrganization: {
            analysis: "Unable to parse detailed feedback",
            examples: [],
            suggestions: []
          },
          argumentationEvidence: {
            analysis: "Unable to parse detailed feedback",
            examples: [],
            suggestions: []
          },
          clarityConciseness: {
            analysis: "Unable to parse detailed feedback",
            examples: [],
            suggestions: []
          },
          persuasivenessImpact: {
            analysis: "Unable to parse detailed feedback",
            examples: [],
            suggestions: []
          },
          deliveryStyle: {
            analysis: "Unable to parse detailed feedback",
            examples: [],
            suggestions: []
          },
          relevanceToSpeechType: {
            analysis: "Unable to parse detailed feedback",
            examples: [],
            suggestions: []
          },
          actionableSuggestions: ["Please try uploading your speech again"],
          strengths: ["Unable to parse feedback"],
          areasForImprovement: ["Unable to parse feedback"]
        };
      }
    } catch (error) {
      console.error('[speechFeedbackService] AI feedback generation failed:', error);
      feedback = {
        speakerScore: 0,
        scoreJustification: "Unable to provide score due to API error",
        overallSummary: `Speech analysis failed due to API error. Basic assessment: Speech about ${topic} was recorded successfully.`,
        structureOrganization: {
          analysis: "Unable to analyze due to API error",
          examples: [],
          suggestions: []
        },
        argumentationEvidence: {
          analysis: "Unable to analyze due to API error",
          examples: [],
          suggestions: []
        },
        clarityConciseness: {
          analysis: "Unable to analyze due to API error",
          examples: [],
          suggestions: []
        },
        persuasivenessImpact: {
          analysis: "Unable to analyze due to API error",
          examples: [],
          suggestions: []
        },
        deliveryStyle: {
          analysis: "Unable to analyze due to API error",
          examples: [],
          suggestions: []
        },
        relevanceToSpeechType: {
          analysis: "Unable to analyze due to API error",
          examples: [],
          suggestions: []
        },
        actionableSuggestions: ["Please try again later or contact support"],
        strengths: ["Unable to analyze"],
        areasForImprovement: ["Unable to analyze"]
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
        user_side: userSide,
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