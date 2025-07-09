'use client';

import { useEffect, useRef } from 'react';

interface StreamingAudioPlayerProps {
  audioQueue: Blob[];
  setAudioQueue: React.Dispatch<React.SetStateAction<Blob[]>>;
}

const StreamingAudioPlayer = ({ audioQueue, setAudioQueue }: StreamingAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const isPlaying = useRef(false);

  useEffect(() => {
    if (!mediaSourceRef.current) {
      const ms = new MediaSource();
      mediaSourceRef.current = ms;
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(ms);
      }
      ms.addEventListener('sourceopen', setupSourceBuffer);
    }
  }, []);

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying.current) {
      playFromQueue();
    }
  }, [audioQueue]);

  const setupSourceBuffer = () => {
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
      const sb = mediaSourceRef.current.addSourceBuffer('audio/mpeg');
      sourceBufferRef.current = sb;
      sb.addEventListener('updateend', playFromQueue);
    }
  };

  const playFromQueue = async () => {
    if (audioQueue.length > 0 && sourceBufferRef.current && !sourceBufferRef.current.updating) {
      isPlaying.current = true;
      const blob = audioQueue[0];
      const buffer = await blob.arrayBuffer();
      try {
        sourceBufferRef.current.appendBuffer(buffer);
      } catch (err) {
        console.error('Error appending audio buffer:', err);
        // Attempt to recover by resetting the media source
        resetMediaSource();
      }
      setAudioQueue((prev) => prev.slice(1));
    } else {
      isPlaying.current = false;
    }
  };

  const resetMediaSource = () => {
    if (audioRef.current) {
      // Detach the current src so browser releases the old MediaSource
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    isPlaying.current = false;

    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    if (audioRef.current) {
      audioRef.current.src = URL.createObjectURL(ms);
      audioRef.current.load();
      audioRef.current.play().catch(() => {
        /* ignore */
      });
    }
    ms.addEventListener('sourceopen', setupSourceBuffer);
  };

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h3 className="text-xl font-semibold mb-2">Live Audio</h3>
      <audio ref={audioRef} controls autoPlay />
    </div>
  );
};

export default StreamingAudioPlayer;
