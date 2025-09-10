#!/usr/bin/env node
/**
 * Demo script to populate the requests dashboard with realistic test data
 */

const baseUrl = 'http://localhost:3001';

// Generate realistic test requests with various patterns
function generateTestRequests() {
  const services = ['web-api', 'auth-service', 'payment-api', 'user-service', 'notification-api'];
  const paths = [
    '/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/auth/logout',
    '/api/payments/charge', '/api/notifications/send', '/api/health', '/api/metrics',
    '/api/search', '/api/upload', '/api/download', '/api/reports'
  ];
  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  const ips = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.50', '10.0.0.51'];
  
  const requests = [];
  const now = Date.now();
  
  // Generate 50 requests over the last hour
  for (let i = 0; i < 50; i++) {
    const timeOffset = Math.random() * 60 * 60 * 1000; // Random time in last hour
    const timestamp = now - timeOffset;
    
    const service = services[Math.floor(Math.random() * services.length)];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const ip = ips[Math.floor(Math.random() * ips.length)];
    
    // Realistic latency distribution
    let duration_ms = Math.floor(Math.random() * 500) + 50; // 50-550ms base
    if (Math.random() < 0.1) duration_ms += Math.floor(Math.random() * 2000); // 10% slow requests
    
    // Status distribution: 80% success, 15% client errors, 5% server errors
    let status;
    const rand = Math.random();
    if (rand < 0.8) {
      status = [200, 201, 204][Math.floor(Math.random() * 3)];
    } else if (rand < 0.95) {
      status = [400, 401, 403, 404][Math.floor(Math.random() * 4)];
    } else {
      status = [500, 502, 503][Math.floor(Math.random() * 3)];
      duration_ms += Math.floor(Math.random() * 3000); // Server errors are slower
    }
    
    requests.push({
      kind: 'request',
      service,
      method,
      path,
      status,
      duration_ms,
      t: timestamp,
      attrs: {
        clientIp: ip,
        correlationId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userAgent: [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'curl/7.68.0',
          'axios/0.24.0',
          'PostmanRuntime/7.28.4',
          'fetch'
        ][Math.floor(Math.random() * 5)]
      }
    });
  }
  
  return requests.sort((a, b) => b.t - a.t); // Sort by timestamp, newest first
}

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
      return { success: true, data: requestData };
    } else {
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Populating Request Dashboard with Demo Data...\n');
  
  const requests = generateTestRequests();
  
  console.log(`📊 Generated ${requests.length} realistic test requests`);
  console.log('   - Time range: Last 60 minutes');
  console.log('   - Multiple services and endpoints');
  console.log('   - Realistic latency and error patterns');
  console.log('   - Various client IPs and user agents\n');
  
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const result = await sendRequest(req);
    
    if (result.success) {
      successful++;
      console.log(`✅ ${i + 1}/${requests.length} - ${req.method} ${req.path} (${req.status}) - ${req.duration_ms}ms`);
    } else {
      failed++;
      console.log(`❌ ${i + 1}/${requests.length} - Failed: ${result.error}`);
    }
    
    // Small delay to avoid overwhelming the server
    if (i < requests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  console.log(`\n📈 Demo Data Population Complete!`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`\n🎯 Now visit: http://localhost:3001/requests`);
  console.log(`\n🔍 Try these features:`);
  console.log(`   • Click any metric card (Total Requests, Success Rate, Latency)`);
  console.log(`   • Click any row in Recent Requests table`);
  console.log(`   • Click the memory indicator in top-right`);
  console.log(`   • View the Request Timeline chart`);
  console.log(`   • Use filters to see how charts update`);
  console.log(`   • Expand JSON objects in request details`);
}

main().catch(console.error);
