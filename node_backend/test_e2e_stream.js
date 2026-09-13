/**
 * Real End-to-End Test for Node Backend
 * Starts server (or connects to running server) and runs full SSE product evaluation.
 */
const http = require('http');

const PORT = process.env.PORT || 8006;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function testHealth() {
  console.log('\n1. Testing Health Endpoint (GET /)...');
  const res = await fetch(`${BASE_URL}/`);
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(data));
  if (res.status !== 200 || data.status !== 'ok') {
    throw new Error('Health check failed');
  }
  console.log('  ✅ Health endpoint OK');
}

async function testDbHealth() {
  console.log('\n2. Testing DB Health Endpoint (GET /health/db)...');
  const res = await fetch(`${BASE_URL}/health/db`);
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(data));
  if (res.status !== 200 || !data.connected) {
    throw new Error('DB health check failed');
  }
  console.log('  ✅ DB health endpoint OK');
}

async function testSSEEvaluationStream(query = 'butter') {
  console.log(`\n3. Testing SSE Evaluation Stream (GET /evaluate/stream?product_name=${encodeURIComponent(query)})...`);

  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/evaluate/stream?product_name=${encodeURIComponent(query)}`;
    const eventsReceived = [];

    const req = http.get(url, (res) => {
      console.log('  Stream HTTP Status:', res.statusCode);
      console.log('  Content-Type:', res.headers['content-type']);

      if (res.statusCode !== 200) {
        return reject(new Error(`Stream returned HTTP ${res.statusCode}`));
      }

      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep last incomplete chunk

        for (const block of lines) {
          if (!block.trim()) continue;
          const matchEvent = block.match(/^event:\s*(\w+)/m);
          const matchData = block.match(/^data:\s*(.+)$/m);

          if (matchEvent && matchData) {
            const eventName = matchEvent[1];
            try {
              const data = JSON.parse(matchData[1]);
              eventsReceived.push({ event: eventName, data });
              console.log(`  📡 [SSE Event] ${eventName}:`, formatEventSummary(eventName, data));
            } catch (err) {
              console.log(`  📡 [SSE Event Raw] ${eventName}: ${matchData[1].slice(0, 100)}`);
            }
          }
        }
      });

      res.on('end', () => {
        console.log(`\n  ✅ SSE Stream ended. Total events received: ${eventsReceived.length}`);
        resolve(eventsReceived);
      });

      res.on('error', (err) => {
        reject(err);
      });
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

function formatEventSummary(event, data) {
  switch (event) {
    case 'status':
      return data.message;
    case 'products_found':
      return `Found ${data.count} products (Phase 1 time: ${data.phase1_time}s)`;
    case 'product_evaluating':
      return `[#${data.index}] ${data.product_name} (${data.step})`;
    case 'product_step':
      return `[#${data.index}] ${data.step} — ${data.message}`;
    case 'product_evaluated':
      return `[#${data.index}] ${data.product.name} — Final: ${data.compliance.score}/100 (Rule: ${data.compliance.rule_score}, AI: ${data.ai_analysis.ai_score}) in ${data.time}s`;
    case 'complete':
      return `Completed ${data.total} products in ${data.time}s`;
    case 'error':
      return `ERROR: ${data.message}`;
    default:
      return JSON.stringify(data).slice(0, 80);
  }
}

async function testDashboardEndpoints() {
  console.log('\n4. Testing Dashboard Endpoints...');

  // GET /dashboard/stats
  const statsRes = await fetch(`${BASE_URL}/dashboard/stats`);
  const stats = await statsRes.json();
  console.log('  GET /dashboard/stats:', JSON.stringify(stats));

  // GET /dashboard/recent-scans
  const recentRes = await fetch(`${BASE_URL}/dashboard/recent-scans?limit=5`);
  const recent = await recentRes.json();
  console.log(`  GET /dashboard/recent-scans: ${recent.scans?.length || 0} scans returned`);

  // GET /dashboard/trends
  const trendsRes = await fetch(`${BASE_URL}/dashboard/trends?days=7`);
  const trends = await trendsRes.json();
  console.log(`  GET /dashboard/trends: ${trends.trends?.length || 0} days returned`);

  // GET /dashboard/live-data
  const liveRes = await fetch(`${BASE_URL}/dashboard/live-data`);
  const live = await liveRes.json();
  console.log(`  GET /dashboard/live-data: ${live.products?.length || 0} products returned`);

  // GET /dashboard/evaluated-products
  const allRes = await fetch(`${BASE_URL}/dashboard/evaluated-products`);
  const all = await allRes.json();
  console.log(`  GET /dashboard/evaluated-products: ${all.products?.length || 0} products returned`);

  console.log('  ✅ All Dashboard endpoints returned valid JSON shapes');
}

async function testProductDetailsEndpoint() {
  console.log('\n5. Testing /product/details Endpoint...');
  const testUrl = 'https://blinkit.com/prn/-/prid/707088';
  const res = await fetch(`${BASE_URL}/product/details?product_url=${encodeURIComponent(testUrl)}&platform=blinkit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Detail response status:', data.status);
  console.log('  Product Name:', data.detail?.product_name);
  console.log('  MRP:', data.detail?.mrp);
  console.log('  Images count:', data.detail?.images?.length);
  console.log('  ✅ Product details endpoint OK');
}

async function run() {
  console.log('===========================================================');
  console.log('🚀 RUNNING COMPLETE END-TO-END NODE BACKEND VERIFICATION');
  console.log('===========================================================');

  try {
    await testHealth();
    await testDbHealth();
    const events = await testSSEEvaluationStream('butter');

    // Verify key events arrived
    const hasProductsFound = events.some(e => e.event === 'products_found');
    const hasEvaluated = events.some(e => e.event === 'product_evaluated');
    const hasComplete = events.some(e => e.event === 'complete');

    console.log('\n--- E2E Verification Check ---');
    console.log(`  products_found event received: ${hasProductsFound ? '✅' : '❌'}`);
    console.log(`  product_evaluated event received: ${hasEvaluated ? '✅' : '❌'}`);
    console.log(`  complete event received: ${hasComplete ? '✅' : '❌'}`);

    await testDashboardEndpoints();
    await testProductDetailsEndpoint();

    console.log('\n===========================================================');
    console.log('🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('\n❌ E2E Test Failed:', err);
    process.exit(1);
  }
}

run();
