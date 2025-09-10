#!/usr/bin/env node

/**
 * OTLP Data Generator - Continuous random data uploader
 * Generates realistic logs, events, and syslog data
 * Usage: node scripts/otlp-data-generator.js [--port 3001] [--interval 2000]
 */

// Use built-in fetch (Node 18+) or fallback to global fetch

// Configuration
const config = {
  baseUrl: 'http://localhost:3001',
  interval: 2000, // milliseconds between uploads
  batchSize: 5, // number of items per batch
};

// Parse command line arguments
process.argv.forEach((arg, index) => {
  if (arg === '--port' && process.argv[index + 1]) {
    config.baseUrl = `http://localhost:${process.argv[index + 1]}`;
  }
  if (arg === '--interval' && process.argv[index + 1]) {
    config.interval = parseInt(process.argv[index + 1]);
  }
});

// Sample data pools
const services = ['api-svc', 'web-svc', 'auth-svc', 'db-svc', 'cache-svc', 'queue-svc', 'search-svc'];
const logLevels = ['info', 'warn', 'error', 'debug', 'trace'];
const endpoints = ['/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/payments', '/health', '/metrics'];
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
];

// Generate realistic IP addresses
const generateIpAddress = () => {
  // Mix of local and public IPs
  const types = ['local', 'public'];
  const type = randomChoice(types);
  
  if (type === 'local') {
    return `192.168.${randomInt(1, 255)}.${randomInt(1, 254)}`;
  } else {
    return `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
  }
};

const logMessages = [
  'User authentication successful',
  'Database connection established',
  'Cache miss for key: user_session_{}',
  'Processing payment request',
  'Sending email notification',
  'Rate limit exceeded for IP: {}',
  'Background job completed successfully',
  'API request validation failed',
  'Memory usage: {}MB',
  'New user registration: {}'
];

const errorMessages = [
  'Connection timeout to external service',
  'Invalid API key provided',
  'Database query failed: table not found',
  'Memory allocation error',
  'Network unreachable',
  'Permission denied for operation',
  'File not found: /tmp/upload_{}',
  'JSON parsing error in request body',
  'SSL certificate verification failed',
  'Rate limit quota exceeded'
];

// Utility functions
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(2);
const generateId = () => Math.random().toString(36).substr(2, 9);
const generateCorrelationId = () => `${Date.now()}-${generateId()}`;

// Data generators
function generateLogEntry() {
  const isError = Math.random() < 0.15; // 15% error rate
  const level = isError ? 'error' : randomChoice(logLevels);
  const service = randomChoice(services);
  const message = isError 
    ? randomChoice(errorMessages).replace('{}', generateId())
    : randomChoice(logMessages).replace('{}', generateId());

  return {
    resourceLogs: [{
      resource: {
        attributes: [{
          key: 'service.name',
          value: { stringValue: service }
        }, {
          key: 'service.version',
          value: { stringValue: '1.0.0' }
        }]
      },
      scopeLogs: [{
        scope: {
          name: 'application-logger',
          version: '1.0.0'
        },
        logRecords: [{
          timeUnixNano: (Date.now() * 1000000).toString(),
          severityNumber: level === 'error' ? 17 : level === 'warn' ? 13 : 9,
          severityText: level.toUpperCase(),
          body: {
            stringValue: message
          },
          attributes: [{
            key: 'correlation.id',
            value: { stringValue: generateCorrelationId() }
          }, {
            key: 'thread.id',
            value: { stringValue: `thread-${randomInt(1, 10)}` }
          }, {
            key: 'user.id',
            value: { stringValue: `user-${randomInt(1000, 9999)}` }
          }]
        }]
      }]
    }]
  };
}

function generateSpanEntry() {
  const service = randomChoice(services);
  const endpoint = randomChoice(endpoints);
  const duration = randomInt(50, 2000); // ms
  const statusCode = Math.random() < 0.1 ? randomChoice([400, 404, 500, 503]) : randomChoice([200, 201, 204]);
  const correlationId = generateCorrelationId();
  const traceId = generateId() + generateId();
  const spanId = generateId();
  
  return {
    resourceSpans: [{
      resource: {
        attributes: [{
          key: 'service.name',
          value: { stringValue: service }
        }]
      },
      scopeSpans: [{
        spans: [{
          traceId: traceId,
          spanId: spanId,
          name: `${endpoint.split('/').pop() || 'request'}`,
          kind: 1, // SPAN_KIND_SERVER
          startTimeUnixNano: ((Date.now() - duration) * 1000000).toString(),
          endTimeUnixNano: (Date.now() * 1000000).toString(),
          attributes: [{
            key: 'http.method',
            value: { stringValue: randomChoice(['GET', 'POST', 'PUT', 'DELETE']) }
          }, {
            key: 'http.url',
            value: { stringValue: `https://api.example.com${endpoint}` }
          }, {
            key: 'http.status_code',
            value: { intValue: statusCode }
          }, {
            key: 'http.user_agent',
            value: { stringValue: randomChoice(userAgents) }
          }, {
            key: 'client.ip',
            value: { stringValue: generateIpAddress() }
          }, {
            key: 'correlation.id',
            value: { stringValue: correlationId }
          }, {
            key: 'trace.id',
            value: { stringValue: traceId }
          }, {
            key: 'span.id',
            value: { stringValue: spanId }
          }, {
            key: 'duration_ms',
            value: { doubleValue: parseFloat(duration) }
          }, {
            key: 'response_time_ms',
            value: { doubleValue: parseFloat(duration) }
          }],
          status: {
            code: statusCode >= 400 ? 2 : 1 // ERROR : OK
          }
        }]
      }]
    }]
  };
}

function generateMetricEntry() {
  const service = randomChoice(services);
  
  return {
    resourceMetrics: [{
      resource: {
        attributes: [{
          key: 'service.name',
          value: { stringValue: service }
        }]
      },
      scopeMetrics: [{
        metrics: [{
          name: 'http_requests_total',
          description: 'Total number of HTTP requests',
          unit: '1',
          sum: {
            dataPoints: [{
              timeUnixNano: (Date.now() * 1000000).toString(),
              asInt: randomInt(100, 1000),
              attributes: [{
                key: 'method',
                value: { stringValue: randomChoice(['GET', 'POST', 'PUT', 'DELETE']) }
              }, {
                key: 'status',
                value: { stringValue: randomChoice(['2xx', '4xx', '5xx']) }
              }]
            }]
          }
        }, {
          name: 'response_time_seconds',
          description: 'HTTP response time in seconds',
          unit: 's',
          histogram: {
            dataPoints: [{
              timeUnixNano: (Date.now() * 1000000).toString(),
              count: randomInt(10, 100),
              sum: parseFloat(randomFloat(0.1, 5.0)),
              bucketCounts: [1, 5, 10, 20, 15, 8, 3, 1],
              explicitBounds: [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
            }]
          }
        }]
      }]
    }]
  };
}

// Upload functions
async function uploadOTLP(endpoint, data) {
  try {
    const response = await fetch(`${config.baseUrl}/api/ingest/otlp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'otlp-data-generator/1.0.0'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error(`❌ Failed to upload ${endpoint}: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`✅ Uploaded ${endpoint} data successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading ${endpoint}:`, error.message);
    return false;
  }
}

// Alternative simple data generators for direct ingest
function generateSimpleLogEntry() {
  const isError = Math.random() < 0.15;
  const levels = ['info', 'warn', 'error', 'debug', 'trace'];
  const level = isError ? 'error' : randomChoice(levels);
  const service = randomChoice(services);
  const message = isError 
    ? randomChoice(errorMessages).replace('{}', generateId())
    : randomChoice(logMessages).replace('{}', generateId());

  return {
    timestamp: new Date().toISOString(),
    level: level,
    service: service,
    message: message,
    correlationId: generateCorrelationId(),
    threadId: `thread-${randomInt(1, 10)}`,
    userId: `user-${randomInt(1000, 9999)}`
  };
}

function generateSimpleRequestEntry() {
  const service = randomChoice(services);
  const endpoint = randomChoice(endpoints);
  const duration = randomInt(50, 2000);
  const statusCode = Math.random() < 0.1 ? randomChoice([400, 404, 500, 503]) : randomChoice([200, 201, 204]);
  
  return {
    timestamp: new Date().toISOString(),
    service: service,
    method: randomChoice(['GET', 'POST', 'PUT', 'DELETE']),
    url: `https://api.example.com${endpoint}`,
    status: statusCode,
    duration_ms: duration,
    userAgent: randomChoice(userAgents),
    responseTimeMs: duration
  };
}

async function uploadSimpleData(data) {
  try {
    const response = await fetch(`${config.baseUrl}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'otlp-data-generator/1.0.0'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error(`❌ Failed to upload simple data: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`✅ Uploaded simple data successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error uploading simple data:`, error.message);
    return false;
  }
}

// Main execution
let isRunning = true;
let uploadCount = 0;

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping data generator...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping data generator...');
  isRunning = false;
});

async function generateAndUpload() {
  if (!isRunning) return;

  console.log(`\n📊 Generating batch ${++uploadCount}...`);
  
  // Mix of OTLP and simple data formats
  const useOTLP = Math.random() < 0.5; // 50% OTLP, 50% simple format
  
  if (useOTLP) {
    // Generate OTLP format data
    for (let i = 0; i < config.batchSize; i++) {
      if (!isRunning) break;
      await uploadOTLP('logs', generateLogEntry());
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate traces
    for (let i = 0; i < Math.ceil(config.batchSize / 2); i++) {
      if (!isRunning) break;
      await uploadOTLP('traces', generateSpanEntry());
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate metrics
    if (uploadCount % 3 === 0) {
      await uploadOTLP('metrics', generateMetricEntry());
    }
  } else {
    // Generate simple format data (easier to parse)
    const simpleData = [];
    
    // Add logs
    for (let i = 0; i < config.batchSize; i++) {
      simpleData.push(generateSimpleLogEntry());
    }
    
    // Add requests
    for (let i = 0; i < Math.ceil(config.batchSize / 2); i++) {
      simpleData.push(generateSimpleRequestEntry());
    }
    
    await uploadSimpleData(simpleData);
  }
  
  // Schedule next batch
  if (isRunning) {
    setTimeout(generateAndUpload, config.interval);
  }
}

// Start the generator
console.log('🚀 Starting OTLP Data Generator...');
console.log(`📡 Target: ${config.baseUrl}`);
console.log(`⏱️  Interval: ${config.interval}ms`);
console.log(`📦 Batch size: ${config.batchSize}`);
console.log('🔄 Press Ctrl+C to stop\n');

// Initial upload
generateAndUpload();
