#!/usr/bin/env node

/**
 * Comprehensive test script for DebateAI core functionality
 * Tests Socket.IO communication, AI speech generation, and debate flow
 */

const io = require('socket.io-client');
const axios = require('axios');

// Simple color functions without chalk
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const SOCKET_PATH = '/api/socketio';

// Test configuration
const TEST_TOPIC = 'Should schools implement a four-day work week?';
const TEST_USER_ID = 'test-user-' + Date.now();
const TEST_DEBATE_ID = 'test-debate-' + Date.now();

// Color logging
const log = {
  info: (msg) => console.log(colors.blue('ℹ'), msg),
  success: (msg) => console.log(colors.green('✓'), msg),
  error: (msg) => console.log(colors.red('✗'), msg),
  warn: (msg) => console.log(colors.yellow('⚠'), msg),
  data: (label, data) => console.log(colors.gray(`[${label}]`), JSON.stringify(data, null, 2))
};

class DebateTester {
  constructor() {
    this.socket = null;
    this.testResults = {
      passed: [],
      failed: []
    };
  }

  async runAllTests() {
    console.log(colors.bold(colors.cyan('\n🎯 DebateAI Core Functionality Test Suite\n')));
    
    try {
      // Test 1: Socket.IO Connection
      await this.testSocketConnection();
      
      // Test 2: Join Debate Room
      await this.testJoinDebateRoom();
      
      // Test 3: AI Speech Generation
      await this.testAISpeechGeneration();
      
      // Test 4: Debate Phase Transitions
      await this.testDebatePhaseTransitions();
      
      // Test 5: Real-time Communication
      await this.testRealtimeCommunication();
      
      // Test 6: Error Handling
      await this.testErrorHandling();
      
      // Test 7: Cleanup
      await this.testCleanup();
      
    } catch (error) {
      log.error(`Test suite failed: ${error.message}`);
    } finally {
      this.printResults();
      if (this.socket) {
        this.socket.disconnect();
      }
      process.exit(this.testResults.failed.length > 0 ? 1 : 0);
    }
  }

  async testSocketConnection() {
    log.info('Testing Socket.IO connection...');
    
    return new Promise((resolve, reject) => {
      this.socket = io(BASE_URL, {
        path: SOCKET_PATH,
        transports: ['polling', 'websocket'],
        reconnection: false,
        timeout: 10000,
        auth: {
          token: null // Testing anonymous connection
        }
      });
      
      const timeout = setTimeout(() => {
        this.recordTest('Socket.IO Connection', false, 'Connection timeout');
        reject(new Error('Socket connection timeout'));
      }, 10000);
      
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.recordTest('Socket.IO Connection', true);
        log.data('Connection', {
          socketId: this.socket.id,
          transport: this.socket.io.engine.transport.name,
          connected: this.socket.connected
        });
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this.recordTest('Socket.IO Connection', false, error.message);
        reject(error);
      });
    });
  }

  async testJoinDebateRoom() {
    log.info('Testing join debate room...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.recordTest('Join Debate Room', false, 'Join timeout');
        resolve();
      }, 5000);
      
      // Listen for join confirmation
      this.socket.once('debate:joined', (data) => {
        clearTimeout(timeout);
        this.recordTest('Join Debate Room', true);
        log.data('Join Response', data);
        resolve();
      });
      
      this.socket.once('debate:error', (error) => {
        clearTimeout(timeout);
        this.recordTest('Join Debate Room', false, error.message);
        resolve();
      });
      
      // Emit join event
      this.socket.emit('debate:join', {
        debateId: TEST_DEBATE_ID,
        userId: TEST_USER_ID,
        topic: TEST_TOPIC,
        userSide: 'pro'
      });
    });
  }

  async testAISpeechGeneration() {
    log.info('Testing AI speech generation...');
    
    try {
      // Test OpenAI argument generation
      const response = await axios.post(`${BASE_URL}/api/prototype/openai-argument`, {
        topic: TEST_TOPIC,
        stance: 'pro'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      
      if (response.data && response.data.argument) {
        this.recordTest('AI Speech Generation', true);
        log.data('AI Argument', {
          length: response.data.argument.length,
          preview: response.data.argument.substring(0, 100) + '...'
        });
      } else {
        this.recordTest('AI Speech Generation', false, 'No argument returned');
      }
    } catch (error) {
      this.recordTest('AI Speech Generation', false, error.message);
    }
  }

  async testDebatePhaseTransitions() {
    log.info('Testing debate phase transitions...');
    
    return new Promise((resolve) => {
      let phasesReceived = 0;
      const expectedPhases = ['constructive', 'rebuttal', 'summary'];
      
      const timeout = setTimeout(() => {
        this.recordTest('Debate Phase Transitions', phasesReceived > 0, 
          `Only received ${phasesReceived} phase transitions`);
        resolve();
      }, 5000);
      
      // Listen for phase changes
      this.socket.on('debate:phaseChange', (data) => {
        phasesReceived++;
        log.data('Phase Change', data);
        
        if (phasesReceived >= expectedPhases.length) {
          clearTimeout(timeout);
          this.recordTest('Debate Phase Transitions', true);
          resolve();
        }
      });
      
      // Trigger phase changes
      expectedPhases.forEach((phase, index) => {
        setTimeout(() => {
          this.socket.emit('debate:requestPhaseChange', {
            debateId: TEST_DEBATE_ID,
            newPhase: phase
          });
        }, index * 1000);
      });
    });
  }

  async testRealtimeCommunication() {
    log.info('Testing real-time communication...');
    
    return new Promise((resolve) => {
      const testMessage = {
        type: 'speech',
        content: 'This is a test speech message',
        speakerId: TEST_USER_ID,
        timestamp: Date.now()
      };
      
      const timeout = setTimeout(() => {
        this.recordTest('Real-time Communication', false, 'Message echo timeout');
        resolve();
      }, 3000);
      
      // Listen for message broadcast
      this.socket.once('debate:message', (data) => {
        clearTimeout(timeout);
        const success = data.content === testMessage.content;
        this.recordTest('Real-time Communication', success);
        log.data('Message Echo', data);
        resolve();
      });
      
      // Send test message
      this.socket.emit('debate:sendMessage', {
        debateId: TEST_DEBATE_ID,
        message: testMessage
      });
    });
  }

  async testErrorHandling() {
    log.info('Testing error handling...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.recordTest('Error Handling', false, 'No error response received');
        resolve();
      }, 3000);
      
      // Listen for error response
      this.socket.once('debate:error', (error) => {
        clearTimeout(timeout);
        this.recordTest('Error Handling', true, 'Error properly handled');
        log.data('Error Response', error);
        resolve();
      });
      
      // Send invalid request
      this.socket.emit('debate:join', {
        // Missing required fields
        debateId: null,
        userId: null
      });
    });
  }

  async testCleanup() {
    log.info('Testing cleanup and disconnection...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.recordTest('Cleanup', false, 'Disconnect timeout');
        resolve();
      }, 3000);
      
      this.socket.once('disconnect', () => {
        clearTimeout(timeout);
        this.recordTest('Cleanup', true);
        resolve();
      });
      
      // Leave debate room
      this.socket.emit('debate:leave', {
        debateId: TEST_DEBATE_ID,
        userId: TEST_USER_ID
      });
      
      // Disconnect after a short delay
      setTimeout(() => {
        this.socket.disconnect();
      }, 500);
    });
  }

  recordTest(name, passed, error = null) {
    const result = { name, passed, error, timestamp: new Date().toISOString() };
    
    if (passed) {
      this.testResults.passed.push(result);
      log.success(`${name} - PASSED`);
    } else {
      this.testResults.failed.push(result);
      log.error(`${name} - FAILED${error ? ': ' + error : ''}`);
    }
  }

  printResults() {
    console.log(colors.bold(colors.cyan('\n📊 Test Results Summary\n')));
    
    const total = this.testResults.passed.length + this.testResults.failed.length;
    const passRate = total > 0 ? 
      ((this.testResults.passed.length / total) * 100).toFixed(1) : 0;
    
    console.log(colors.green(`  ✓ Passed: ${this.testResults.passed.length}`));
    console.log(colors.red(`  ✗ Failed: ${this.testResults.failed.length}`));
    console.log(colors.yellow(`  📈 Pass Rate: ${passRate}%`));
    
    if (this.testResults.failed.length > 0) {
      console.log(colors.red('\n❌ Failed Tests:'));
      this.testResults.failed.forEach(test => {
        console.log(colors.red(`  - ${test.name}: ${test.error || 'Unknown error'}`));
      });
    }
    
    console.log('');
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    if (response.status === 200) {
      log.success('Server is healthy');
      return true;
    }
  } catch (error) {
    log.error(`Server health check failed: ${error.message}`);
    console.log(colors.yellow('\nPlease ensure the server is running:'));
    console.log(colors.gray('  npm run dev\n'));
    return false;
  }
}

// Main execution
async function main() {
  console.log(colors.bold('🚀 DebateAI Core Functionality Tester'));
  console.log(colors.gray(`Testing against: ${BASE_URL}\n`));
  
  // Check server health first
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    process.exit(1);
  }
  
  // Run tests
  const tester = new DebateTester();
  await tester.runAllTests();
}

// Run the tests
main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});