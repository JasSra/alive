#!/usr/bin/env node
/**
 * Simple script to populate the ingest store with HTTP request data for testing
 */

const baseUrl = 'http://localhost:3002';

// Sample request data
const requests = [
  {
    kind: 'request',
    service: 'web-api', 
    method: 'GET',
    path: '/api/users',
    status: 200,
    duration_ms: 150,
    attrs: {
      clientIp: '192.168.1.100',
      correlationId: 'req-' + Date.now() + '-abc123',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  },
  {
    kind: 'request',
    service: 'web-api',
    method: 'POST', 
    path: '/api/users',
    status: 201,
    duration_ms: 285,
    attrs: {
      clientIp: '192.168.1.101',
      correlationId: 'req-' + Date.now() + '-def456',
      userAgent: 'curl/7.68.0'
    }
  },
  {
    kind: 'request',
    service: 'web-api',
    method: 'GET',
    path: '/api/orders',
    status: 500,
    duration_ms: 2500,
    attrs: {
      clientIp: '192.168.1.102',
      correlationId: 'req-' + Date.now() + '-ghi789',
      userAgent: 'PostmanRuntime/7.28.4'
    }
  },
  {
    kind: 'request',
    service: 'auth-service',
    method: 'POST',
    path: '/auth/login',
    status: 403,
    duration_ms: 125,
    attrs: {
      clientIp: '10.0.0.50',
      correlationId: 'req-' + Date.now() + '-jkl012',
      userAgent: 'axios/0.24.0'
    }
  },
  {
    kind: 'request',
    service: 'payment-api',
    method: 'POST',
    path: '/payments/charge',
    status: 200,
    duration_ms: 850,
    attrs: {
      clientIp: '192.168.1.200',
      correlationId: 'req-' + Date.now() + '-mno345',
      userAgent: 'fetch'
    }
  }
];

async function sendRequest(requestData) {
  try {
    const response = await fetch(`${baseUrl}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    if (response.ok) {
      console.log(`✅ Sent ${requestData.method} ${requestData.path} - ${requestData.status}`);
    } else {
      console.log(`❌ Failed to send request: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('Populating ingest store with sample HTTP requests...\n');
  
  for (const req of requests) {
    await sendRequest(req);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\nDone! Check the requests dashboard at http://localhost:3002/requests');
}

main().catch(console.error);
