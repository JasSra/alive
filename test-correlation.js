#!/usr/bin/env node
/**
 * Test correlation ID matching with the user's specific format
 */

const baseUrl = 'http://localhost:3000';
const correlationId = 'corr-1756278124529-a52ah90df';

async function postEvent(eventName, payload) {
  try {
    const response = await fetch(`${baseUrl}/api/events/track/${eventName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    console.log(`${eventName}: ${response.status} - ${result}`);
    return response.ok;
  } catch (error) {
    console.error(`${eventName}: Error -`, error.message);
    return false;
  }
}

async function testCorrelation() {
  console.log(`Testing correlation ID: ${correlationId}`);
  
  // Send request event (statusCode 0)
  console.log('\n1. Sending request event...');
  await postEvent('test-request', {
    correlationId,
    statusCode: 0,
    userAgent: 'test-client',
    metadata: {
      method: 'GET',
      path: '/api/test'
    }
  });
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send response event (statusCode > 0)
  console.log('\n2. Sending response event...');
  await postEvent('test-response', {
    correlationId,
    statusCode: 200,
    responseTimeMs: 150,
    userAgent: 'test-client',
    metadata: {
      method: 'GET',
      path: '/api/test'
    }
  });
  
  console.log('\n3. Check the dashboard to see if correlation matching worked!');
  console.log(`   Look for correlation ID: ${correlationId}`);
}

testCorrelation().catch(console.error);
