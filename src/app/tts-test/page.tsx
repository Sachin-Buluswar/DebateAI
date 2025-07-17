'use client';

import { useState } from 'react';
import { playTextToSpeech } from '@/frontend/services/audioService';
import EnhancedButton from '@/components/ui/EnhancedButton';
import EnhancedInput from '@/components/ui/EnhancedInput';

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
        <EnhancedInput
          value={text}
          onChange={(e) => setText(e.target.value)}
          label="Text to Speech"
          placeholder="Enter text to convert to speech..."
          multiline
          rows={4}
        />
        <EnhancedButton onClick={handlePlay} disabled={isLoading} loading={isLoading} loadingText="Generating Audio...">
          Play Audio
        </EnhancedButton>
      </div>
    </div>
  );
} 