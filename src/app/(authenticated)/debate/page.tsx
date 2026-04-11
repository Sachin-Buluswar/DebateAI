'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useConversation, TranscriptEntry } from '@/hooks/useConversation';
import { useToast } from '@/lib/toast';

const SYSTEM_PROMPT_TEMPLATE = `You are a sharp, articulate debate opponent practicing with a student. The debate topic is: "{TOPIC}"

You are arguing AGAINST the student's position. Your job is to:
- Present strong, well-reasoned counterarguments
- Challenge weak points in the student's reasoning
- Ask probing questions to test their understanding
- Be persuasive and use evidence-based reasoning
- Adapt your difficulty to match the student's skill level

Style guidelines:
- Sound natural and conversational, like a real debate partner
- Keep responses concise (2-4 sentences per turn) so the conversation flows
- Use contractions and natural speech patterns
- Be respectful but don't hold back on challenging their arguments
- Occasionally acknowledge good points the student makes`;

function buildSystemPrompt(topic: string): string {
  return SYSTEM_PROMPT_TEMPLATE.replace('{TOPIC}', topic);
}

function buildFirstMessage(topic: string): string {
  return `Alright, let's debate: "${topic}". I'll be arguing against your position. Go ahead and make your opening argument — I'm ready to push back.`;
}

function StatusIndicator({ status, mode }: { status: string; mode: string }) {
  if (status === 'connecting') {
    return (
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
        </span>
        <span className="text-sm font-medium">connecting...</span>
      </div>
    );
  }

  if (status === 'connected') {
    const isAiSpeaking = mode === 'speaking';
    return (
      <div
        className={`flex items-center gap-2 ${isAiSpeaking ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}
      >
        <span className="relative flex h-3 w-3">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAiSpeaking ? 'bg-blue-400' : 'bg-emerald-400'}`}
          />
          <span
            className={`relative inline-flex rounded-full h-3 w-3 ${isAiSpeaking ? 'bg-blue-500' : 'bg-emerald-500'}`}
          />
        </span>
        <span className="text-sm font-medium">
          {isAiSpeaking ? 'AI is speaking...' : 'listening — your turn'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
      <span className="inline-flex rounded-full h-3 w-3 bg-gray-300 dark:bg-gray-600" />
      <span className="text-sm font-medium">not connected</span>
    </div>
  );
}

function TranscriptView({ entries }: { entries: TranscriptEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
        conversation will appear here...
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
      {entries.map((entry, i) => (
        <div
          key={i}
          className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              entry.role === 'user'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 rounded-br-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
            }`}
          >
            <span className="block text-[10px] font-medium uppercase tracking-wide mb-1 opacity-60">
              {entry.role === 'user' ? 'you' : 'opponent'}
            </span>
            {entry.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export default function DebatePage() {
  const toast = useToast();
  const [topic, setTopic] = useState('');
  const [activeTopic, setActiveTopic] = useState('');
  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Callbacks passed via ref inside the hook, so object identity doesn't matter
  const { status, mode, transcript, isMuted, start, stop, toggleMute } =
    useConversation({
      onConnect: () => toast.success('Connected — start speaking!'),
      onDisconnect: (details) => {
        if (details?.reason === 'error') {
          toast.error(details.message || 'Debate connection lost.');
        } else {
          toast.info('Debate ended.');
        }
      },
      onError: (message: string) => toast.error(message || 'Connection error'),
    });

  const isActive = status === 'connected' || status === 'connecting';

  // Clean up conversation WebSocket on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch('/api/debate/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() || undefined }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const { signedUrl, topic: resolvedTopic } = await res.json();
      setActiveTopic(resolvedTopic);
      if (!topic.trim()) setTopic(resolvedTopic);

      await start(signedUrl, buildSystemPrompt(resolvedTopic), buildFirstMessage(resolvedTopic));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start debate';
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  }, [topic, start, toast]);

  const handleGenerateTopic = useCallback(async () => {
    setIsGeneratingTopic(true);
    try {
      const res = await fetch('/api/debate/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicOnly: true }),
      });

      if (!res.ok) throw new Error('Failed to generate topic');
      const { topic: generated } = await res.json();
      setTopic(generated);
      toast.success('Topic generated!');
    } catch {
      toast.error('Could not generate a topic. Try typing one instead.');
    } finally {
      setIsGeneratingTopic(false);
    }
  }, [toast]);

  const handleEnd = useCallback(async () => {
    await stop();
  }, [stop]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-light text-gray-900 dark:text-gray-100">
          debate practice
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          have a live voice conversation with an AI debate opponent
        </p>
      </div>

      {/* Setup (hidden during active debate) */}
      {!isActive && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6 space-y-4">
          <div>
            <label
              htmlFor="topic"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              debate topic
            </label>
            <div className="flex gap-2">
              <input
                id="topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. On balance, the benefits of genetically modified foods outweigh the harms"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={isStarting}
              />
              <button
                onClick={handleGenerateTopic}
                disabled={isGeneratingTopic || isStarting}
                className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingTopic ? 'generating...' : 'random topic'}
              </button>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isStarting ? 'starting...' : 'start debate'}
          </button>
        </div>
      )}

      {/* Active debate */}
      {isActive && (
        <div className="space-y-4">
          {/* Topic bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                topic
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                {activeTopic}
              </p>
            </div>
            <StatusIndicator status={status} mode={mode} />
          </div>

          {/* Transcript */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
            <TranscriptView entries={transcript} />
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <button
              onClick={toggleMute}
              className={`flex-1 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isMuted
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {isMuted ? 'unmute mic' : 'mute mic'}
            </button>
            <button
              onClick={handleEnd}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-medium transition-colors shadow-sm"
            >
              end debate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
