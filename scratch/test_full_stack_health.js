const https = require('https');

const TARGETS = [
  'https://workstream-backend-1rr8.onrender.com',
  'https://teamhub-backend-p5a1.onrender.com'
];

function request(url, options = {}, body = null) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const reqOpts = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    };

    const req = https.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json: json,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ error: err.message, statusCode: 0 });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'TIMEOUT', statusCode: 0 });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🚀 FULL-STACK SYSTEM AUDIT: DB, REDIS, POSITIVE & NEGATIVE SCENARIOS');
  console.log('===============================================================\n');

  // Test 1: Frontend Live Check
  console.log('--- 1. FRONTEND VERCEL DEPLOYMENT ---');
  const feRes = await request('https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app');
  console.log(`[Frontend Vercel] Status: ${feRes.statusCode} ${feRes.statusCode === 200 ? '✅ ACTIVE' : '❌'}`);

  for (const base of TARGETS) {
    console.log(`\n===============================================================`);
    console.log(`📡 TESTING TARGET: ${base}`);
    console.log(`===============================================================`);

    // 2. Health, Database & Redis
    console.log('\n--- 2. INFRASTRUCTURE: POSTGRESQL & REDIS CONNECTIVITY ---');
    const healthRes = await request(`${base}/health`);
    console.log(`[/health] Status: ${healthRes.statusCode}, Data:`, healthRes.json || healthRes.body.slice(0, 100));

    const apiHealthRes = await request(`${base}/task_management/api/v1/health`);
    console.log(`[/task_management/api/v1/health] Status: ${apiHealthRes.statusCode}, Data:`, apiHealthRes.json || apiHealthRes.body.slice(0, 100));

    // 3. Positive Auth Test
    console.log('\n--- 3. AUTHENTICATION (POSITIVE SCENARIOS) ---');
    const loginRes = await request(`${base}/task_management/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: 'admin@teamboard.com',
      password: 'Admin@123',
    });

    let token = null;
    let refreshToken = null;
    if (loginRes.statusCode === 200 && loginRes.json) {
      token = loginRes.json.accessToken;
      refreshToken = loginRes.json.refreshToken;
      console.log(`[POST /auth/login] HTTP 200 OK ✅ - Token Issued (User: ${loginRes.json.user?.name}, Role: ${loginRes.json.user?.role})`);
    } else {
      // Try teamhub email
      const loginRes2 = await request(`${base}/task_management/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, {
        email: 'admin@teamhub.com',
        password: 'Admin@123',
      });
      if (loginRes2.statusCode === 200 && loginRes2.json) {
        token = loginRes2.json.accessToken;
        refreshToken = loginRes2.json.refreshToken;
        console.log(`[POST /auth/login] HTTP 200 OK ✅ - Token Issued (User: ${loginRes2.json.user?.name}, Role: ${loginRes2.json.user?.role})`);
      } else {
        console.log(`[POST /auth/login] HTTP ${loginRes.statusCode} ❌ Response:`, loginRes.json || loginRes.body);
      }
    }

    if (token) {
      const meRes = await request(`${base}/task_management/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`[GET /auth/me] HTTP ${meRes.statusCode} ${meRes.statusCode === 200 ? '✅ OK' : '❌'}`);
    }

    // 4. Negative Auth Tests
    console.log('\n--- 4. AUTHENTICATION (NEGATIVE SCENARIOS) ---');
    const badPassRes = await request(`${base}/task_management/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: 'admin@teamboard.com',
      password: 'WrongPassword999!',
    });
    console.log(`[Negative: Wrong Password] HTTP ${badPassRes.statusCode} ${badPassRes.statusCode === 401 ? '✅ Correctly 401 Unauthorized' : '❌'}`);

    const badEmailRes = await request(`${base}/task_management/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      email: 'not-an-email-string',
      password: 'Admin@123',
    });
    console.log(`[Negative: Invalid Email Format] HTTP ${badEmailRes.statusCode} ${badEmailRes.statusCode === 422 ? '✅ Correctly 422 Unprocessable' : '❌'}`);

    const noAuthMeRes = await request(`${base}/task_management/api/v1/auth/me`);
    console.log(`[Negative: /auth/me without Token] HTTP ${noAuthMeRes.statusCode} ${noAuthMeRes.statusCode === 401 ? '✅ Correctly 401 Unauthorized' : '❌'}`);

    // 5. Projects & Tasks Tests
    console.log('\n--- 5. PROJECTS & TASKS (POSITIVE SCENARIOS) ---');
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const projectsRes = await request(`${base}/task_management/api/v1/projects`, { headers: authHeaders });
    const pCount = Array.isArray(projectsRes.json) ? projectsRes.json.length : (projectsRes.json?.items?.length || 0);
    console.log(`[GET /projects] HTTP ${projectsRes.statusCode} ${projectsRes.statusCode === 200 ? '✅ OK' : '❌'} - Count: ${pCount}`);

    const tasksRes = await request(`${base}/task_management/api/v1/tasks`, { headers: authHeaders });
    const tCount = Array.isArray(tasksRes.json) ? tasksRes.json.length : (tasksRes.json?.items?.length || 0);
    console.log(`[GET /tasks] HTTP ${tasksRes.statusCode} ${tasksRes.statusCode === 200 ? '✅ OK' : '❌'} - Count: ${tCount}`);

    // 6. Dashboard & Analytics Tests
    console.log('\n--- 6. DASHBOARD & ANALYTICS (CACHE & METRICS) ---');
    const dashRes = await request(`${base}/task_management/api/v1/dashboard/stats`, { headers: authHeaders });
    console.log(`[GET /dashboard/stats] HTTP ${dashRes.statusCode} ${dashRes.statusCode === 200 ? '✅ OK' : '❌'}`);

    const analyticsRes = await request(`${base}/task_management/api/v1/analytics/data`, { headers: authHeaders });
    console.log(`[GET /analytics/data] HTTP ${analyticsRes.statusCode} ${analyticsRes.statusCode === 200 ? '✅ OK' : '❌'}`);

    // 7. HTMX Endpoints
    console.log('\n--- 7. HTMX SERVER-RENDERED DASHBOARD ---');
    const htmxDashRes = await request(`${base}/htmx/dashboard`);
    console.log(`[GET /htmx/dashboard] HTTP ${htmxDashRes.statusCode} ${htmxDashRes.statusCode === 200 ? '✅ HTML Rendered' : '❌'}`);

    const htmxStatsRes = await request(`${base}/htmx/dashboard/stats`);
    console.log(`[GET /htmx/dashboard/stats] HTTP ${htmxStatsRes.statusCode} ${htmxStatsRes.statusCode === 200 ? '✅ Fragment Rendered' : '❌'}`);
  }

  console.log('\n===============================================================');
  console.log('🏁 FULL AUDIT COMPLETE');
  console.log('===============================================================\n');
}

runTestSuite();

