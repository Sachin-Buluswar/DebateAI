/**
 * Represents the distinct phases of a Public Forum debate.
 */
export enum DebatePhase {
  PRO_CONSTRUCTIVE = 'PRO_CONSTRUCTIVE',
  CON_CONSTRUCTIVE = 'CON_CONSTRUCTIVE',
  CROSSFIRE_1 = 'CROSSFIRE_1',
  PRO_REBUTTAL = 'PRO_REBUTTAL',
  CON_REBUTTAL = 'CON_REBUTTAL',
  CROSSFIRE_2 = 'CROSSFIRE_2',
  PRO_SUMMARY = 'PRO_SUMMARY',
  CON_SUMMARY = 'CON_SUMMARY',
  GRAND_CROSSFIRE = 'GRAND_CROSSFIRE',
  PRO_FINAL_FOCUS = 'PRO_FINAL_FOCUS',
  CON_FINAL_FOCUS = 'CON_FINAL_FOCUS',
  ENDED = 'ENDED',
}

/**
 * Defines the role of a participant within their team.
 */
export type DebaterRole = 'SPEAKER_1' | 'SPEAKER_2';

/**
 * Defines the participant's team affiliation.
 */
export type DebaterTeam = 'PRO' | 'CON';

/**
 * Represents a single participant in the debate.
 */
export interface Participant {
  id: string; // socket.id or a unique user ID
  name: string;
  isAI: boolean;
  team: DebaterTeam;
  role: DebaterRole;
}

/**
 * Represents the complete, serializable state of the debate at any given moment.
 */
export interface DebateState {
  topic: string;
  phase: DebatePhase;
  currentSpeakerId: string;
  turnStartTime: number | null;
  phaseStartTime: number;
  remainingTime: number;
  isPaused: boolean;
  isEnded: boolean;
  savedAt?: number; // Timestamp when state was saved
  resumedAt?: number; // Timestamp when debate was resumed
}

export interface SavedDebateState extends DebateState {
  sessionId: string;
  topic: string;
  participants: Participant[];
  transcript: string;
  userId: string;
  createdAt: number;
}

/**
 * Timings for each debate phase in milliseconds.
 * Using shorter durations for testing purposes.
 */
export const PHASE_TIMINGS: { [key in DebatePhase]: number } = {
  [DebatePhase.PRO_CONSTRUCTIVE]: 4 * 60 * 1000, // 4 minutes
  [DebatePhase.CON_CONSTRUCTIVE]: 4 * 60 * 1000,
  [DebatePhase.CROSSFIRE_1]: 3 * 60 * 1000, // 3 minutes
  [DebatePhase.PRO_REBUTTAL]: 3 * 60 * 1000,
  [DebatePhase.CON_REBUTTAL]: 3 * 60 * 1000,
  [DebatePhase.CROSSFIRE_2]: 3 * 60 * 1000,
  [DebatePhase.PRO_SUMMARY]: 2 * 60 * 1000, // 2 minutes
  [DebatePhase.CON_SUMMARY]: 2 * 60 * 1000,
  [DebatePhase.GRAND_CROSSFIRE]: 3 * 60 * 1000,
  [DebatePhase.PRO_FINAL_FOCUS]: 2 * 60 * 1000,
  [DebatePhase.CON_FINAL_FOCUS]: 2 * 60 * 1000,
  [DebatePhase.ENDED]: 0,
};

/**
 * The official order of phases in a Public Forum debate.
 */
export const PHASE_ORDER: DebatePhase[] = [
  DebatePhase.PRO_CONSTRUCTIVE,
  DebatePhase.CON_CONSTRUCTIVE,
  DebatePhase.CROSSFIRE_1,
  DebatePhase.PRO_REBUTTAL,
  DebatePhase.CON_REBUTTAL,
  DebatePhase.CROSSFIRE_2,
  DebatePhase.PRO_SUMMARY,
  DebatePhase.CON_SUMMARY,
  DebatePhase.GRAND_CROSSFIRE,
  DebatePhase.PRO_FINAL_FOCUS,
  DebatePhase.CON_FINAL_FOCUS,
  DebatePhase.ENDED,
];

/**
 * Determines the current speaker's ID based on the debate phase.
 * @param phase The current debate phase.
 * @param participants The list of all participants.
 * @returns The ID of the current speaker, 'CROSSFIRE', or null.
 */
export function getSpeakerForPhase(
  phase: DebatePhase,
  participants: Participant[],
): string | 'CROSSFIRE' | null {
  const findSpeaker = (team: DebaterTeam, role: DebaterRole) =>
    participants.find(p => p.team === team && p.role === role)?.id || null;

  switch (phase) {
    case DebatePhase.PRO_CONSTRUCTIVE:
    case DebatePhase.PRO_SUMMARY:
      return findSpeaker('PRO', 'SPEAKER_1');
    case DebatePhase.CON_CONSTRUCTIVE:
    case DebatePhase.CON_SUMMARY:
      return findSpeaker('CON', 'SPEAKER_1');
    case DebatePhase.PRO_REBUTTAL:
    case DebatePhase.PRO_FINAL_FOCUS:
      return findSpeaker('PRO', 'SPEAKER_2');
    case DebatePhase.CON_REBUTTAL:
    case DebatePhase.CON_FINAL_FOCUS:
      return findSpeaker('CON', 'SPEAKER_2');
    case DebatePhase.CROSSFIRE_1:
    case DebatePhase.CROSSFIRE_2:
    case DebatePhase.GRAND_CROSSFIRE:
      return 'CROSSFIRE';
    default:
      return null;
  }
} 