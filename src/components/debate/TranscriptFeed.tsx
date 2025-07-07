'use client';

import { useEffect, useRef } from 'react';

interface Message {
  speaker: string;
  text: string;
}

interface TranscriptFeedProps {
  messages: Message[];
}

export default function TranscriptFeed({ messages }: TranscriptFeedProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-y-auto">
      <div className="space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className="flex flex-col">
            <div className="font-bold text-sm text-gray-700 dark:text-gray-300">
              {msg.speaker}
            </div>
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800 shadow">
              <p className="text-gray-900 dark:text-gray-100">{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
} 