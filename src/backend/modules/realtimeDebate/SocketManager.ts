import { Server as SocketIOServer, Socket } from 'socket.io';
import { DebateManager } from './DebateManager';
import { Participant, DebateState } from './debate-types';
import { generateSpeech } from './speech-generation';
import { generateAudioArrayBuffer, generateAudioStreamWebSocket, shouldUseWebSocket } from '@/backend/services/ttsService';
import { supabaseAdmin } from '@/backend/lib/supabaseAdmin';
import { generatePostDebateAnalysis } from './analysis';
import { ElevenLabsCrossfireManager } from './ElevenLabsCrossfireManager';
import { ErrorRecoveryManager } from './ErrorRecoveryManager';

/**
 * SocketManager Module
 * 
 * Central hub for real-time debate orchestration using Socket.IO.
 * Manages the lifecycle of debate sessions and coordinates between
 * multiple components to deliver a seamless debate experience.
 * 
 * Architecture Overview:
 * 1. Client connects via WebSocket and initiates debate
 * 2. SocketManager creates DebateManager instance for state management
 * 3. As debate progresses, SocketManager handles:
 *    - AI speech generation using OpenAI GPT
 *    - Text-to-speech conversion using ElevenLabs
 *    - Crossfire coordination for interactive rounds
 *    - Database persistence of speeches and state
 *    - Error recovery and fallback mechanisms
 * 
 * Event Flow:
 * - Client -> Server: startDebate, pauseDebate, userSpeech, etc.
 * - Server -> Client: debateStateUpdate, aiSpeech, aiSpeechAudio, etc.
 */

/**
 * In-memory stores for managing concurrent debate sessions.
 * These maps use socket.id as the key to isolate each user's session.
 */

/** Maps socket ID to DebateManager instance for state management */
const activeDebates = new Map<string, DebateManager>();

/** Maps socket ID to database session ID for persistence */
const debateSessions = new Map<string, string>();

/** Maps socket ID to cumulative debate transcript for analysis */
const debateTranscripts = new Map<string, string>();

/** Singleton manager for ElevenLabs crossfire sessions */
const crossfireManager = new ElevenLabsCrossfireManager();

/** Singleton manager for error recovery and retry logic */
const errorRecovery = new ErrorRecoveryManager();

/**
 * Sanitize text for text-to-speech conversion.
 * 
 * Removes markdown formatting that would sound unnatural when spoken:
 * - Bold markers (**text**)
 * - Italic markers (_text_)
 * - Heading markers (# text)
 * - Multiple newlines (compressed to single)
 * 
 * @param text - Raw text with potential markdown
 * @returns Clean text suitable for TTS
 */
function sanitizeForTTS(text: string): string {
  return text
    .replace(/\*\*/g, '')     // Remove bold markers
    .replace(/_/g, '')        // Remove italic markers
    .replace(/\#\s?/g, '')    // Remove heading markers
    .replace(/\n{2,}/g, '\n'); // Compress multiple newlines
}

/**
 * Create a new debate session in the database.
 * 
 * Initializes a persistent record for tracking debate progress,
 * speeches, and analysis. The session ID is used throughout
 * the debate lifecycle for data association.
 * 
 * @param topic - The debate resolution/topic
 * @param userSide - Which side the human user is on (PRO or CON)
 * @param hasAiPartner - Whether user has an AI teammate
 * @returns Session ID for database operations
 * @throws Database error if creation fails
 */
async function createDebateSession(topic: string, userSide: 'PRO' | 'CON', hasAiPartner: boolean): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('debate_sessions')
    .insert({
      topic,
      user_side: userSide,
      has_ai_partner: hasAiPartner
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data.id;
}

/**
 * Save a speech to the database.
 * 
 * Persists both AI and human speeches for later retrieval,
 * analysis, and playback. Each speech is associated with
 * a session and includes metadata about the speaker and phase.
 * 
 * @param sessionId - Database session ID
 * @param speakerName - Display name of speaker
 * @param speakerId - Unique speaker identifier
 * @param phase - Current debate phase (e.g., 'PRO_CONSTRUCTIVE')
 * @param text - Full text of the speech
 * @param audioUrl - Optional URL to audio recording
 */
async function saveSpeech(sessionId: string, speakerName: string, speakerId: string, phase: string, text: string, audioUrl?: string) {
  const { error } = await supabaseAdmin
    .from('debate_speeches')
    .insert({
      session_id: sessionId,
      speaker_name: speakerName,
      speaker_id: speakerId,
      phase,
      speech_text: text,
      audio_url: audioUrl
    });
  
  if (error) {
  }
}

/**
 * Initialize Socket.IO server and set up event handlers.
 * 
 * This is the main entry point for real-time debate functionality.
 * Each connected client gets isolated session management through
 * their socket ID.
 * 
 * @param io - Socket.IO server instance
 */
export function initializeSocketIO(io: SocketIOServer) {

  /**
   * Handle new client connections.
   * 
   * Each connection represents a potential debate session.
   * The socket ID serves as the primary key for all session data.
   */
  io.on('connection', (socket: Socket) => {
    
    /**
     * Initialize debate adapter for backward compatibility.
     * The adapter translates between different event naming conventions
     * used by various client versions.
     */
    let adapter: { cleanup?: () => void } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initializeDebateAdapter } = require('@/lib/socket/debateSocketAdapter');
      adapter = initializeDebateAdapter(socket);
    } catch (_error) {
    }

    /**
     * Handle debate initialization.
     * 
     * Creates all necessary resources for a new debate:
     * 1. Database session for persistence
     * 2. DebateManager for state management
     * 3. Transcript storage for analysis
     * 
     * @param payload.topic - The debate resolution
     * @param payload.participants - Array of all participants (human and AI)
     */
    socket.on('startDebate', async (payload: { topic: string; participants: Participant[] }) => {
      const { topic, participants } = payload;
      
      try {
        // Create persistent session in database
        const userParticipant = participants.find(p => !p.isAI);
        const sessionId = await createDebateSession(
          topic, 
          userParticipant?.team || 'PRO',
          participants.filter(p => !p.isAI && p.team === userParticipant?.team).length > 1
        );
        debateSessions.set(socket.id, sessionId);
        
        // Initialize empty transcript for accumulating speeches
        debateTranscripts.set(socket.id, '');

        /**
         * State change callback for DebateManager.
         * 
         * This is the heart of the real-time orchestration. It handles:
         * 1. State updates to client
         * 2. AI speech generation for AI speakers
         * 3. Text-to-speech conversion
         * 4. Crossfire session initialization
         * 5. Post-debate analysis generation
         * 
         * @param newState - Updated debate state
         * @param mode - Type of update: 'speech', 'timer', 'crossfire', 'pause', 'resume'
         */
        const onStateChange = async (newState: DebateState, mode: string) => {
          try {
            
            // Always emit state updates to keep client synchronized
            socket.emit('debateStateUpdate', newState, mode);

            /**
             * Handle debate completion.
             * 
             * When debate ends, generate comprehensive analysis including:
             * - Performance scores for each participant
             * - Argument strength evaluation
             * - Speaking quality metrics
             * - Improvement suggestions
             */
            if (newState.phase === 'ENDED' && mode === 'speech') {
              const sessionId = debateSessions.get(socket.id);
              const transcript = debateTranscripts.get(socket.id) || '';
              if (sessionId && transcript.trim()) {
                try {
                  const analysis = await generatePostDebateAnalysis(topic, transcript, userParticipant?.team || 'PRO');
                  socket.emit('debateAnalysis', analysis);
                  
                  // Persist analysis for future reference
                  await supabaseAdmin
                    .from('debate_sessions')
                    .update({ 
                      analysis: analysis,
                      transcript: transcript,
                      status: 'completed'
                    })
                    .eq('id', sessionId);
                } catch (_error) {
                }
              }
            }

            /**
             * Handle AI speech generation for speech phases.
             * 
             * When it's an AI participant's turn:
             * 1. Generate contextual speech using GPT based on:
             *    - Debate topic and current phase
             *    - AI participant's personality and stance
             *    - Previous speeches in transcript
             * 2. Clean text for natural TTS output
             * 3. Send text to client immediately for display
             * 4. Generate audio asynchronously
             * 
             * Note: Only triggers on 'speech' mode to avoid regenerating
             * during timer updates.
             */
            if (mode === 'speech') {
              const currentSpeaker = participants.find(p => p.id === newState.currentSpeakerId);
              
              if (currentSpeaker && currentSpeaker.isAI) {
                
                // Get transcript for context
                const currentTranscript = debateTranscripts.get(socket.id) || '';
                
                // Generate speech using AI personality system
                const rawSpeech = await generateSpeech(topic, currentSpeaker, newState.phase, currentTranscript);
                const speechText = sanitizeForTTS(rawSpeech);
                
                // Send text immediately for responsive UI
                socket.emit('aiSpeech', { speaker: currentSpeaker.name, text: speechText });
                
                // Append to transcript
                debateTranscripts.set(socket.id, currentTranscript + `${currentSpeaker.name}: ${speechText}\n\n`);
                
                // Persist to database
                const sessionId = debateSessions.get(socket.id);
                if (sessionId) {
                  await saveSpeech(sessionId, currentSpeaker.name, currentSpeaker.id, newState.phase, speechText);
                }

                /**
                 * Text-to-Speech Generation
                 * 
                 * Converts AI speech text to audio using ElevenLabs API.
                 * Implements two strategies for optimal performance:
                 * 
                 * 1. WebSocket Streaming (preferred):
                 *    - Lower latency, chunks sent as generated
                 *    - Better for real-time experience
                 *    - Falls back to HTTP if connection fails
                 * 
                 * 2. HTTP Streaming (fallback):
                 *    - Complete audio generated before sending
                 *    - More reliable but higher latency
                 * 
                 * Error Recovery:
                 * - Automatic retry with exponential backoff
                 * - Graceful degradation if TTS fails
                 * - User notified of audio issues
                 */
                if (process.env.ELEVENLABS_API_KEY && !process.env.ELEVENLABS_API_KEY.includes('placeholder')) {
                  
                  // Choose streaming strategy based on environment
                  if (shouldUseWebSocket()) {
                    // WebSocket streaming for lower latency
                    let audioSent = false;
                    
                    await errorRecovery.executeWithRetry(
                      socket.id,
                      async () => {
                        await generateAudioStreamWebSocket(
                          speechText,
                          currentSpeaker.name,
                          'intermediate',
                          (chunk) => {
                            // Stream chunks as they arrive
                            socket.emit('aiSpeechAudioChunk', chunk);
                            audioSent = true;
                          }
                        );
                      },
                      'tts-websocket',
                      socket
                    );
                    
                    if (audioSent) {
                      // Signal stream completion
                      socket.emit('aiSpeechAudioEnd');
                    } else {
                      // Fallback to HTTP if WebSocket fails
                      const audioBuffer = await generateAudioArrayBuffer(speechText, currentSpeaker.name);
                      if (audioBuffer) {
                        const buffer = Buffer.from(audioBuffer);
                        socket.emit('aiSpeechAudio', buffer);
                      }
                    }
                  } else {
                    // HTTP streaming with retry logic
                    const audioBuffer = await errorRecovery.executeWithRetry(
                      socket.id,
                      () => generateAudioArrayBuffer(speechText, currentSpeaker.name),
                      'tts',
                      socket
                    );
                    
                    if (audioBuffer) {
                      // Convert to Buffer for Socket.IO transmission
                      const buffer = Buffer.from(audioBuffer);
                      socket.emit('aiSpeechAudio', buffer);
                    } else {
                      // TTS failed completely, use error recovery
                      const currentSessionId = debateSessions.get(socket.id);
                      if (currentSessionId) {
                        await errorRecovery.handleTTSError(
                          currentSessionId,
                          speechText,
                          currentSpeaker.name,
                          socket,
                          new Error('TTS generation failed')
                        );
                      }
                    }
                  }
                } else {
                }
              }
            }
            
            /**
             * Handle Crossfire Phases
             * 
             * Crossfire rounds are interactive Q&A sessions between teams.
             * Uses ElevenLabs Conversational AI for real-time, multi-speaker
             * dialogue with natural interruptions and back-and-forth.
             * 
             * Features:
             * - WebSocket connection to ElevenLabs for low latency
             * - AI agents represent all AI participants
             * - Natural conversation flow with interruptions
             * - Real-time transcription of all speakers
             * - Automatic speaker identification
             * 
             * Three crossfire types:
             * 1. CROSSFIRE_1: First speakers from each team
             * 2. CROSSFIRE_2: Second speakers from each team
             * 3. GRAND_CROSSFIRE: All participants
             */
            if (mode === 'crossfire') {
              
              // Initialize ElevenLabs session with retry logic
              const sessionId = debateSessions.get(socket.id);
              if (sessionId) {
                const crossfireResult = await errorRecovery.executeWithRetry(
                  socket.id,
                  () => crossfireManager.initializeCrossfireSession(
                    socket.id,
                    topic,
                    participants,
                    // Audio callback - streams audio chunks to client
                    (audioBuffer) => {
                      const buffer = Buffer.from(audioBuffer);
                      socket.emit('aiSpeechAudio', buffer);
                    },
                    // Transcript callback - captures all dialogue
                    (speaker, text) => {
                      socket.emit('aiSpeech', { speaker, text });
                      
                      // Append to running transcript
                      const currentTranscript = debateTranscripts.get(socket.id) || '';
                      debateTranscripts.set(socket.id, currentTranscript + `${speaker}: ${text}\n\n`);
                      
                      // Persist each statement
                      const currentSessionId = debateSessions.get(socket.id);
                      if (currentSessionId) {
                        saveSpeech(currentSessionId, speaker, `crossfire-${speaker}`, newState.phase, text);
                      }
                    }
                  ),
                  'crossfire',
                  socket
                );
                
                if (crossfireResult !== null) {
                  socket.emit('crossfireStarted', { phase: newState.phase });
                } else {
                  // Fallback if crossfire initialization fails
                  await errorRecovery.handleCrossfireError(
                    sessionId,
                    socket,
                    new Error('Failed to initialize crossfire session')
                  );
                }
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            socket.emit('debateError', { message: 'An error occurred during debate state change', error: errorMessage });
          }
        };

        const debateManager = new DebateManager(participants, onStateChange, topic);
        activeDebates.set(socket.id, debateManager);
        
        // Start the debate
        debateManager.startDebate();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('debateError', { message: 'Failed to start debate', error: errorMessage });
      }
    });

    socket.on('pauseDebate', async () => {
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.pause();
      }
    });

    socket.on('resumeDebate', async () => {
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.resume();
      }
    });

    socket.on('skipTurn', async () => {
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.skipCurrentTurn();
      }
    });

    socket.on('saveDebate', async () => {
      const debateManager = activeDebates.get(socket.id);
      const sessionId = debateSessions.get(socket.id);
      if (debateManager && sessionId) {
        const savedState = debateManager.saveState();
        const transcript = debateTranscripts.get(socket.id) || '';
        
        // Save to database
        try {
          await supabaseAdmin
            .from('debate_sessions')
            .update({ 
              saved_state: savedState,
              transcript: transcript,
              status: 'paused',
              last_saved_at: new Date().toISOString()
            })
            .eq('id', sessionId);
            
          socket.emit('debateSaved', { success: true, sessionId });
        } catch (_error) {
          socket.emit('debateSaved', { success: false, error: 'Failed to save debate' });
        }
      }
    });

    socket.on('loadDebate', async (data: { sessionId: string }) => {
      try {
        const { data: session, error } = await supabaseAdmin
          .from('debate_sessions')
          .select('*')
          .eq('id', data.sessionId)
          .single();
          
        if (error || !session) {
          socket.emit('debateLoaded', { success: false, error: 'Session not found' });
          return;
        }
        
        // Restore debate state
        const participants = session.saved_state?.participants || [];
        const savedState = session.saved_state;
        
        if (savedState) {
          // Create onStateChange function for loaded debate
          const createOnStateChange = (socket: Socket, topic: string, participants: Participant[], userParticipant: Participant | undefined) => {
            return async (newState: DebateState, mode: string) => {
              try {
                socket.emit('debateStateUpdate', newState, mode);

                // If debate has ended, generate post-debate analysis
                if (newState.phase === 'ENDED' && mode === 'speech') {
                  const sessionId = debateSessions.get(socket.id);
                  const transcript = debateTranscripts.get(socket.id) || '';
                  if (sessionId && transcript.trim()) {
                    try {
                      const analysis = await generatePostDebateAnalysis(topic, transcript, userParticipant?.team || 'PRO');
                      socket.emit('debateAnalysis', analysis);
                      
                      // Save analysis to database
                      await supabaseAdmin
                        .from('debate_sessions')
                        .update({ 
                          analysis: analysis,
                          transcript: transcript,
                          status: 'completed'
                        })
                        .eq('id', sessionId);
                    } catch (_error) {
                    }
                  }
                }

                // Only generate a new AI speech at the beginning of each speech phase, not on timer ticks.
                if (mode === 'speech') {
                  const currentSpeaker = participants.find(p => p.id === newState.currentSpeakerId);
                  
                  if (currentSpeaker && currentSpeaker.isAI) {
                    const currentTranscript = debateTranscripts.get(socket.id) || '';
                    const rawSpeech = await generateSpeech(topic, currentSpeaker, newState.phase, currentTranscript);
                    const speechText = sanitizeForTTS(rawSpeech);
                    
                    // Emit AI speech event with speaker and text
                    socket.emit('aiSpeech', { speaker: currentSpeaker.name, text: speechText });
                    debateTranscripts.set(socket.id, currentTranscript + `${currentSpeaker.name}: ${speechText}\n\n`);
                    
                    // Save speech to database
                    const sessionId = debateSessions.get(socket.id);
                    if (sessionId) {
                      await saveSpeech(sessionId, currentSpeaker.name, currentSpeaker.id, newState.phase, speechText);
                    }

                    // Only attempt TTS if we have a real API key
                    if (process.env.ELEVENLABS_API_KEY && !process.env.ELEVENLABS_API_KEY.includes('placeholder')) {
                      
                      // Check if WebSocket streaming should be used
                      if (shouldUseWebSocket()) {
                        // Use WebSocket streaming for lower latency
                        let audioSent = false;
                        
                        try {
                          await generateAudioStreamWebSocket(
                            speechText,
                            currentSpeaker.name,
                            'intermediate',
                            (chunk) => {
                              // Send each audio chunk as it arrives
                              socket.emit('aiSpeechAudioChunk', chunk);
                              audioSent = true;
                            }
                          );
                          
                          if (audioSent) {
                            // Signal end of audio stream
                            socket.emit('aiSpeechAudioEnd');
                          }
                        } catch (_error) {
                          const audioBuffer = await generateAudioArrayBuffer(speechText, currentSpeaker.name);
                          if (audioBuffer) {
                            const buffer = Buffer.from(audioBuffer);
                            socket.emit('aiSpeechAudio', buffer);
                          }
                        }
                      } else {
                        // Use traditional HTTP streaming
                        const audioBuffer = await generateAudioArrayBuffer(speechText, currentSpeaker.name);
                        
                        if (audioBuffer) {
                          // Convert ArrayBuffer to Buffer for proper socket transmission
                          const buffer = Buffer.from(audioBuffer);
                          socket.emit('aiSpeechAudio', buffer);
                        }
                      }
                    } else {
                    }
                  }
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                socket.emit('debateError', { message: 'An error occurred during debate state change', error: errorMessage });
              }
            };
          };
          
          const debateManager = new DebateManager(participants, createOnStateChange(socket, session.topic, participants, participants.find((p: Participant) => !p.isAI)), session.topic);
          debateManager.loadSavedState(savedState);
          
          activeDebates.set(socket.id, debateManager);
          debateSessions.set(socket.id, data.sessionId);
          debateTranscripts.set(socket.id, session.transcript || '');
          
          socket.emit('debateLoaded', { 
            success: true, 
            state: savedState.state,
            participants,
            transcript: session.transcript 
          });
        }
      } catch (_error) {
        socket.emit('debateLoaded', { success: false, error: 'Failed to load debate' });
      }
    });

    /**
     * Handle user audio during crossfire phases.
     * 
     * Forwards user's microphone audio to ElevenLabs Conversational AI
     * for real-time processing. The AI will transcribe, understand,
     * and respond naturally to user speech.
     * 
     * @param data.audioData - Raw audio buffer from user's microphone
     */
    socket.on('userCrossfireAudio', (data: { audioData: ArrayBuffer }) => {
      // Only forward if crossfire session is active
      if (crossfireManager.isSessionActive(socket.id)) {
        crossfireManager.sendUserAudio(socket.id, data.audioData);
      }
    });

    /**
     * Handle user speech submissions.
     * 
     * Processes human participant speeches during their assigned phases.
     * Includes both text and optional audio recording for analysis.
     * 
     * Flow:
     * 1. Save speech text and metadata to database
     * 2. Upload audio recording if provided
     * 3. Add to transcript for post-debate analysis
     * 4. Echo back to client for display
     * 5. Continue debate flow
     * 
     * Audio Storage Strategy:
     * - Large files: Upload to Supabase Storage bucket
     * - Small files (<1MB): Store as base64 in database
     * - Fallback handling for upload failures
     * 
     * @param data.text - Transcribed or typed speech text
     * @param data.speakerId - User's participant ID
     * @param data.phase - Current debate phase
     * @param data.audioBlob - Optional audio recording (WebM format)
     */
    socket.on('userSpeech', (data: { text: string; speakerId: string; phase: string; audioBlob?: ArrayBuffer }) => {
      
      // Get session context
      const sessionId = debateSessions.get(socket.id);
      if (sessionId) {
        const debateManager = activeDebates.get(socket.id);
        const speaker = debateManager?.getParticipants().find(p => p.id === data.speakerId);
        const speakerName = speaker?.name || 'User';
        
        // Persist speech with full metadata
        saveSpeech(sessionId, speakerName, data.speakerId, data.phase, data.text).then(async () => {
          
          // Handle audio recording if provided
          if (data.audioBlob) {
            try {
              const audioBuffer = Buffer.from(data.audioBlob);
              const timestamp = Date.now();
              const fileName = `${sessionId}/${data.speakerId}_${data.phase}_${timestamp}.webm`;
              
              // Attempt cloud storage upload
              const { error: uploadError } = await supabaseAdmin.storage
                .from('debate_audio')
                .upload(fileName, audioBuffer, {
                  contentType: 'audio/webm',
                  upsert: false
                });
              
              if (uploadError) {
                
                // Fallback: Store small files as base64
                if (audioBuffer.length < 1024 * 1024) { // 1MB limit
                  const audioBase64 = audioBuffer.toString('base64');
                  await supabaseAdmin
                    .from('audio_recordings')
                    .insert({
                      session_id: sessionId,
                      speaker_id: data.speakerId,
                      speaker_name: speakerName,
                      phase: data.phase,
                      audio_data: audioBase64,
                      duration_seconds: null
                    });
                }
              } else {
                // Success: Get public URL and save reference
                const { data: urlData } = supabaseAdmin.storage
                  .from('debate_audio')
                  .getPublicUrl(fileName);
                
                await supabaseAdmin
                  .from('audio_recordings')
                  .insert({
                    session_id: sessionId,
                    speaker_id: data.speakerId,
                    speaker_name: speakerName,
                    phase: data.phase,
                    audio_url: urlData.publicUrl,
                    duration_seconds: null
                  });
                
                
              }
            } catch (_error) {
              // Audio upload is best-effort; failure should not disrupt the debate session
            }
          }
        }).catch(_error => {
          // Speech persistence is best-effort during live debate
        });
        
        // Append to running transcript
        const currentTranscript = debateTranscripts.get(socket.id) || '';
        debateTranscripts.set(socket.id, currentTranscript + `${speakerName}: ${data.text}\n\n`);
      }
      
      // Echo speech back for UI display
      socket.emit('aiSpeech', { speaker: 'You', text: data.text });
      
      // Let debate flow continue naturally
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        // Brief delay for UI feedback before continuing
        setTimeout(() => {
        }, 2000);
      }
    });

    /**
     * Handle client disconnection.
     * 
     * Performs comprehensive cleanup to prevent memory leaks:
     * 1. End active debate gracefully
     * 2. Close crossfire WebSocket connections
     * 3. Clear session data from memory
     * 4. Clean up error recovery state
     * 
     * Note: Database records are preserved for historical access.
     */
    socket.on('disconnect', () => {
      
      // Clean up adapter if initialized
      if (adapter && adapter.cleanup) {
        adapter.cleanup();
      }
      
      // End debate if active
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.endDebate();
        activeDebates.delete(socket.id);
      }
      
      // Close crossfire WebSocket if active
      if (crossfireManager.isSessionActive(socket.id)) {
        crossfireManager.endCrossfireSession(socket.id);
      }
      
      // Clean up error recovery tracking
      errorRecovery.cleanupSession(socket.id);
      
      // Clear session data from memory
      debateSessions.delete(socket.id);
      debateTranscripts.delete(socket.id);
    });
  });
} 