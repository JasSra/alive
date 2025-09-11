#!/usr/bin/env node

/**
 * Comprehensive Data Generator for ALIVE Monitoring System
 * 
 * Generates realistic telemetry data in multiple formats:
 * - OTLP (OpenTelemetry) logs, traces, and metrics
 * - Syslog format messages
 * - HTTP requests and responses
 * - Custom events
 * - Raw data (business metrics, IoT sensors, etc.)
 * 
 * Usage:
 *   node comprehensive-data-generator.js                    # Run once with default settings
 *   node comprehensive-data-generator.js --continuous      # Run continuously
 *   node comprehensive-data-generator.js --port 3001       # Custom port
 *   node comprehensive-data-generator.js --interval 2000   # Custom interval (ms)
 *   node comprehensive-data-generator.js --batch-size 10   # Custom batch size
 */

// Configuration
const config = {
  baseUrl: 'http://localhost:3001',
  interval: 3000,       // milliseconds between batches
  batchSize: 8,         // items per batch
  continuous: false,    // run once or continuously
  verbose: true         // detailed logging
};

// Parse command line arguments
process.argv.forEach((arg, index) => {
  const nextArg = process.argv[index + 1];
  
  switch (arg) {
    case '--port':
      if (nextArg) config.baseUrl = `http://localhost:${nextArg}`;
      break;
    case '--interval':
      if (nextArg) config.interval = parseInt(nextArg);
      break;
    case '--batch-size':
      if (nextArg) config.batchSize = parseInt(nextArg);
      break;
    case '--continuous':
      config.continuous = true;
      break;
    case '--quiet':
      config.verbose = false;
      break;
  }
});

// Utility functions
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) => 
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

// Data generators
const services = ['auth-service', 'user-service', 'payment-service', 'notification-service', 'analytics-service', 'api-gateway', 'database-service'];
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const httpPaths = ['/api/users', '/api/auth/login', '/api/payments', '/api/notifications', '/health', '/metrics', '/api/products'];
const logLevels = ['debug', 'info', 'warn', 'error'];
const severityLevels = [0, 1, 2, 3, 4]; // debug, info, notice, warning, error
const userIds = ['user_123', 'user_456', 'user_789', 'admin_001', 'service_bot'];

function generateOTLPLogs() {
  const timestamp = Date.now() * 1000000; // nanoseconds
  const service = randomChoice(services);
  
  return {
    resourceLogs: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: service } },
          { key: 'service.version', value: { stringValue: '1.0.0' } },
          { key: 'deployment.environment', value: { stringValue: randomChoice(['prod', 'staging', 'dev']) } }
        ]
      },
      scopeLogs: [{
        scope: {
          name: 'application-logger',
          version: '1.0'
        },
        logRecords: [{
          timeUnixNano: timestamp.toString(),
          severityNumber: randomChoice(severityLevels),
          severityText: randomChoice(logLevels).toUpperCase(),
          body: {
            stringValue: randomChoice([
              'Request processed successfully',
              'Database connection established',
              'Cache miss, fetching from database',
              'Authentication successful',
              'Payment processed',
              'User session expired',
              'Rate limit exceeded',
              'Internal server error occurred'
            ])
          },
          attributes: [
            { key: 'user.id', value: { stringValue: randomChoice(userIds) } },
            { key: 'request.id', value: { stringValue: `req_${Math.random().toString(36).substr(2, 9)}` } },
            { key: 'duration.ms', value: { intValue: randomInt(10, 2000).toString() } }
          ]
        }]
      }]
    }]
  };
}

function generateOTLPTraces() {
  const timestamp = Date.now() * 1000000;
  const service = randomChoice(services);
  const traceId = Array.from({length: 32}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const spanId = Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  
  return {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: service } }
        ]
      },
      scopeSpans: [{
        scope: { name: 'tracer' },
        spans: [{
          traceId,
          spanId,
          name: randomChoice(['http_request', 'database_query', 'cache_lookup', 'external_api_call']),
          kind: 3, // SPAN_KIND_CLIENT
          startTimeUnixNano: timestamp.toString(),
          endTimeUnixNano: (timestamp + randomInt(1000000, 50000000)).toString(),
          attributes: [
            { key: 'http.method', value: { stringValue: randomChoice(httpMethods) } },
            { key: 'http.url', value: { stringValue: `${config.baseUrl}${randomChoice(httpPaths)}` } },
            { key: 'http.status_code', value: { intValue: randomChoice([200, 201, 400, 404, 500]).toString() } }
          ]
        }]
      }]
    }]
  };
}

function generateSyslogMessage() {
  const priority = randomInt(0, 191); // facility * 8 + severity
  const timestamp = new Date().toISOString();
  const hostname = randomChoice(['web-01', 'api-02', 'db-03', 'cache-04']);
  const service = randomChoice(services);
  const message = randomChoice([
    'Connection established from client',
    'Query executed successfully',
    'Cache invalidated for key',
    'User authentication failed',
    'Backup process completed',
    'Memory usage above threshold',
    'Disk space running low',
    'Service health check passed'
  ]);
  
  return `<${priority}>${timestamp} ${hostname} ${service}[${randomInt(1000, 9999)}]: ${message}`;
}

function generateHttpRequest() {
  const method = randomChoice(httpMethods);
  const path = randomChoice(httpPaths);
  const status = randomChoice([200, 200, 200, 201, 400, 404, 500]); // weighted towards success
  
  return {
    method,
    path,
    status,
    duration_ms: randomInt(10, 2000),
    service: randomChoice(services),
    user_agent: randomChoice(['Mozilla/5.0', 'curl/7.68.0', 'PostmanRuntime/7.28.0']),
    remote_addr: `192.168.1.${randomInt(1, 254)}`,
    request_size: randomInt(100, 5000),
    response_size: randomInt(500, 50000)
  };
}

function generateEvent() {
  const eventTypes = ['user_login', 'user_logout', 'payment_completed', 'order_placed', 'file_uploaded', 'notification_sent'];
  
  return {
    event: randomChoice(eventTypes),
    service: randomChoice(services),
    user_id: randomChoice(userIds),
    timestamp: new Date().toISOString(),
    metadata: {
      source: randomChoice(['web', 'mobile', 'api']),
      version: randomChoice(['1.0.0', '1.1.0', '2.0.0']),
      session_id: `sess_${Math.random().toString(36).substr(2, 12)}`
    }
  };
}

function generateRawData() {
  const rawDataTypes = [
    // Business metrics
    () => ({
      business_metric: 'daily_revenue',
      value: randomFloat(1000, 50000),
      currency: 'USD',
      region: randomChoice(['us-east', 'us-west', 'eu-central', 'asia-pacific']),
      breakdown: {
        subscriptions: randomFloat(500, 20000),
        one_time: randomFloat(200, 15000),
        enterprise: randomFloat(300, 15000)
      }
    }),
    
    // IoT sensor data
    () => ({
      sensor_id: `temp_${randomInt(1, 20).toString().padStart(2, '0')}`,
      temperature: randomFloat(18, 35, 1),
      humidity: randomFloat(30, 80, 1),
      pressure: randomFloat(980, 1040, 1),
      location: randomChoice(['server_room_a', 'office_floor_2', 'warehouse_dock']),
      battery_level: randomInt(20, 100),
      last_maintenance: new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000).toISOString()
    }),
    
    // User analytics
    () => ({
      analytics_event: 'user_engagement',
      session_duration: randomInt(30, 7200), // seconds
      page_views: randomInt(1, 50),
      clicks: randomInt(0, 100),
      user_id: randomChoice(userIds),
      device_type: randomChoice(['desktop', 'mobile', 'tablet']),
      browser: randomChoice(['chrome', 'firefox', 'safari', 'edge']),
      conversion_funnel: {
        step_1: randomInt(0, 1),
        step_2: randomInt(0, 1),
        step_3: randomInt(0, 1),
        completed: randomInt(0, 1)
      }
    }),
    
    // System metrics
    () => ({
      system_metrics: 'performance_snapshot',
      cpu_usage: randomFloat(0, 100, 1),
      memory_usage: randomFloat(0, 100, 1),
      disk_usage: randomFloat(0, 100, 1),
      network_in: randomInt(1000, 1000000), // bytes
      network_out: randomInt(1000, 1000000),
      active_connections: randomInt(10, 1000),
      node_id: randomChoice(['node-01', 'node-02', 'node-03']),
      cluster: 'production'
    }),
    
    // Custom application data
    () => ({
      custom_data: true,
      feature_flags: {
        new_ui: randomChoice([true, false]),
        beta_feature: randomChoice([true, false]),
        maintenance_mode: false
      },
      experiment_results: {
        variant: randomChoice(['A', 'B', 'control']),
        conversion_rate: randomFloat(0, 10, 3),
        sample_size: randomInt(100, 10000)
      },
      application_id: 'alive-monitoring',
      deployment_version: '2.1.5'
    })
  ];
  
  return randomChoice(rawDataTypes)();
}

// Send data to ingest endpoint
async function sendToIngest(data, type = 'mixed') {
  try {
    const response = await fetch(`${config.baseUrl}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (config.verbose) {
      console.log(`[${type}]:`, result.success ? 'SUCCESS' : 'FAILED', result.byKind || result.message);
    }
    
    return result;
  } catch (error) {
    console.error(`[ERROR] ${type}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Generate and send a batch of mixed data
async function generateBatch() {
  const generators = [
    { fn: generateOTLPLogs, type: 'OTLP Logs', weight: 2 },
    { fn: generateOTLPTraces, type: 'OTLP Traces', weight: 1 },
    { fn: generateSyslogMessage, type: 'Syslog', weight: 2 },
    { fn: generateHttpRequest, type: 'HTTP Request', weight: 3 },
    { fn: generateEvent, type: 'Event', weight: 2 },
    { fn: generateRawData, type: 'Raw Data', weight: 3 }
  ];
  
  const batch = [];
  
  for (let i = 0; i < config.batchSize; i++) {
    // Weighted random selection
    const weights = generators.flatMap(g => Array(g.weight).fill(g));
    const selected = randomChoice(weights);
    
    const data = selected.fn();
    batch.push({ data, type: selected.type });
  }
  
  console.log(`\nGenerating batch of ${config.batchSize} items...`);
  
  for (const item of batch) {
    await sendToIngest(item.data, item.type);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between items
  }
  
  // Get updated metrics
  try {
    const metricsResponse = await fetch(`${config.baseUrl}/api/ingest/metrics`);
    const metrics = await metricsResponse.json();
    
    if (metrics.ok) {
      console.log(`\nCurrent metrics:`, metrics.counts);
      if (metrics.statusHisto && Object.keys(metrics.statusHisto).length > 0) {
        console.log(`Status histogram:`, metrics.statusHisto);
      }
    }
  } catch (error) {
    console.error('Error fetching metrics:', error.message);
  }
}

// Main execution
async function main() {
  console.log('ALIVE Comprehensive Data Generator');
  console.log(`Target: ${config.baseUrl}`);
  console.log(`Batch size: ${config.batchSize}, Interval: ${config.interval}ms`);
  console.log(`Mode: ${config.continuous ? 'Continuous' : 'Single batch'}`);
  console.log('='.repeat(60));
  
  console.log('Starting single batch generation...');
  
  try {
    await generateBatch();
    console.log('\nSingle batch complete!');
    console.log('\nTips:');
    console.log('  • Use --continuous for ongoing data generation');
    console.log('  • Use --interval 1000 for faster generation');
    console.log('  • Check http://localhost:3001/events for live monitoring');
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the generator
console.log('Script starting...');
main().catch(error => {
  console.error('Main error:', error);
  process.exit(1);
});
