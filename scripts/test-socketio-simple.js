#!/usr/bin/env node

/**
 * Simple Socket.IO connection test
 */

const io = require('socket.io-client');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testConnection() {
  console.log(`Testing Socket.IO connection to ${BASE_URL}`);
  
  const socket = io(BASE_URL, {
    path: '/api/socketio',
    transports: ['polling', 'websocket'],
    reconnection: false,
    timeout: 10000,
    debug: true
  });

  socket.on('connect', () => {
    console.log('✅ Connected successfully!');
    console.log('Socket ID:', socket.id);
    console.log('Transport:', socket.io.engine.transport.name);
    socket.disconnect();
    process.exit(0);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
    console.error('Error type:', error.type);
    console.error('Full error:', error);
    process.exit(1);
  });

  socket.io.on('error', (error) => {
    console.error('❌ Socket.IO error:', error);
  });

  // Log all events
  const onevent = socket.onevent;
  socket.onevent = function (packet) {
    console.log('Event received:', packet.data);
    onevent.call(this, packet);
  };

  setTimeout(() => {
    console.error('❌ Connection timeout');
    socket.disconnect();
    process.exit(1);
  }, 15000);
}

// Check server first
const axios = require('axios');

async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.error('❌ Server is not running');
    return false;
  }
}

async function main() {
  const serverOk = await checkServer();
  if (!serverOk) {
    console.log('Please start the server with: npm run dev');
    process.exit(1);
  }
  
  await testConnection();
}

main().catch(console.error);