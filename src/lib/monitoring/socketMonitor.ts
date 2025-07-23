/**
 * Socket.IO monitoring and instrumentation
 * Tracks WebSocket connections, events, and performance
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { socketLogger } from './logger';
import { createSpan, setSpanAttributes, debateMetrics } from './opentelemetry';
import { sentryServer } from '../../../sentry.server.config';

interface SocketMetrics {
  connections: {
    total: number;
    active: number;
    authenticated: number;
    anonymous: number;
  };
  events: {
    sent: Record<string, number>;
    received: Record<string, number>;
    errors: Record<string, number>;
  };
  rooms: {
    count: number;
    byType: Record<string, number>;
  };
  performance: {
    avgLatency: number;
    maxLatency: number;
    messageRate: number;
  };
}

export class SocketMonitor {
  private io: SocketIOServer;
  private metrics: SocketMetrics;
  private connectionStartTimes: Map<string, number> = new Map();
  private latencyMeasurements: number[] = [];
  private eventTimestamps: number[] = [];

  constructor(io: SocketIOServer) {
    this.io = io;
    this.metrics = {
      connections: {
        total: 0,
        active: 0,
        authenticated: 0,
        anonymous: 0,
      },
      events: {
        sent: {},
        received: {},
        errors: {},
      },
      rooms: {
        count: 0,
        byType: {},
      },
      performance: {
        avgLatency: 0,
        maxLatency: 0,
        messageRate: 0,
      },
    };

    this.setupMonitoring();
    this.startMetricsCollection();
  }

  private setupMonitoring() {
    // Monitor connections
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    // Monitor engine events
    this.io.engine.on('connection_error', (error: unknown) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      socketLogger.error('Socket.IO engine error', errorObj);
      sentryServer.captureException(errorObj, {
        tags: { component: 'socket.io', type: 'engine' },
      });
    });
  }

  private handleConnection(socket: Socket) {
    const connectionSpan = createSpan('socket.connection', {
      'socket.id': socket.id,
      'socket.handshake.address': socket.handshake.address,
      'socket.handshake.headers.user-agent': socket.handshake.headers['user-agent'],
    });

    // Track connection
    this.metrics.connections.total++;
    this.metrics.connections.active++;
    this.connectionStartTimes.set(socket.id, Date.now());
    debateMetrics.activeConnections.add(1);

    // Log connection
    socketLogger.info('Socket connected', {
      metadata: {
        socketId: socket.id,
        address: socket.handshake.address,
        transport: socket.conn.transport.name,
      },
    });

    // Check authentication
    const isAuthenticated = this.isSocketAuthenticated(socket);
    if (isAuthenticated) {
      this.metrics.connections.authenticated++;
    } else {
      this.metrics.connections.anonymous++;
    }

    // Monitor socket events
    this.instrumentSocket(socket);

    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
      connectionSpan.end();
    });

    // Monitor errors
    socket.on('error', (error: Error) => {
      socketLogger.error('Socket error', error, {
        metadata: {
          socketId: socket.id,
        },
      });
      sentryServer.captureException(error, {
        tags: { 
          component: 'socket.io', 
          socketId: socket.id,
        },
      });
      connectionSpan.recordException(error);
    });

    // Setup latency monitoring
    this.setupLatencyMonitoring(socket);
  }

  private handleDisconnection(socket: Socket, reason: string) {
    // Update metrics
    this.metrics.connections.active--;
    debateMetrics.activeConnections.add(-1);

    if (this.isSocketAuthenticated(socket)) {
      this.metrics.connections.authenticated--;
    } else {
      this.metrics.connections.anonymous--;
    }

    // Calculate session duration
    const connectionTime = this.connectionStartTimes.get(socket.id);
    if (connectionTime) {
      const duration = Date.now() - connectionTime;
      this.connectionStartTimes.delete(socket.id);

      socketLogger.info('Socket disconnected', {
        metadata: {
          socketId: socket.id,
          reason,
          duration: `${duration}ms`,
          sessionDuration: `${Math.floor(duration / 1000)}s`,
        },
      });

      // Track long sessions
      if (duration > 300000) { // 5 minutes
        sentryServer.addBreadcrumb({
          category: 'socket',
          message: 'Long socket session ended',
          level: 'info',
          data: {
            socketId: socket.id,
            duration,
            reason,
          },
        });
      }
    }
  }

  private instrumentSocket(socket: Socket) {
    // Wrap emit to track sent events
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (event: string, ...args: any[]) => {
      this.trackEvent('sent', event);
      
      const span = createSpan(`socket.emit.${event}`, {
        'socket.id': socket.id,
        'event.name': event,
        'event.args.count': args.length,
      });

      try {
        const result = originalEmit(event, ...args);
        span.setStatus({ code: 0 }); // OK
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2 }); // ERROR
        this.trackEvent('errors', event);
        throw error;
      } finally {
        span.end();
      }
    };

    // Track received events using middleware
    socket.use((eventData, next) => {
      const event = eventData[0];
      if (typeof event === 'string') {
        this.trackEvent('received', event);
        this.eventTimestamps.push(Date.now());
      }
      next();
    });

    // Monitor room operations
    const originalJoin = socket.join.bind(socket);
    socket.join = (room: string | string[]) => {
      const rooms = Array.isArray(room) ? room : [room];
      rooms.forEach(r => this.trackRoom(r, 'join'));
      return originalJoin(room);
    };

    const originalLeave = socket.leave.bind(socket);
    socket.leave = (room: string) => {
      this.trackRoom(room, 'leave');
      return originalLeave(room);
    };
  }

  private setupLatencyMonitoring(socket: Socket) {
    // Ping-pong latency measurement
    let pingTime: number;

    socket.on('ping', () => {
      pingTime = Date.now();
      socket.emit('pong');
    });

    socket.on('pong_response', () => {
      if (pingTime) {
        const latency = Date.now() - pingTime;
        this.latencyMeasurements.push(latency);
        
        // Keep only last 100 measurements
        if (this.latencyMeasurements.length > 100) {
          this.latencyMeasurements.shift();
        }

        // Log high latency
        if (latency > 1000) {
          socketLogger.warn('High socket latency detected', {
            metadata: {
              socketId: socket.id,
              latency: `${latency}ms`,
            },
          });
        }
      }
    });
  }

  private trackEvent(type: 'sent' | 'received' | 'errors', event: string) {
    if (!this.metrics.events[type][event]) {
      this.metrics.events[type][event] = 0;
    }
    this.metrics.events[type][event]++;
  }

  private trackRoom(room: string, action: 'join' | 'leave') {
    // Determine room type
    const roomType = room.startsWith('debate:') ? 'debate' :
                    room.startsWith('user:') ? 'user' :
                    'other';

    if (action === 'join') {
      this.metrics.rooms.count++;
      this.metrics.rooms.byType[roomType] = (this.metrics.rooms.byType[roomType] || 0) + 1;
    } else {
      this.metrics.rooms.count--;
      if (this.metrics.rooms.byType[roomType]) {
        this.metrics.rooms.byType[roomType]--;
      }
    }
  }

  private isSocketAuthenticated(socket: Socket): boolean {
    return !!(socket.data?.userId || socket.handshake.auth?.userId);
  }

  private startMetricsCollection() {
    // Update performance metrics every 30 seconds
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 30000);

    // Clean up old event timestamps every minute
    setInterval(() => {
      const oneMinuteAgo = Date.now() - 60000;
      this.eventTimestamps = this.eventTimestamps.filter(ts => ts > oneMinuteAgo);
    }, 60000);
  }

  private updatePerformanceMetrics() {
    // Calculate average latency
    if (this.latencyMeasurements.length > 0) {
      const sum = this.latencyMeasurements.reduce((a, b) => a + b, 0);
      this.metrics.performance.avgLatency = sum / this.latencyMeasurements.length;
      this.metrics.performance.maxLatency = Math.max(...this.latencyMeasurements);
    }

    // Calculate message rate (messages per second)
    const now = Date.now();
    const recentEvents = this.eventTimestamps.filter(ts => ts > now - 60000);
    this.metrics.performance.messageRate = recentEvents.length / 60;
  }

  public getMetrics(): SocketMetrics {
    return {
      ...this.metrics,
      rooms: {
        ...this.metrics.rooms,
        // Add current room count from Socket.IO
        count: this.io.sockets.adapter.rooms.size,
      },
    };
  }

  public getConnectionInfo(socketId?: string): any {
    if (socketId) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        return {
          id: socket.id,
          connected: socket.connected,
          transport: socket.conn.transport.name,
          address: socket.handshake.address,
          rooms: Array.from(socket.rooms),
          authenticated: this.isSocketAuthenticated(socket),
        };
      }
      return null;
    }

    // Return all connections
    const connections: any[] = [];
    this.io.sockets.sockets.forEach((socket) => {
      connections.push({
        id: socket.id,
        connected: socket.connected,
        transport: socket.conn.transport.name,
        authenticated: this.isSocketAuthenticated(socket),
      });
    });

    return connections;
  }

  public broadcastMetrics() {
    // Broadcast current metrics to admin room
    this.io.to('admin').emit('metrics:update', {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
    });
  }

  // Health check for WebSocket connections
  public isHealthy(): boolean {
    const metrics = this.getMetrics();
    
    // Check if we have reasonable metrics
    if (metrics.performance.avgLatency > 5000) return false; // 5s average latency
    if (metrics.connections.active > 10000) return false; // Too many connections
    if (metrics.performance.messageRate > 1000) return false; // Too high message rate
    
    return true;
  }
}

// Utility function to create monitored Socket.IO server
export function createMonitoredSocketServer(io: SocketIOServer): SocketMonitor {
  return new SocketMonitor(io);
}