// Fallback handler for environments where Socket.IO isn't available
export interface FallbackDebateManager {
  startDebate: (topic: string, participants: any[]) => Promise<void>;
  submitSpeech: (text: string, speakerId: string, side?: 'PRO' | 'CON') => Promise<void>;
  endDebate: (winner?: 'PRO' | 'CON' | 'DRAW', reason?: string) => Promise<void>;
  pauseDebate: () => void;
  resumeDebate: () => void;
  isAvailable: () => boolean;
}

export class SocketIOFallback implements FallbackDebateManager {
  private baseUrl: string;
  private token?: string;
  private currentSessionId?: string;
  private userId?: string;

  constructor(token?: string, userId?: string) {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    this.token = token;
    this.userId = userId;
  }

  async startDebate(topic: string, participants: any[]): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID required to start debate');
    }

    const userSide = participants.find(p => p.id === this.userId)?.team || 'PRO';
    
    // Use REST API fallback
    const response = await fetch(`${this.baseUrl}/api/debate/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      body: JSON.stringify({ 
        topic, 
        userSide,
        userId: this.userId,
        debaters: participants.map(p => p.name)
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start debate via REST API');
    }

    const data = await response.json();
    this.currentSessionId = data.sessionId;
  }

  async submitSpeech(text: string, speakerId: string, side?: 'PRO' | 'CON'): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active debate session');
    }

    const response = await fetch(`${this.baseUrl}/api/debate/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      body: JSON.stringify({ 
        text, 
        speakerId,
        sessionId: this.currentSessionId,
        side: side || 'PRO',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit speech via REST API');
    }
  }

  async endDebate(winner?: 'PRO' | 'CON' | 'DRAW', reason?: string): Promise<void> {
    if (!this.currentSessionId) {
      throw new Error('No active debate session');
    }

    const response = await fetch(`${this.baseUrl}/api/debate/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      body: JSON.stringify({ 
        sessionId: this.currentSessionId,
        winner,
        reason
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to end debate via REST API');
    }

    // Clear session ID after ending
    this.currentSessionId = undefined;
  }

  pauseDebate(): void {
    console.log('Pause functionality not available in fallback mode');
  }

  resumeDebate(): void {
    console.log('Resume functionality not available in fallback mode');
  }

  isAvailable(): boolean {
    return true; // REST API is always available
  }
}

// Display a user-friendly message about degraded functionality
export function showRealtimeWarning(): void {
  if (typeof window !== 'undefined') {
    const existingWarning = document.getElementById('realtime-warning');
    if (existingWarning) return;

    const warning = document.createElement('div');
    warning.id = 'realtime-warning';
    warning.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      z-index: 9999;
      max-width: 400px;
      font-size: 14px;
    `;
    warning.innerHTML = `
      <strong>Limited Real-time Features</strong><br>
      Due to deployment constraints, some real-time features may have increased latency. 
      The debate will still function normally.
      <button onclick="this.parentElement.remove()" style="
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        color: #92400e;
      ">×</button>
    `;
    document.body.appendChild(warning);

    // Auto-remove after 10 seconds
    setTimeout(() => warning.remove(), 10000);
  }
}