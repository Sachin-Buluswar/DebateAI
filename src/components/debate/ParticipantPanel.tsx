'use client';

import ParticipantCard from './ParticipantCard';

interface Participant {
  id: string;
  name: string;
  team: 'PRO' | 'CON';
  role: string;
  isAI?: boolean;
}

interface ParticipantPanelProps {
  participants: Participant[];
  currentSpeakerId: string | null;
  debatePhase?: string;
}

export default function ParticipantPanel({ participants, currentSpeakerId, debatePhase }: ParticipantPanelProps) {
  const proTeam = participants.filter(p => p.team === 'PRO');
  const conTeam = participants.filter(p => p.team === 'CON');

  // Determine participant status based on debate phase and speaking order
  const getParticipantStatus = (participant: Participant) => {
    if (participant.id === currentSpeakerId) return 'speaking';
    
    // Simple logic - can be enhanced based on actual debate flow
    const allParticipants = [...proTeam, ...conTeam];
    const currentIndex = allParticipants.findIndex(p => p.id === currentSpeakerId);
    const participantIndex = allParticipants.findIndex(p => p.id === participant.id);
    
    if (currentIndex === -1 || participantIndex < currentIndex) {
      return 'finished';
    }
    return 'waiting';
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white lowercase">participants</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">debate speakers and their current status</p>
      </div>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-[#87A96B] mb-4">pro team</h3>
          <div className="space-y-3">
            {proTeam.map(participant => (
              <ParticipantCard
                key={participant.id}
                id={participant.id}
                name={participant.name}
                team={participant.team}
                role={participant.role}
                isAI={participant.isAI !== false}
                status={getParticipantStatus(participant) as 'speaking' | 'waiting' | 'finished'}
                currentSpeakerId={currentSpeakerId}
              />
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-red-500 mb-4">con team</h3>
          <div className="space-y-3">
            {conTeam.map(participant => (
              <ParticipantCard
                key={participant.id}
                id={participant.id}
                name={participant.name}
                team={participant.team}
                role={participant.role}
                isAI={participant.isAI !== false}
                status={getParticipantStatus(participant) as 'speaking' | 'waiting' | 'finished'}
                currentSpeakerId={currentSpeakerId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 