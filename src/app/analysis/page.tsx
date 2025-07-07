'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Button from '@/components/ui/Button';

// Mock transcript for demonstration purposes
const mockTranscript = `
AI Alice (Pro 1): Good morning. The resolution today is that the United States federal government should substantially increase its security cooperation with NATO. We affirm this resolution for three key reasons. First, enhanced cybersecurity cooperation is essential to defend against state-sponsored cyberattacks...

AI Charlie (Con 1): We negate the resolution. While we agree that cybersecurity is important, the current framework for cooperation is sufficient. A substantial increase would lead to unnecessary entanglement and risk escalating tensions with non-NATO adversaries...
`;
const mockUserId = 'human-pro-1';

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/debate/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: mockTranscript,
          userParticipantId: mockUserId,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to get analysis.');
      }

      const result = await response.json();
      setAnalysis(result.analysis);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Post-Debate Analysis</h1>
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
        <h2 className="text-xl font-semibold mb-2">Debate Transcript</h2>
        <pre className="whitespace-pre-wrap bg-white dark:bg-gray-700 p-2 rounded">
          {mockTranscript}
        </pre>
      </div>
      <Button onClick={handleAnalyze} disabled={isLoading}>
        {isLoading ? 'Analyzing...' : 'Analyze Debate'}
      </Button>
      {error && <p className="text-red-500 mt-4">Error: {error}</p>}
      {analysis && (
        <div className="mt-4 p-4 border rounded-lg bg-white dark:bg-gray-800">
          <h2 className="text-2xl font-bold mb-2">Judge's Analysis</h2>
          <div className="prose dark:prose-invert">
            <ReactMarkdown>{analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
} 