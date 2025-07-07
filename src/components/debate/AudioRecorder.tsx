'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  onRecordedAudio?: (blob: Blob) => void;
}

export default function AudioRecorder({ onTranscription, disabled = false, onRecordedAudio }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]).current;

    const handleStartRecording = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            mediaRecorderRef.current.onstop = handleSendAudio;
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            setError('Could not access microphone. Please grant permission.');
            console.error('Error getting user media:', err);
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSendAudio = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if (onRecordedAudio) {
            onRecordedAudio(audioBlob);
        }
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        try {
            const response = await fetch('/api/stt', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to transcribe audio.');
            }

            const result = await response.json();
            onTranscription(result.transcription); // Pass transcription up to parent
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
            setError(errorMessage);
            console.error('Error sending audio:', err);
        } finally {
            audioChunks.length = 0; // Clear chunks for next recording
        }
    };

    return (
        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
            <h3 className="text-xl font-semibold mb-2">Your Turn to Speak</h3>
            <div className="flex items-center space-x-4">
                <Button onClick={isRecording ? handleStopRecording : handleStartRecording} disabled={disabled}>
                    {isRecording ? 'Stop Recording' : disabled ? 'Start Debate First' : 'Start Recording'}
                </Button>
                {isRecording && <div className="text-red-500 animate-pulse">Recording...</div>}
            </div>
            {error && <p className="text-red-500 mt-4">Error: {error}</p>}
        </div>
    );
} 