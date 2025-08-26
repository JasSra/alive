#!/usr/bin/env node
/**
 * Test WebSocket connection to the server
 */

const WebSocket = require('ws');

const wsUrl = 'ws://localhost:3000/api/events/ws';
console.log('Connecting to:', wsUrl);

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
  console.log('✅ WebSocket connected successfully');
  
  // Send a ping
  ws.send('ping');
  console.log('📤 Sent ping');
  
  // Close after 2 seconds
  setTimeout(() => {
    ws.close();
  }, 2000);
});

ws.on('message', function message(data) {
  console.log('📥 Received:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 WebSocket closed:', code, reason.toString());
});

// Timeout after 10 seconds
setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CLOSED) {
    console.error('❌ Connection timeout');
    ws.terminate();
    process.exit(1);
  }
}, 10000);
