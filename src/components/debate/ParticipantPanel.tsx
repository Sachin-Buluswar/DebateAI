'use client';

interface Participant {
  id: string;
  name: string;
  team: 'PRO' | 'CON';
  role: string;
}

interface ParticipantPanelProps {
  participants: Participant[];
  currentSpeakerId: string | null;
}

export default function ParticipantPanel({ participants, currentSpeakerId }: ParticipantPanelProps) {
  const proTeam = participants.filter(p => p.team === 'PRO');
  const conTeam = participants.filter(p => p.team === 'CON');

  const renderParticipant = (participant: Participant) => (
    <div
      key={participant.id}
      className={`p-3 rounded-lg transition-all relative overflow-hidden ${
        participant.id === currentSpeakerId
          ? 'bg-primary-100 dark:bg-primary-800 ring-2 ring-primary-500'
          : 'bg-gray-100 dark:bg-gray-700'
      }`}
    >
      {participant.id === currentSpeakerId && (
        <>
          <div className="absolute inset-0 bg-primary-400 dark:bg-primary-500 opacity-10 animate-pulse" />
          <div className="absolute top-2 right-2">
            <div className="flex space-x-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1 h-3 bg-primary-500 dark:bg-primary-400 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </>
      )}
      <p className="font-semibold text-gray-800 dark:text-gray-200">{participant.name}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {participant.role?.replace(/_/g, ' ')}
      </p>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Participants</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">Pro Team</h3>
          <div className="space-y-2">
            {proTeam.map(renderParticipant)}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Con Team</h3>
          <div className="space-y-2">
            {conTeam.map(renderParticipant)}
          </div>
        </div>
      </div>
    </div>
  );
} 