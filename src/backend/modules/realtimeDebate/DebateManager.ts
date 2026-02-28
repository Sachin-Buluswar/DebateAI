import {
  DebatePhase,
  Participant,
  DebateState,
  PHASE_TIMINGS,
  PHASE_ORDER,
  getSpeakerForPhase,
} from '@/backend/modules/realtimeDebate/debate-types';

/**
 * SavedState Interface
 * 
 * Represents a complete snapshot of a debate session that can be persisted and restored.
 * This enables users to save their debate progress and resume later.
 * 
 * @property state - Complete debate state including phase, timings, and current speaker
 * @property participants - Array of all debate participants with their roles and teams
 * @property pausedRemainingTime - Seconds remaining in current phase when paused (null if not paused)
 * @property isPaused - Whether the debate is currently paused
 */
type SavedState = {
  state: DebateState;
  participants: Participant[];
  pausedRemainingTime: number | null;
  isPaused: boolean;
};

/**
 * DebateManager Class
 * 
 * Core orchestration engine for debate sessions. Implements a state machine pattern
 * to manage the complex flow of a formal debate through multiple phases.
 * 
 * Key Responsibilities:
 * 1. Phase Management - Transitions through debate phases in correct order
 * 2. Timing Control - Enforces time limits for each phase with countdown timers
 * 3. Speaker Assignment - Determines which participant speaks in each phase
 * 4. State Persistence - Supports saving/loading debate state for resumption
 * 5. Event Notification - Notifies listeners of state changes via callbacks
 * 
 * The debate follows a structured format:
 * - Constructive speeches (PRO → CON → PRO → CON)
 * - Crossfire rounds (interactive Q&A between teams)
 * - Rebuttal speeches (CON → PRO → CON → PRO)
 * - Summary speeches (PRO → CON)
 * - Grand crossfire (all participants)
 * - Final focus speeches (CON → PRO)
 * 
 * State Transitions:
 * Each phase has a fixed duration. When time expires, the manager automatically
 * transitions to the next phase in the sequence until the debate ends.
 */
export class DebateManager {
  /**
   * Current debate state - the single source of truth for debate progress.
   * Includes current phase, speaker, timings, and pause/end status.
   */
  private state: DebateState;
  
  /**
   * Array of all debate participants (humans and AI).
   * Each participant has an ID, name, team (PRO/CON), and isAI flag.
   */
  private participants: Participant[];
  
  /**
   * Timer for the current phase - fires when phase time expires.
   * Cleared and reset when transitioning between phases.
   */
  private turnTimer: NodeJS.Timeout | null = null;
  
  /**
   * Interval timer that updates remaining time every second.
   * Used for countdown display and periodic state updates.
   */
  private phaseInterval: NodeJS.Timeout | null = null;
  
  /**
   * Stores remaining seconds when debate is paused.
   * Used to resume timer from correct position.
   */
  private pausedRemainingTime: number | null = null;
  
  /**
   * Callback function invoked on any state change.
   * @param newState - Updated debate state
   * @param mode - Type of change: 'speech' (new phase), 'timer' (countdown), 'crossfire', 'pause', 'resume'
   */
  private onStateChange: (newState: DebateState, mode: string) => void;
  
  /**
   * Internal pause state - prevents timer updates when true.
   */
  private isPaused: boolean = false;

  /**
   * Initialize a new debate session.
   * 
   * Sets up the initial state with the first phase (PRO_CONSTRUCTIVE) and
   * assigns the first speaker based on debate rules.
   * 
   * @param participants - Array of all debate participants
   * @param onStateChange - Callback for state change notifications
   * @param topic - The debate topic/resolution
   */
  constructor(
    participants: Participant[],
    onStateChange: (newState: DebateState, mode: string) => void,
    topic: string,
  ) {
    this.participants = participants;
    this.onStateChange = onStateChange;

    // Always start with PRO team's first constructive speech
    const initialPhase = DebatePhase.PRO_CONSTRUCTIVE;
    
    // Initialize state with first speaker and phase timings
    this.state = {
      topic,
      phase: initialPhase,
      currentSpeakerId: getSpeakerForPhase(initialPhase, this.participants) || '',
      turnStartTime: null,
      phaseStartTime: Date.now(),
      remainingTime: PHASE_TIMINGS[initialPhase] / 1000, // Convert ms to seconds
      isPaused: false,
      isEnded: false,
    };
  }

  /**
   * Start the debate session.
   * 
   * Begins execution of the first phase (PRO_CONSTRUCTIVE).
   * This method should be called after all participants are ready.
   */
  public startDebate(): void {
    this.executeCurrentPhase();
  }

  /**
   * End the debate immediately.
   * 
   * Stops all timers, sets phase to ENDED, and notifies listeners.
   * This can be called at any point to terminate the debate early.
   * Once ended, the debate cannot be resumed.
   */
  public endDebate(): void {
    this.clearTimers();
    this.state.phase = DebatePhase.ENDED;
    this.state.remainingTime = 0;
    this.state.isEnded = true;
    this.onStateChange(this.state, 'speech');
  }

  /**
   * Execute the current debate phase.
   * 
   * Central method that sets up timers and state for each phase.
   * Distinguishes between speech phases (single speaker) and crossfire
   * phases (interactive discussion) to handle them differently.
   * 
   * This method is called:
   * 1. When debate starts
   * 2. After each phase transition
   * 3. When resuming from pause
   */
  private executeCurrentPhase(): void {
    // Clear any existing timers to prevent overlap
    this.clearTimers();
    
    // Don't execute if debate has ended
    if (this.state.phase === DebatePhase.ENDED) {
      return;
    }

    // Route to appropriate handler based on phase type
    if (this.isCrossfirePhase(this.state.phase)) {
      this.handleCrossfirePhase();
    } else {
      this.handleSpeechPhase();
    }
  }

  /**
   * Handle execution of speech phases.
   * 
   * Speech phases have a single designated speaker who delivers prepared remarks.
   * The phase automatically advances when time expires.
   * 
   * Sets up:
   * 1. Phase duration and countdown timer
   * 2. Current speaker assignment based on phase rules
   * 3. Timeout for automatic phase transition
   * 4. Interval for countdown updates (every second)
   * 
   * Timer updates are throttled to every 5 seconds to reduce event noise.
   */
  private handleSpeechPhase(): void {
    // Get duration for this phase type (in milliseconds)
    const phaseDuration = PHASE_TIMINGS[this.state.phase];
    this.state.remainingTime = phaseDuration / 1000; // Convert to seconds
    
    // Assign speaker for this phase based on debate rules
    this.state.currentSpeakerId = getSpeakerForPhase(
      this.state.phase,
      this.participants,
    ) || '';

    
    // Notify listeners that a new speech phase has begun
    this.onStateChange(this.state, 'speech');

    // Set timer to advance to next phase when time expires
    this.turnTimer = setTimeout(() => this.transitionToNextPhase(), phaseDuration);
    
    // Update countdown every second
    this.phaseInterval = setInterval(() => {
      this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
      
      // Only emit timer updates every 5 seconds to reduce noise
      if (this.state.remainingTime % 5 === 0) {
        this.onStateChange(this.state, 'timer');
      }
    }, 1000);
  }

  /**
   * Handle execution of crossfire phases.
   * 
   * Crossfire phases are interactive Q&A sessions between opposing teams.
   * Unlike speech phases, multiple participants can speak.
   * 
   * Sets speaker ID to 'CROSSFIRE' to indicate multi-speaker mode.
   * The SocketManager handles the actual crossfire implementation
   * using ElevenLabs Conversational AI for real-time interaction.
   * 
   * Three types of crossfire:
   * 1. CROSSFIRE_1 - Between first speakers of each team
   * 2. CROSSFIRE_2 - Between second speakers of each team  
   * 3. GRAND_CROSSFIRE - All participants can speak
   */
  private handleCrossfirePhase(): void {
    const phaseDuration = PHASE_TIMINGS[this.state.phase];
    this.state.remainingTime = phaseDuration / 1000;
    
    // Special speaker ID indicates crossfire mode
    this.state.currentSpeakerId = 'CROSSFIRE';

    
    // Notify with 'crossfire' mode to trigger special handling
    this.onStateChange(this.state, 'crossfire');

    // Set up phase timer and countdown (same as speech phases)
    this.turnTimer = setTimeout(() => this.transitionToNextPhase(), phaseDuration);
    this.phaseInterval = setInterval(() => {
      this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
      if (this.state.remainingTime % 5 === 0) {
        this.onStateChange(this.state, 'timer');
      }
    }, 1000);
  }

  /**
   * Check if a phase is a crossfire (interactive) phase.
   * 
   * @param phase - The debate phase to check
   * @returns true if phase is any type of crossfire, false otherwise
   */
  private isCrossfirePhase(phase: DebatePhase): boolean {
    return [
      DebatePhase.CROSSFIRE_1,
      DebatePhase.CROSSFIRE_2,
      DebatePhase.GRAND_CROSSFIRE,
    ].includes(phase);
  }

  /**
   * Transition to the next phase in the debate sequence.
   * 
   * Uses PHASE_ORDER array to determine the next phase.
   * If no next phase exists, ends the debate.
   * 
   * This method is called:
   * 1. When phase timer expires
   * 2. When skip button is pressed
   * 
   * After updating the phase, immediately executes the new phase.
   */
  private transitionToNextPhase(): void {
    const currentPhaseIndex = PHASE_ORDER.indexOf(this.state.phase);
    const nextPhase = PHASE_ORDER[currentPhaseIndex + 1] || DebatePhase.ENDED;

    this.state.phase = nextPhase;
    
    // Recursively execute the new phase
    this.executeCurrentPhase();
  }

  /**
   * Clear all active timers.
   * 
   * Must be called before setting new timers to prevent:
   * 1. Multiple timers running simultaneously
   * 2. Memory leaks from orphaned timers
   * 3. Incorrect phase transitions
   * 
   * Called when:
   * - Transitioning phases
   * - Pausing debate
   * - Ending debate
   */
  private clearTimers(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.phaseInterval) {
      clearInterval(this.phaseInterval);
      this.phaseInterval = null;
    }
  }

  public getState(): DebateState {
    return { ...this.state };
  }

  public getParticipants(): Participant[] {
    return this.participants;
  }

  private advancePhase(): void {
    this.transitionToNextPhase();
  }

  /**
   * Pause the debate.
   * 
   * Stops all timers and saves the current remaining time.
   * The debate can be resumed later from the exact same position.
   * 
   * State preservation:
   * - Current phase remains unchanged
   * - Remaining time is saved
   * - All timers are cleared
   * 
   * No effect if already paused.
   */
  pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.state.isPaused = true;
      
      // Save current remaining time for resume
      this.pausedRemainingTime = this.state.remainingTime;
      
      // Stop all timers
      this.clearTimers();
      
      
      this.onStateChange(this.state, 'pause');
    }
  }

  /**
   * Resume a paused debate.
   * 
   * Restores timers from the saved position and continues countdown.
   * The phase timer is set to fire after the remaining time expires.
   * 
   * Timer restoration:
   * 1. Phase timer - Set to remaining duration
   * 2. Countdown interval - Resumes 1-second updates
   * 
   * No effect if not currently paused.
   */
  resume(): void {
    if (this.isPaused && this.pausedRemainingTime !== null) {
      
      // Clear pause flags
      this.isPaused = false;
      this.state.isPaused = false;
      
      // Restore remaining time
      this.state.remainingTime = this.pausedRemainingTime;
      
      // Set up phase timer for remaining duration
      const remainingMs = this.pausedRemainingTime * 1000;
      this.turnTimer = setTimeout(() => this.transitionToNextPhase(), remainingMs);
      
      // Resume countdown updates
      this.phaseInterval = setInterval(() => {
        this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
        if (this.state.remainingTime % 5 === 0) {
          this.onStateChange(this.state, 'timer');
        }
      }, 1000);
      
      // Clear saved time
      this.pausedRemainingTime = null;
      
      // Notify listeners
      this.onStateChange(this.state, 'resume');
    }
  }

  private startCrossfirePhase(): void {
    this.phaseInterval = setInterval(() => {
      this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
      // Only emit timer updates every 5 seconds to reduce console spam
      if (this.state.remainingTime % 5 === 0) {
        this.onStateChange(this.state, 'timer');
      }
      
      if (this.state.remainingTime === 0 && this.phaseInterval) {
        clearInterval(this.phaseInterval);
        this.phaseInterval = null;
        this.advancePhase();
      }
    }, 1000);
  }

  /**
   * Skip the current phase/turn.
   * 
   * Immediately advances to the next phase without waiting for timer.
   * Useful for:
   * - Testing debate flow
   * - Skipping if speaker is unavailable
   * - User-initiated phase advancement
   * 
   * Cannot skip if debate is paused or ended.
   */
  public skipCurrentTurn(): void {
    if (this.state.isPaused || this.state.isEnded) {
      return;
    }

    
    // Clear existing timers
    this.clearTimers();
    
    // Advance to next phase
    this.transitionToNextPhase();
  }

  /**
   * Save current debate state for persistence.
   * 
   * Creates a complete snapshot that can be stored in a database
   * and used to restore the debate session later.
   * 
   * Includes:
   * - Current phase and speaker
   * - All timing information
   * - Participant details
   * - Pause state if applicable
   * 
   * @returns Complete state snapshot
   */
  public saveState(): SavedState {
    return {
      state: this.getState(),
      participants: this.getParticipants(),
      pausedRemainingTime: this.pausedRemainingTime,
      isPaused: this.isPaused
    };
  }

  /**
   * Restore debate from saved state.
   * 
   * Loads a previously saved debate snapshot and resumes execution
   * if the debate was not paused or ended.
   * 
   * This enables users to:
   * - Continue interrupted debates
   * - Review completed debates
   * - Share debate sessions
   * 
   * @param savedData - Previously saved state snapshot
   */
  public loadSavedState(savedData: SavedState): void {
    // Restore all state properties
    this.state = savedData.state;
    this.participants = savedData.participants;
    this.pausedRemainingTime = savedData.pausedRemainingTime;
    this.isPaused = savedData.isPaused;
    
    // If not paused or ended, resume execution
    if (!this.isPaused && !this.state.isEnded) {
      this.executeCurrentPhase();
    }
  }
} 