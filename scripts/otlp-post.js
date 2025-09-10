// Quick OTLP ingest test: posts a canonical ExportLogsServiceRequest to /api/ingest/otlp
const endpoint = process.env.ENDPOINT || 'http://localhost:3001/api/ingest/otlp';

const payload = {
  resourceLogs: [
    {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'api-svc' } },
          { key: 'service.version', value: { stringValue: '1.2.3' } },
        ],
      },
      scopeLogs: [
        {
          logRecords: [
            {
              timeUnixNano: '1736265600000000000',
              severityNumber: 9,
              body: { stringValue: 'hello from otlp' },
              attributes: [
                { key: 'env', value: { stringValue: 'dev' } },
                { key: 'http.status_code', value: { intValue: 200 } },
              ],
            },
          ],
        },
      ],
    },
  ],
};

async function main() {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);

    const health = await fetch('http://localhost:3001/api/ingest/health');
    console.log('Health:', health.status, await health.text());
  } catch (e) {
    console.error('Request failed:', e);
    process.exit(1);
  }
}

main();
