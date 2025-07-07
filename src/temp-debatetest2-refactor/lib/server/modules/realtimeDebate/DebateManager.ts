import {
  DebatePhase,
  Participant,
  DebateState,
  PHASE_TIMINGS,
  PHASE_ORDER,
  getSpeakerForPhase,
} from '@/backend/modules/realtimeDebate/debate-types';

type SavedState = {
  state: DebateState;
  participants: Participant[];
  pausedRemainingTime: number | null;
  isPaused: boolean;
};

/**
 * Manages the state, timing, and flow of a single debate session.
 * It operates as a state machine, transitioning through debate phases
 * and notifying about state changes via a callback.
 */
export class DebateManager {
  private state: DebateState;
  private participants: Participant[];
  private turnTimer: NodeJS.Timeout | null = null;
  private phaseInterval: NodeJS.Timeout | null = null;
  private pausedRemainingTime: number | null = null;
  private onStateChange: (newState: DebateState, mode: string) => void;
  private isPaused: boolean = false;

  constructor(
    participants: Participant[],
    onStateChange: (newState: DebateState, mode: string) => void,
    topic: string,
  ) {
    this.participants = participants;
    this.onStateChange = onStateChange;

    const initialPhase = DebatePhase.PRO_CONSTRUCTIVE;
    this.state = {
      topic,
      phase: initialPhase,
      currentSpeakerId: getSpeakerForPhase(initialPhase, this.participants) || '',
      turnStartTime: null,
      phaseStartTime: Date.now(),
      remainingTime: PHASE_TIMINGS[initialPhase] / 1000,
      isPaused: false,
      isEnded: false,
    };
  }

  /**
   * Starts the debate, initiating the first turn.
   */
  public startDebate(): void {
    console.log('Debate started!');
    this.executeCurrentPhase();
  }

  /**
   * Immediately stops the debate and clears any running timers.
   */
  public endDebate(): void {
    this.clearTimers();
    this.state.phase = DebatePhase.ENDED;
    this.state.remainingTime = 0;
    this.state.isEnded = true;
    this.onStateChange(this.state, 'speech');
    console.log('Debate has ended.');
  }

  private executeCurrentPhase(): void {
    this.clearTimers();
    if (this.state.phase === DebatePhase.ENDED) {
      return;
    }

    if (this.isCrossfirePhase(this.state.phase)) {
      this.handleCrossfirePhase();
    } else {
      this.handleSpeechPhase();
    }
  }

  private handleSpeechPhase(): void {
    const phaseDuration = PHASE_TIMINGS[this.state.phase];
    this.state.remainingTime = phaseDuration / 1000;
    this.state.currentSpeakerId = getSpeakerForPhase(
      this.state.phase,
      this.participants,
    ) || '';

    console.log(`Starting speech phase: ${this.state.phase}`);
    this.onStateChange(this.state, 'speech');

    this.turnTimer = setTimeout(() => this.transitionToNextPhase(), phaseDuration);
    this.phaseInterval = setInterval(() => {
      this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
      if (this.state.remainingTime % 5 === 0) {
        this.onStateChange(this.state, 'timer');
      }
    }, 1000);
  }

  private handleCrossfirePhase(): void {
    const phaseDuration = PHASE_TIMINGS[this.state.phase];
    this.state.remainingTime = phaseDuration / 1000;
    this.state.currentSpeakerId = 'CROSSFIRE';

    console.log(`Starting crossfire phase: ${this.state.phase}`);
    this.onStateChange(this.state, 'crossfire');

    this.turnTimer = setTimeout(() => this.transitionToNextPhase(), phaseDuration);
    this.phaseInterval = setInterval(() => {
      this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
      if (this.state.remainingTime % 5 === 0) {
        this.onStateChange(this.state, 'timer');
      }
    }, 1000);
  }

  private isCrossfirePhase(phase: DebatePhase): boolean {
    return [
      DebatePhase.CROSSFIRE_1,
      DebatePhase.CROSSFIRE_2,
      DebatePhase.GRAND_CROSSFIRE,
    ].includes(phase);
  }

  private transitionToNextPhase(): void {
    const currentPhaseIndex = PHASE_ORDER.indexOf(this.state.phase);
    const nextPhase = PHASE_ORDER[currentPhaseIndex + 1] || DebatePhase.ENDED;

    console.log(`Transitioning from ${this.state.phase} to ${nextPhase}`);
    this.state.phase = nextPhase;
    this.executeCurrentPhase();
  }

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

  pause(): void {
    if (!this.isPaused) {
      this.isPaused = true;
      this.state.isPaused = true;
      this.pausedRemainingTime = this.state.remainingTime;
      
      // Clear all timers
      this.clearTimers();
      
      console.log('Debate paused at', this.state.phase, 'with', this.pausedRemainingTime, 'seconds remaining');
      this.onStateChange(this.state, 'pause');
    }
  }

  resume(): void {
    if (this.isPaused && this.pausedRemainingTime !== null) {
      console.log('Resuming debate at', this.state.phase, 'with', this.pausedRemainingTime, 'seconds remaining');
      
      this.isPaused = false;
      this.state.isPaused = false;
      this.state.remainingTime = this.pausedRemainingTime;
      
      // Set up the phase timer to complete after remaining time
      const remainingMs = this.pausedRemainingTime * 1000;
      this.turnTimer = setTimeout(() => this.transitionToNextPhase(), remainingMs);
      
      // Resume the countdown interval
      this.phaseInterval = setInterval(() => {
        this.state.remainingTime = Math.max(0, this.state.remainingTime - 1);
        if (this.state.remainingTime % 5 === 0) {
          this.onStateChange(this.state, 'timer');
        }
      }, 1000);
      
      this.pausedRemainingTime = null;
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

  // Skip to next speaker/phase
  public skipCurrentTurn(): void {
    if (this.state.isPaused || this.state.isEnded) {
      console.log('Cannot skip turn while paused or ended');
      return;
    }

    console.log(`Skipping current turn for speaker: ${this.state.currentSpeakerId}`);
    
    // Clear existing timers
    this.clearTimers();
    
    // Advance to next phase
    this.transitionToNextPhase();
  }

  // Save debate state for resuming later
  public saveState(): SavedState {
    return {
      state: this.getState(),
      participants: this.getParticipants(),
      pausedRemainingTime: this.pausedRemainingTime,
      isPaused: this.isPaused
    };
  }

  // Load saved debate state
  public loadSavedState(savedData: SavedState): void {
    this.state = savedData.state;
    this.participants = savedData.participants;
    this.pausedRemainingTime = savedData.pausedRemainingTime;
    this.isPaused = savedData.isPaused;
    
    // If not paused, resume the debate
    if (!this.isPaused && !this.state.isEnded) {
      this.executeCurrentPhase();
    }
  }
} 