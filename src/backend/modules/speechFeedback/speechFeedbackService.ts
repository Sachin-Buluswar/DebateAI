/**
 * Speech Feedback Service
 * Extracted core logic for processing speech feedback that can be called from Next.js API routes
 */

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import { getAudioDuration } from '@/backend/utils/audioUtils';
import { openAIService } from '@/backend/services/openaiService';
import { aiLogger as logger } from '@/lib/monitoring/logger';
import { 
  standardizeToPercentage, 
  nsdaToPercentage,
  getStandardizedScore,
  extractScoreFromFeedback 
} from '@/utils/scoreStandardization';

// Storage constants
export const SPEECH_BUCKET = 'speech_audio';
export const MAX_RECORDING_LENGTH_MINUTES = 70;
export const MAX_USER_STORAGE_BYTES = 600 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024;
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

// Initialize clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Supabase credentials missing');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface SpeechFeedbackInput {
  audioBuffer: Buffer;
  filename: string;
  mimeType: string;
  topic: string;
  userId: string;
  speechType?: string;
  userSide?: string;
  skillLevel?: 'novice' | 'intermediate' | 'advanced';
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
 * Get skill level modifier for the prompt
 */
function getSkillLevelModifier(skillLevel: 'novice' | 'intermediate' | 'advanced' = 'intermediate'): string {
  const modifiers = {
    novice: `
SKILL LEVEL: NOVICE DEBATER (First year, learning fundamentals)

Adjust your feedback for a beginner:
- Use simple, clear language - explain debate terms when you use them
- Focus on fundamental skills: structure, clarity, time management, basic argumentation
- Be HIGHLY encouraging - celebrate effort and small improvements enthusiastically
- Typical scoring range: 26-28 (only go below 26 for serious issues, rarely above 28)
- Provide very detailed step-by-step instructions in all suggestions
- Example good feedback: "Great job making eye contact! To improve, try pausing for 2 seconds after each main point to let it sink in."
- Avoid overwhelming with advanced strategy or complex debate theory
- Emphasize progress: "You're building important skills!"
- Focus on 2-3 main improvements rather than listing many issues`,

    intermediate: `
SKILL LEVEL: INTERMEDIATE DEBATER (1-2 years experience)

Adjust your feedback for developing skills:
- Use standard debate terminology with brief clarification when helpful
- Balance fundamentals with strategic thinking
- Mix encouragement with constructive criticism equally
- Typical scoring range: 26-29 (use most of the range appropriately)
- Provide clear but concise implementation steps
- Example: "Your link chain needs strengthening - add an internal link between economic decline and conflict. Practice by writing out each step of causation."
- Introduce advanced concepts gradually with explanations
- Emphasize growth: "You're ready to take your skills to the next level!"
- Can handle 4-5 areas for improvement`,

    advanced: `
SKILL LEVEL: ADVANCED DEBATER (Varsity level, 2+ years, competitive)

Adjust your feedback for competitive excellence:
- Use sophisticated debate terminology freely without explanation
- Focus on nuanced strategy, marginal gains, and advanced techniques
- Be direct and critically honest while remaining constructive
- Use full scoring range: 25-30 (apply high standards consistently)
- Provide strategic insights and advanced tactical suggestions
- Example: "Your probabilistic weighing in the 2AR failed to engage their delink on structural violence - consider preempting this in summary"
- Compare to top tournament performances when relevant
- Emphasize refinement: "These adjustments will give you a competitive edge"
- Can handle comprehensive critique across all areas`
  };
  
  return modifiers[skillLevel] || modifiers.intermediate;
}

/**
 * Get training plan instructions based on skill level
 */
function getTrainingPlanInstructions(skillLevel: 'novice' | 'intermediate' | 'advanced' = 'intermediate'): string {
  const trainingInstructions = {
    novice: `
TRAINING PLAN FOR NOVICE (Generate 2-3 exercises):
Based on the identified weaknesses, create basic exercises:
- Focus on fundamentals: flowing, time management, basic rebuttals, speaking clearly
- Make instructions VERY detailed with examples  
- Each exercise 5-10 minutes
- Include encouragement
- Example exercise: "Basic Flowing Drill: 1) Get a notebook, 2) Draw 4 columns for each speaker, 3) Watch a sample speech and write one key word per argument, 4) Practice daily for 10 minutes"
- Weekly goals should be achievable and build confidence`,
    
    intermediate: `
TRAINING PLAN FOR INTERMEDIATE (Generate 3-4 exercises):
Based on the identified weaknesses, create targeted exercises:
- Focus on: weighing mechanisms, impact calc, cross-examination, efficiency
- Balance detail with assumed knowledge
- Each exercise 10-15 minutes  
- Include self-assessment metrics
- Example exercise: "Impact Weighing Drill: 1) List 3 impacts from your case, 2) Compare on magnitude/probability/timeframe, 3) Write 30-second weighing overview, 4) Record and refine"
- Weekly goals should push consistent improvement`,
    
    advanced: `
TRAINING PLAN FOR ADVANCED (Generate 3-5 exercises):
Based on the identified weaknesses, create sophisticated exercises:
- Focus on: meta-weighing, judge adaptation, round vision, speed with clarity
- Be concise but strategic
- Each exercise 15-20 minutes
- Include tournament prep elements
- Example exercise: "Crystallization Practice: 1) Identify 2 key voters, 2) Write 90-second overview, 3) Include offensive/defensive balance, 4) Practice at tournament speed"
- Weekly goals should target tournament success`
  };
  
  return trainingInstructions[skillLevel] || trainingInstructions.intermediate;
}

/**
 * Get the system prompt for different speech types
 */
function getSpeechTypePrompt(speechType: string, topic: string, userSide?: string, customInstructions?: string, skillLevel?: 'novice' | 'intermediate' | 'advanced'): string {
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
  const skillModifier = getSkillLevelModifier(skillLevel || 'intermediate');
  const trainingPlanInstructions = getTrainingPlanInstructions(skillLevel || 'intermediate');
  
  return `${specificPrompt}

${skillModifier}

${trainingPlanInstructions}

${customInstructions ? `Additional instructions from the user: ${customInstructions}\n` : ''}

You must provide COMPREHENSIVE feedback as an expert debate coach would. Be specific with examples from the speech. Your feedback should be constructive, detailed, and actionable.

IMPORTANT SCORING GUIDELINES:
- Assign speaker points based on ACTUAL performance quality
- Use the FULL range of scores appropriately:
  * 29.5-30: Exceptional, tournament-winning quality speech
  * 28.5-29: Excellent speech with minor flaws
  * 27.5-28: Good speech with some areas for improvement
  * 26.5-27: Average speech with notable weaknesses
  * 25.5-26: Below average with significant issues
  * 25: Poor performance with major problems
- DO NOT default to 27.5 - evaluate each speech individually
- Consider ALL aspects: content, delivery, strategy, and execution
- Be honest and fair - inflated scores don't help students improve

IMPORTANT: For ALL suggestions, provide detailed HOW-TO instructions, not just WHAT to improve. Each suggestion must include:
1. The specific technique or method (WHAT)
2. Step-by-step instructions (HOW - be very specific with 2-3 clear steps)
3. When to use it (WHEN - in what context or speech section)
4. A practice drill or exercise (PRACTICE - specific activity with frequency/duration)

Example format: "HOW TO improve signposting: 1) Start each contention with 'My [first/second] argument is...', 2) Use transitional phrases like 'This matters because...', 3) Practice by recording your contentions with clear markers. Do this drill for 10 minutes before each practice round."

Analyze the transcription and provide feedback in JSON format with these exact fields:
{
  "speakerScore": 0,  // NSDA speaker points (25-30, ONLY half-points: 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5, or 30) - BASE ON ACTUAL PERFORMANCE
  "scoreJustification": "Explain why this SPECIFIC score was awarded, referencing concrete strengths and weaknesses from the speech",
  "overallSummary": "2-3 paragraph comprehensive summary of the speech performance, highlighting key strengths and areas for improvement",
  "structureOrganization": {
    "analysis": "Detailed analysis of speech structure, flow, transitions, and organization",
    "examples": ["Specific example from speech showing good/poor structure", "Another example"],
    "suggestions": [
      "Detailed HOW-TO instruction with specific steps. Include: 1) WHAT to do, 2) HOW to do it (2-3 steps), 3) WHEN to use it, 4) Practice tip",
      "Another detailed suggestion following same format"
    ]
  },
  "argumentationEvidence": {
    "analysis": "Detailed analysis of argument quality, evidence use, warrants, and logical reasoning",
    "examples": ["Quote or paraphrase showing strong/weak argumentation", "Example of evidence use"],
    "suggestions": [
      "Detailed HOW-TO for stronger arguments. Include: 1) WHAT to improve, 2) HOW (2-3 specific steps), 3) WHEN to apply, 4) Practice drill",
      "Specific technique for evidence usage with step-by-step instructions and practice method"
    ]
  },
  "clarityConciseness": {
    "analysis": "Analysis of clarity, word economy, avoiding redundancy, and message precision",
    "examples": ["Example of clear/unclear communication from the speech", "Instance of redundancy"],
    "suggestions": [
      "HOW TO improve clarity: 1) Use signposting ('First', 'Second'), 2) State claim before evidence, 3) Practice with 30-second summaries daily",
      "TECHNIQUE for conciseness: 1) Remove filler words, 2) Use active voice, 3) Drill by recording and re-recording same argument in less time"
    ]
  },
  "persuasivenessImpact": {
    "analysis": "Analysis of persuasive techniques, impact calculus, and emotional appeal",
    "examples": ["Example of effective/ineffective persuasion", "Impact comparison attempt"],
    "suggestions": [
      "PERSUASION METHOD: 1) Start with impact, 2) Use comparative language ('more important than...'), 3) Practice with weighing drills - 5 min daily",
      "IMPACT FRAMING: 1) Quantify impacts, 2) Use timeframe/probability/magnitude, 3) Practice explaining why your impact outweighs in 30 seconds"
    ]
  },
  "deliveryStyle": {
    "analysis": "Analysis of speaking pace, tone variation, confidence, and vocal delivery",
    "examples": ["Noted delivery characteristic", "Specific moment of strong/weak delivery"],
    "suggestions": [
      "DELIVERY DRILL: 1) Record yourself, 2) Mark pauses with // in script, 3) Practice varying pace - slow for impacts, faster for rebuttals",
      "VOCAL TECHNIQUE: 1) Stand while practicing, 2) Project to back wall, 3) Do tongue twisters before rounds for articulation"
    ]
  },
  "relevanceToSpeechType": {
    "analysis": "How well the speech fulfilled the specific requirements of a ${speechType}",
    "examples": ["Example showing understanding/misunderstanding of speech type", "Another example"],
    "suggestions": [
      "SPEECH TYPE MASTERY: 1) Template the structure, 2) Time each section precisely, 3) Practice transitions between sections 10x before rounds",
      "KEY ELEMENTS CHECKLIST: 1) Create a pre-round checklist, 2) Review after each practice, 3) Record yourself hitting all elements in order"
    ]
  },
  "actionableSuggestions": [
    "TOP PRIORITY - Include specific HOW-TO: What skill needs work + 3-step practice plan + daily 10-minute drill",
    "SECOND PRIORITY - Actionable technique: Specific weakness + method to address + practice frequency (e.g., 'before each round')",
    "THIRD PRIORITY - Targeted improvement: Area to develop + exercise/drill + success metric to track progress",
    "LONG-TERM GOAL - Strategic development: Advanced skill + monthly milestone + specific resources or exercises to use"
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
  ],
  "trainingPlan": {
    "exercises": [
      {
        "title": "Name of the exercise (e.g., 'Impact Weighing Drill')",
        "focus": "Specific skill this targets (e.g., 'Comparative analysis')",
        "difficulty": "appropriate level based on skill level",
        "duration": "Time needed (e.g., '10-15 minutes')",
        "instructions": [
          "Step 1: Specific first step",
          "Step 2: Next action to take",
          "Step 3: Final step"
        ],
        "example": "Brief example of successful execution",
        "metrics": ["How to measure improvement", "Success indicators"]
      }
    ],
    "weeklyGoals": [
      "Specific goal 1 for this week",
      "Specific goal 2 for this week",
      "Specific goal 3 for this week"
    ],
    "progressTracking": "How to measure overall improvement over time"
  }
}`
}

/**
 * Main speech feedback processing function
 */
export async function processSpeechFeedback(input: SpeechFeedbackInput): Promise<SpeechFeedbackResult> {
  const { audioBuffer, filename, topic, userId, speechType = 'debate', userSide, skillLevel = 'intermediate' } = input;
  
  // Sanitize filename for logging (prevent log injection)
  const sanitizedFilename = filename.replace(/[^\w.-]/g, '_');
  console.log(`[speechFeedbackService] Processing ${sanitizedFilename} for user ${userId}`);
  
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
  // Sanitize fileId to prevent path traversal
  const sanitizedFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, '');
  const tempFilePath = `/tmp/${sanitizedFileId}.mp3`;
  
  // Write buffer to temporary file
  await fs.writeFile(tempFilePath, audioBuffer);
  
  // Get actual audio duration using improved detection
  const durationSeconds = await getAudioDuration(tempFilePath);
  console.log(`[speechFeedbackService] Detected audio duration: ${durationSeconds} seconds`);
  
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
        skill_level: skillLevel,
        feedback: { 
          message: 'Audio file too large for automated feedback.',
          standardizedScore: 0 // Include standardized score even for large files
        },
        overall_score: 0, // Populate the overall_score column
        audio_url: audioUrl,
        transcription: null,
        file_size_bytes: processedFileSize,
        duration_seconds: processedAudio.durationSeconds || 60 // Use actual duration
      })
      .select('id')
      .single();
    
    if (dbError) throw dbError;
    
    // Cleanup
    await fs.unlink(processedAudio.filePath).catch(() => {});
    
    return {
      feedback: { 
        speakerScore: 25.0, // Minimum NSDA score (half-point scoring)
        standardizedScore: 0, // 0% in standardized format
        scoreJustification: 'File too large for automated analysis',
        overallSummary: 'Audio file uploaded successfully but is too large for automated feedback.',
        message: 'Audio file too large for automated feedback.' 
      },
      audioUrl,
      feedbackId: insertedRecord?.id
    };
  }
  
  // Transcribe audio using OpenAI Whisper with error recovery
  let transcription: any;
  const fallbackTranscription = {
    text: `[Transcription temporarily unavailable] Speech about ${topic} by ${userSide || 'speaker'} - Duration: ${Math.round(processedAudio.durationSeconds)} seconds.`,
    segments: [],
    duration: processedAudio.durationSeconds
  };
  
  try {
    logger.info('Starting audio transcription', {
      userId,
      metadata: {
        fileId: processedAudio.fileId,
        duration: processedAudio.durationSeconds
      }
    });
    
    const audioFileStream = createReadStream(processedAudio.filePath);
    
    const whisperResponse = await openAIService.createTranscription({
      file: audioFileStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
    }, {
      fallbackResponse: fallbackTranscription
    });
    
    transcription = {
      ...whisperResponse,
      duration: (whisperResponse as any).duration || processedAudio.durationSeconds
    };
    
    logger.info('Transcription completed successfully', {
      metadata: {
        textLength: transcription.text?.length,
        segments: transcription.segments?.length
      }
    });
  } catch (error) {
    logger.error('Transcription failed', error as Error, {
      metadata: {
        fileId: processedAudio.fileId
      }
    });
    
    transcription = fallbackTranscription;
  }
  
  // Generate AI feedback using GPT-4o with structured output
  let feedback: any;
  const fallbackFeedback = {
      speakerScore: 25.0,
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
  
  try {
    const systemPrompt = getSpeechTypePrompt(speechType, topic, userSide, input.customInstructions, skillLevel);
    
    logger.info('Generating AI feedback', {
      metadata: {
        speechType,
        topic,
        transcriptionLength: transcription.text?.length
      }
    });
    
    const feedbackCompletion = await openAIService.createChatCompletion({
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
    }, {
      fallbackResponse: JSON.stringify(fallbackFeedback)
    });
    
    const feedbackContent = feedbackCompletion.choices[0].message.content;
    
    try {
      feedback = JSON.parse(feedbackContent || '{}');
      
      // Standardize the score immediately after parsing
      const standardizedScore = feedback.speakerScore 
        ? nsdaToPercentage(feedback.speakerScore)
        : standardizeToPercentage(feedback.score) || 0;
      
      // Add standardized score to feedback object
      feedback.standardizedScore = standardizedScore;
      
      logger.info('AI feedback generated successfully', {
        metadata: {
          speakerScore: feedback.speakerScore,
          standardizedScore: standardizedScore
        }
      });
    } catch (parseError) {
      logger.error('Failed to parse AI feedback', parseError as Error, {
        metadata: {
          contentSnippet: feedbackContent?.substring(0, 200)
        }
      });
        feedback = {
          speakerScore: 25,
          standardizedScore: 0, // 25 NSDA = 0%
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
        speakerScore: 25, // Minimum NSDA score
        standardizedScore: 0, // 0% standardized
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
  
  // Save to database with standardized score
  let insertedRecord;
  try {
    // Extract and standardize the score for database storage
    const standardizedScore = extractScoreFromFeedback(feedback) || 0;
    const overallScore = Math.round(standardizedScore); // Round for integer column
    
    console.log(`[speechFeedbackService] Storing feedback with standardized score: ${overallScore}%`);
    
    const { data, error: dbError } = await supabaseAdmin
      .from('speech_feedback')
      .insert({
        user_id: userId,
        topic,
        speech_type: speechType,
        user_side: userSide,
        skill_level: skillLevel,
        feedback: {
          ...feedback,
          standardizedScore: standardizedScore // Ensure standardized score is in JSON
        },
        overall_score: overallScore, // Populate the overall_score column!
        audio_url: audioUrl,
        transcription: JSON.stringify(transcription),
        file_size_bytes: processedFileSize,
        duration_seconds: processedAudio.durationSeconds || 60 // Use actual duration with fallback
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
      segments: transcription.segments?.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text
      })) || []
    } : undefined
  };
}