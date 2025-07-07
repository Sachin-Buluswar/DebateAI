/**
 * Calls the backend TTS service to generate audio from text and plays it.
 * @param text The text to be converted to speech.
 */
export async function playTextToSpeech(text: string): Promise<void> {
  try {
    const response = await fetch('/api/prototype/elevenlabs-tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`TTS API request failed with status ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.play();
    
    // Optional: Clean up the object URL after playback is finished
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

  } catch (error) {
    console.error('Error playing text to speech:', error);
  }
} 