'use client';

import { useState } from 'react';
import { playTextToSpeech } from '@/frontend/services/audioService';
import Button from '@/components/ui/Button';

export default function TtsTest() {
  const [text, setText] = useState('Hello, world! This is a test of the text-to-speech functionality.');
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    await playTextToSpeech(text);
    setIsLoading(false);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">TTS Test Page</h1>
      <div className="space-y-4">
        <textarea
          className="w-full h-32 p-2 border rounded"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button onClick={handlePlay} disabled={isLoading}>
          {isLoading ? 'Generating Audio...' : 'Play Audio'}
        </Button>
      </div>
    </div>
  );
} 