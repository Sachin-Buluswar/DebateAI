import { Server as SocketIOServer, Socket } from 'socket.io';
import { DebateManager } from './DebateManager';
import { Participant, DebateState } from './debate-types';
import { generateSpeech } from './speech-generation';
import { generateAudioArrayBuffer, generateAudioStreamWebSocket, shouldUseWebSocket } from '@/backend/services/ttsService';
import { supabaseAdmin } from '@/backend/lib/supabaseAdmin';
import { generatePostDebateAnalysis } from './analysis';
import { ElevenLabsCrossfireManager } from './ElevenLabsCrossfireManager';
import { ErrorRecoveryManager } from './ErrorRecoveryManager';

// In-memory store for active debate sessions
const activeDebates = new Map<string, DebateManager>();
const debateSessions = new Map<string, string>(); // socket.id -> session_id
const debateTranscripts = new Map<string, string>(); // socket.id -> transcript
const crossfireManager = new ElevenLabsCrossfireManager();
const errorRecovery = new ErrorRecoveryManager();

function sanitizeForTTS(text: string): string {
  // Remove markdown bold/italic and headings
  return text
    .replace(/\*\*/g, '')
    .replace(/_/g, '')
    .replace(/\#\s?/g, '')
    .replace(/\n{2,}/g, '\n');
}

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
    console.error('Error creating debate session:', error);
    throw error;
  }
  
  return data.id;
}

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
    console.error('Error saving speech:', error);
  }
}

export function initializeSocketIO(io: SocketIOServer) {
  console.log('Socket.IO server initialized');

  io.on('connection', (socket: Socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Initialize debate adapter for compatibility with different event naming
    let adapter: any;
    try {
      const { initializeDebateAdapter } = require('@/lib/socket/debateSocketAdapter');
      adapter = initializeDebateAdapter(socket);
    } catch (error) {
      console.error('Failed to initialize debate adapter:', error);
    }

    socket.on('startDebate', async (payload: { topic: string; participants: Participant[] }) => {
      const { topic, participants } = payload;
      console.log('Starting debate on topic:', topic);
      console.log('Participants:', participants);
      
      try {
        // Create debate session in database
        const userParticipant = participants.find(p => !p.isAI);
        const sessionId = await createDebateSession(
          topic, 
          userParticipant?.team || 'PRO',
          participants.filter(p => !p.isAI && p.team === userParticipant?.team).length > 1
        );
        debateSessions.set(socket.id, sessionId);
        console.log('Created debate session:', sessionId);
        
        // Initialize transcript for this debate
        debateTranscripts.set(socket.id, '');

        const onStateChange = async (newState: DebateState, mode: string) => {
          try {
            console.log(`State change: ${newState.phase} (${mode}) - Speaker: ${newState.currentSpeakerId}`);
            socket.emit('debateStateUpdate', newState, mode);

            // If debate has ended, generate post-debate analysis
            if (newState.phase === 'ENDED' && mode === 'speech') {
              const sessionId = debateSessions.get(socket.id);
              const transcript = debateTranscripts.get(socket.id) || '';
              if (sessionId && transcript.trim()) {
                console.log('Debate ended, generating analysis...');
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
                } catch (error) {
                  console.error('Error generating post-debate analysis:', error);
                }
              }
            }

            // Only generate a new AI speech at the beginning of each speech phase, not on timer ticks.
            if (mode === 'speech') {
              const currentSpeaker = participants.find(p => p.id === newState.currentSpeakerId);
              
              if (currentSpeaker && currentSpeaker.isAI) {
                console.log(`Generating speech for AI: ${currentSpeaker.name}`);
                const currentTranscript = debateTranscripts.get(socket.id) || '';
                const rawSpeech = await generateSpeech(topic, currentSpeaker, newState.phase, currentTranscript);
                const speechText = sanitizeForTTS(rawSpeech);
                console.log(`Generated speech (${speechText.length} chars): ${speechText.substring(0, 100)}...`);
                
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
                  console.log(`Generating TTS audio for ${currentSpeaker.name}...`);
                  
                  // Check if WebSocket streaming should be used
                  if (shouldUseWebSocket()) {
                    // Use WebSocket streaming for lower latency
                    let audioSent = false;
                    
                    await errorRecovery.executeWithRetry(
                      socket.id,
                      async () => {
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
                      },
                      'tts-websocket',
                      socket
                    );
                    
                    if (audioSent) {
                      // Signal end of audio stream
                      socket.emit('aiSpeechAudioEnd');
                      console.log(`TTS audio streamed to client for ${currentSpeaker.name}`);
                    } else {
                      // WebSocket streaming failed, fall back to HTTP
                      console.warn('WebSocket streaming failed, falling back to HTTP');
                      const audioBuffer = await generateAudioArrayBuffer(speechText, currentSpeaker.name);
                      if (audioBuffer) {
                        const buffer = Buffer.from(audioBuffer);
                        socket.emit('aiSpeechAudio', buffer);
                        console.log(`TTS audio sent via HTTP for ${currentSpeaker.name}`);
                      }
                    }
                  } else {
                    // Use traditional HTTP streaming
                    const audioBuffer = await errorRecovery.executeWithRetry(
                      socket.id,
                      () => generateAudioArrayBuffer(speechText, currentSpeaker.name),
                      'tts',
                      socket
                    );
                    
                    if (audioBuffer) {
                      // Convert ArrayBuffer to Buffer for proper socket transmission
                      const buffer = Buffer.from(audioBuffer);
                      socket.emit('aiSpeechAudio', buffer);
                      console.log(`TTS audio sent to client for ${currentSpeaker.name}`);
                    } else {
                      // TTS failed, use error recovery fallback
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
                  console.log('Skipping TTS - placeholder API key detected');
                }
              }
            }
            
            // Handle crossfire mode with ElevenLabs Conversational AI
            if (mode === 'crossfire') {
              console.log('Entering crossfire phase');
              
              // Initialize ElevenLabs crossfire session with error recovery
              const sessionId = debateSessions.get(socket.id);
              if (sessionId) {
                const crossfireResult = await errorRecovery.executeWithRetry(
                  socket.id,
                  () => crossfireManager.initializeCrossfireSession(
                    socket.id,
                    topic,
                    participants,
                    // Audio callback
                    (audioBuffer) => {
                      const buffer = Buffer.from(audioBuffer);
                      socket.emit('aiSpeechAudio', buffer);
                    },
                    // Transcript callback
                    (speaker, text) => {
                      socket.emit('aiSpeech', { speaker, text });
                      // Add to transcript
                      const currentTranscript = debateTranscripts.get(socket.id) || '';
                      debateTranscripts.set(socket.id, currentTranscript + `${speaker}: ${text}\n\n`);
                      
                      // Save to database
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
                  // Crossfire failed, handle with error recovery
                  await errorRecovery.handleCrossfireError(
                    sessionId,
                    socket,
                    new Error('Failed to initialize crossfire session')
                  );
                }
              }
            }
          } catch (error) {
            console.error('Error in onStateChange:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            socket.emit('debateError', { message: 'An error occurred during debate state change', error: errorMessage });
          }
        };

        const debateManager = new DebateManager(participants, onStateChange, topic);
        activeDebates.set(socket.id, debateManager);
        
        // Start the debate
        debateManager.startDebate();
      } catch (error) {
        console.error('Error starting debate:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        socket.emit('debateError', { message: 'Failed to start debate', error: errorMessage });
      }
    });

    socket.on('pauseDebate', async () => {
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.pause();
        console.log('Debate paused');
      }
    });

    socket.on('resumeDebate', async () => {
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.resume();
        console.log('Debate resumed');
      }
    });

    socket.on('skipTurn', async () => {
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.skipCurrentTurn();
        console.log('Turn skipped');
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
          console.log('Debate saved successfully');
        } catch (error) {
          console.error('Error saving debate:', error);
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
                console.log(`State change: ${newState.phase} (${mode}) - Speaker: ${newState.currentSpeakerId}`);
                socket.emit('debateStateUpdate', newState, mode);

                // If debate has ended, generate post-debate analysis
                if (newState.phase === 'ENDED' && mode === 'speech') {
                  const sessionId = debateSessions.get(socket.id);
                  const transcript = debateTranscripts.get(socket.id) || '';
                  if (sessionId && transcript.trim()) {
                    console.log('Debate ended, generating analysis...');
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
                    } catch (error) {
                      console.error('Error generating post-debate analysis:', error);
                    }
                  }
                }

                // Only generate a new AI speech at the beginning of each speech phase, not on timer ticks.
                if (mode === 'speech') {
                  const currentSpeaker = participants.find(p => p.id === newState.currentSpeakerId);
                  
                  if (currentSpeaker && currentSpeaker.isAI) {
                    console.log(`Generating speech for AI: ${currentSpeaker.name}`);
                    const currentTranscript = debateTranscripts.get(socket.id) || '';
                    const rawSpeech = await generateSpeech(topic, currentSpeaker, newState.phase, currentTranscript);
                    const speechText = sanitizeForTTS(rawSpeech);
                    console.log(`Generated speech (${speechText.length} chars): ${speechText.substring(0, 100)}...`);
                    
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
                      console.log(`Generating TTS audio for ${currentSpeaker.name}...`);
                      
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
                            console.log(`TTS audio streamed to client for ${currentSpeaker.name}`);
                          }
                        } catch (error) {
                          console.warn('WebSocket streaming failed, falling back to HTTP:', error);
                          const audioBuffer = await generateAudioArrayBuffer(speechText, currentSpeaker.name);
                          if (audioBuffer) {
                            const buffer = Buffer.from(audioBuffer);
                            socket.emit('aiSpeechAudio', buffer);
                            console.log(`TTS audio sent via HTTP for ${currentSpeaker.name}`);
                          }
                        }
                      } else {
                        // Use traditional HTTP streaming
                        const audioBuffer = await generateAudioArrayBuffer(speechText, currentSpeaker.name);
                        
                        if (audioBuffer) {
                          // Convert ArrayBuffer to Buffer for proper socket transmission
                          const buffer = Buffer.from(audioBuffer);
                          socket.emit('aiSpeechAudio', buffer);
                          console.log(`TTS audio sent to client for ${currentSpeaker.name}`);
                        }
                      }
                    } else {
                      console.log('Skipping TTS - placeholder API key detected');
                    }
                  }
                }
              } catch (error) {
                console.error('Error in onStateChange:', error);
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
          console.log('Debate loaded successfully');
        }
      } catch (error) {
        console.error('Error loading debate:', error);
        socket.emit('debateLoaded', { success: false, error: 'Failed to load debate' });
      }
    });

    socket.on('userCrossfireAudio', (data: { audioData: ArrayBuffer }) => {
      // Forward user audio to ElevenLabs during crossfire
      if (crossfireManager.isSessionActive(socket.id)) {
        crossfireManager.sendUserAudio(socket.id, data.audioData);
      }
    });

    socket.on('userSpeech', (data: { text: string; speakerId: string; phase: string; audioBlob?: ArrayBuffer }) => {
      console.log(`User speech received from ${data.speakerId}:`, data.text.substring(0, 100));
      
      // Save user speech to database
      const sessionId = debateSessions.get(socket.id);
      if (sessionId) {
        const debateManager = activeDebates.get(socket.id);
        const speaker = debateManager?.getParticipants().find(p => p.id === data.speakerId);
        const speakerName = speaker?.name || 'User';
        
        // Save speech with enhanced metadata
        saveSpeech(sessionId, speakerName, data.speakerId, data.phase, data.text).then(async () => {
          console.log(`User speech saved for session ${sessionId}`);
          
          // Save audio recording if provided
          if (data.audioBlob) {
            try {
              // Convert ArrayBuffer to Buffer
              const audioBuffer = Buffer.from(data.audioBlob);
              const timestamp = Date.now();
              const fileName = `${sessionId}/${data.speakerId}_${data.phase}_${timestamp}.webm`;
              
              // Upload to Supabase storage
              const { error: uploadError } = await supabaseAdmin.storage
                .from('debate_audio')
                .upload(fileName, audioBuffer, {
                  contentType: 'audio/webm',
                  upsert: false
                });
              
              if (uploadError) {
                console.error('Error uploading audio:', uploadError);
                // Fallback to base64 storage for smaller files
                if (audioBuffer.length < 1024 * 1024) { // Less than 1MB
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
                // Get public URL for the uploaded file
                const { data: urlData } = supabaseAdmin.storage
                  .from('debate_audio')
                  .getPublicUrl(fileName);
                
                // Save audio record with storage URL
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
                
                console.log('Audio recording saved to storage:', fileName);
              }
            } catch (error) {
              console.error('Error saving audio recording:', error);
            }
          }
        }).catch(error => {
          console.error('Error saving user speech:', error);
        });
        
        // Add to transcript for analysis
        const currentTranscript = debateTranscripts.get(socket.id) || '';
        debateTranscripts.set(socket.id, currentTranscript + `${speakerName}: ${data.text}\n\n`);
      }
      
      // Emit speech to show user participation
      socket.emit('aiSpeech', { speaker: 'You', text: data.text });
      
      // Continue debate flow - advance to next phase/speaker
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        // Small delay to let user see their speech, then continue
        setTimeout(() => {
          // The debate manager will automatically advance when the current phase timer ends
          console.log('User speech processed, debate continues...');
        }, 2000);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      // Clean up adapter
      if (adapter && adapter.cleanup) {
        adapter.cleanup();
      }
      
      // Clean up debate manager
      const debateManager = activeDebates.get(socket.id);
      if (debateManager) {
        debateManager.endDebate();
        activeDebates.delete(socket.id);
      }
      
      // Clean up crossfire session if active
      if (crossfireManager.isSessionActive(socket.id)) {
        crossfireManager.endCrossfireSession(socket.id);
      }
      
      // Clean up error tracking
      errorRecovery.cleanupSession(socket.id);
      
      debateSessions.delete(socket.id);
      debateTranscripts.delete(socket.id);
    });
  });
} 