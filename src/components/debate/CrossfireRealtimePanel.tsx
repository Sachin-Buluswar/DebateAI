'use client';

import { useState, useEffect, useRef } from 'react';
import { useCrossfireRealtime } from '@/hooks/useDebateRealtime';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import EnhancedButton from '@/components/ui/EnhancedButton';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline';

interface CrossfireRealtimePanelProps {
  debateId: string;
  userId: string;
  userName: string;
  isActive: boolean;
}

export function CrossfireRealtimePanel({ 
  debateId, 
  userId, 
  userName,
  isActive 
}: CrossfireRealtimePanelProps) {
  const { connected, messages, participants, sendMessage } = useCrossfireRealtime(debateId, userId);
  const [isRecording, setIsRecording] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [latencyStats, setLatencyStats] = useState({ min: 0, max: 0, avg: 0 });
  const latencyMeasurements = useRef<number[]>([]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Measure latency for messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.userId === userId && lastMessage.timestamp) {
        const latency = Date.now() - lastMessage.timestamp;
        latencyMeasurements.current.push(latency);
        
        // Keep only last 10 measurements
        if (latencyMeasurements.current.length > 10) {
          latencyMeasurements.current.shift();
        }
        
        // Update stats
        const measurements = latencyMeasurements.current;
        setLatencyStats({
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          avg: Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length)
        });
      }
    }
  }, [messages, userId]);

  const handleSendMessage = async () => {
    if (inputText.trim() && connected) {
      const startTime = Date.now();
      await sendMessage(inputText);
      setInputText('');
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // TODO: Implement actual audio recording and transcription
  };

  if (!isActive) {
    return null;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Crossfire Session</h3>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {connected && (
              <span className="text-xs text-gray-400">
                ({participants.length} participants)
              </span>
            )}
          </div>
        </div>
        {connected && latencyStats.avg > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            Latency: {latencyStats.avg}ms (min: {latencyStats.min}ms, max: {latencyStats.max}ms)
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col h-[calc(100%-80px)]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-2 p-2 rounded ${
                msg.userId === userId 
                  ? 'bg-blue-100 dark:bg-blue-900 ml-auto max-w-[70%]' 
                  : 'bg-gray-100 dark:bg-gray-800 mr-auto max-w-[70%]'
              }`}
            >
              <div className="text-xs text-gray-500 mb-1">
                {msg.userId === userId ? 'You' : `Participant ${msg.userId.slice(0, 8)}`}
              </div>
              <div className="text-sm">{msg.text}</div>
              {msg.timestamp && (
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your response..."
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!connected || !isActive}
          />
          
          <EnhancedButton
            onClick={toggleRecording}
            variant={isRecording ? 'danger' : 'secondary'}
            disabled={!connected || !isActive}
            className="p-2"
          >
            {isRecording ? (
              <StopIcon className="w-5 h-5" />
            ) : (
              <MicrophoneIcon className="w-5 h-5" />
            )}
          </EnhancedButton>
          
          <EnhancedButton
            onClick={handleSendMessage}
            disabled={!connected || !isActive || !inputText.trim()}
          >
            Send
          </EnhancedButton>
        </div>

        {/* Connection Info */}
        {!connected && (
          <div className="mt-2 text-sm text-red-500">
            Connecting to real-time session...
          </div>
        )}
      </CardContent>
    </Card>
  );
}