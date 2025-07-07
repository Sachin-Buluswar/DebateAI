'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';

const CrossfireController = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioQueue = useRef<Blob[]>([]).current;

    const connect = () => {
        setIsConnecting(true);
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/debate/crossfire`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('Connected to crossfire service');
            setIsConnecting(false);
            setIsConnected(true);
        };

        ws.onmessage = async (event) => {
            if (event.data instanceof Blob) {
                audioQueue.push(event.data);
                playAudioFromQueue();
            }
        };

        ws.onclose = () => {
            console.log('Disconnected from crossfire service');
            setIsConnected(false);
            setIsRecording(false);
        };
    };

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(event.data);
            }
        };

        mediaRecorderRef.current.start(100); // Send data every 100ms
        setIsRecording(true);
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
    };
    
    const playAudioFromQueue = async () => {
        if (audioQueue.length === 0) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
        }
        
        const blob = audioQueue.shift();
        if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.start();
        }
    };

    return (
        <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
            <h3 className="text-xl font-semibold mb-2">Crossfire Controller</h3>
            {!isConnected && (
                <Button onClick={connect} disabled={isConnecting}>
                    {isConnecting ? 'Connecting...' : 'Connect to Crossfire'}
                </Button>
            )}
            {isConnected && (
                <div className="flex items-center space-x-4">
                    <Button onClick={isRecording ? stopRecording : startRecording}>
                        {isRecording ? 'Stop Speaking' : 'Start Speaking'}
                    </Button>
                    {isRecording && <div className="text-red-500 animate-pulse">Live</div>}
                </div>
            )}
        </div>
    );
};

export default CrossfireController; 