require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const path = require('path');

// Basic structured logger & audit logging
const logger = {
  info: (data, msg) => console.log(JSON.stringify({ level: 'info', ...data, msg: msg || '' })),
  error: (msg, err) => {
    if (err instanceof Error) {
        console.error(JSON.stringify({ level: 'error', msg, error: err.message, stack: err.stack }));
    } else {
        console.error(JSON.stringify({ level: 'error', msg, err }));
    }
  },
  warn: (msg, err) => console.warn(JSON.stringify({ level: 'warn', msg, err }))
};

function auditLog(req, action, details) {
  logger.info({
    event: 'AUDIT_EVENT',
    requestId: req?.id,
    action,
    ip: req?.ip,
    details: details || {}
  }, `Audit Event: ${action}`);
}

const app = express();
const port = process.env.PORT || 5000;


// Config - move hardcoded URLs to env
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100;

// Input validation helpers
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Rate limiter
app.set('trust proxy', 1); // Trust first proxy (Render load balancer)
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request Correlation ID Middleware (Observability)
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || req.headers['x-correlation-id'] || crypto.randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
});

// Security Headers & Hardening
app.use(helmet({
    contentSecurityPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
    noSniff: true
}));

// Serve static assets (robots.txt, sitemap.xml, llms.txt, favicons)
app.use(express.static(path.join(__dirname, 'public')));

const allowedOrigins = [
    'https://formbhar-backend-7ir1.onrender.com',
    'http://localhost:5000',
    'http://localhost:3000',
    'http://127.0.0.1:5000'
];
if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => allowedOrigins.push(o.trim()));
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin.startsWith('chrome-extension://') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy violation: Origin not allowed'));
    },
    credentials: true
}));

app.use(express.json());

app.use('/api/', generalLimiter);

// Health Check Endpoint for Render / Uptime Monitoring
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', version: '2.6.0', requestId: req.id, timestamp: new Date().toISOString() });
});

// Simple Request Logging Middleware
app.use((req, res, next) => {
    logger.info({
        requestId: req.id,
        method: req.method,
        url: req.url,
        ip: req.ip
    }, 'Incoming request');
    
    next();
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

// Database Query Wrapper for Observability
async function dbQuery(req, queryText, params) {
    const startTime = Date.now();
    const requestId = req?.id || 'background';
    try {
        const res = await pool.query(queryText, params);
        const duration = Date.now() - startTime;
        logger.info({
            requestId,
            query: queryText.split('\n')[0].substring(0, 100),
            durationMs: duration,
            rows: res.rowCount
        }, 'Database query successful');
        return res;
    } catch (err) {
        const duration = Date.now() - startTime;
        logger.error({
            requestId,
            query: queryText.split('\n')[0].substring(0, 100),
            durationMs: duration,
            error: err.message
        }, 'Database query failed');
        throw err;
    }
}

// Database schema is managed via Supabase.

// Background jobs
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        dbQuery(null, `DELETE FROM sessions WHERE last_ping < NOW() - INTERVAL '1 day';`)
            .catch(err => logger.error('Cleanup error:', err));
    }, 60 * 60 * 1000); // Run every hour
}

// Routes

// 1. Initial User Registration / Update
app.post('/api/register-user', async (req, res) => {
    const { userId, extensionVersion } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        await dbQuery(req,
            `INSERT INTO users (id, extension_version, last_active)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (id) 
       DO UPDATE SET last_active = CURRENT_TIMESTAMP, extension_version = $2;`,
            [userId, extensionVersion || 'unknown']
        );
        auditLog(req, 'USER_REGISTER', { userId, extensionVersion });
        res.json({ success: true, message: 'User registered/updated' });
    } catch (err) {
        logger.error('Error in /register-user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Start Session
app.post('/api/start-session', async (req, res) => {
    const { userId } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        // Ensure user exists first to prevent foreign key constraint violations
        await dbQuery(req,
            `INSERT INTO users (id, extension_version) 
             VALUES ($1, 'unknown') 
             ON CONFLICT (id) DO NOTHING`,
            [userId]
        );

        // Extract IP, Geo, and Device Info
        const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
        let cleanIp = ipAddress || '127.0.0.1';
        if (cleanIp && cleanIp.includes(',')) cleanIp = cleanIp.split(',')[0].trim();
        // Handle local IPv6 representations for testing
        if (cleanIp === '::1' || cleanIp === '127.0.0.1') cleanIp = '127.0.0.1';

        const country = 'Unknown';
        const ua = req.headers['user-agent'] || '';
        const isMobile = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua);
        const deviceString = isMobile ? 'Mobile' : 'Desktop';

        const result = await dbQuery(req,
            `INSERT INTO sessions (user_id, device_type, ip_address, country)
             VALUES ($1, $2, $3, $4)
             RETURNING id;`,
            [userId, deviceString, cleanIp, country]
        );

        res.json({
            success: true,
            sessionId: result.rows[0].id
        });
    } catch (err) {
        logger.error('Error starting session:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Ping Live Session
app.post('/api/ping', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !isValidUUID(sessionId)) return res.status(400).json({ error: 'Valid sessionId required' });

    try {
        const result = await dbQuery(req,
            `UPDATE sessions
             SET last_ping = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [sessionId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        res.json({ success: true });
    } catch (err) {
        logger.error('Error in /ping:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Log Form Fill
app.post('/api/log-form', async (req, res) => {
    const { userId, formTitle, questionsCount } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        // Ensure user exists first to prevent foreign key constraint violations
        await dbQuery(req,
            `INSERT INTO users (id, extension_version) 
             VALUES ($1, 'unknown') 
             ON CONFLICT (id) DO NOTHING`,
            [userId]
        );

        await dbQuery(req,
            `INSERT INTO form_logs (user_id, form_title, questions_count)
       VALUES ($1, $2, $3)`,
            [userId, formTitle || 'Unknown Form', questionsCount || 0]
        );
        res.json({ success: true, message: 'Form logged successfully' });
    } catch (err) {
        logger.error('Error in /log-form:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Get Global Stats
app.get('/api/stats', async (req, res) => {
    try {
        const [
            totalUsersResult,
            liveUsersResult,
            formsFilledResult,
            avgSessionResult,
            dauResult
        ] = await Promise.all([
            // Total Users
            dbQuery(req, `SELECT COUNT(*) as count FROM users;`),
            
            // Live Users (active within 60 seconds)
            dbQuery(req, `
                SELECT COUNT(DISTINCT user_id) as count
                FROM sessions
                WHERE last_ping > NOW() - INTERVAL '60 seconds';
            `),
            
            // Forms Filled
            dbQuery(req, `SELECT COUNT(*) as count FROM form_logs;`),
            
            // Average Session Time (in seconds)
            dbQuery(req, `
                SELECT AVG(EXTRACT(EPOCH FROM (last_ping - started_at))) as avg_session_seconds
                FROM sessions
                WHERE last_ping > started_at;
            `),
            
            // Daily Active Users (DAU)
            dbQuery(req, `
                SELECT COUNT(DISTINCT user_id) as count
                FROM sessions
                WHERE last_ping > NOW() - INTERVAL '24 hours';
            `)
        ]);

        res.json({
            totalUsers: parseInt(totalUsersResult.rows[0].count, 10),
            liveUsers: parseInt(liveUsersResult.rows[0].count, 10),
            formsFilled: parseInt(formsFilledResult.rows[0].count, 10),
            avgSessionTime: Math.round(avgSessionResult.rows[0].avg_session_seconds || 0),
            dailyActiveUsers: parseInt(dauResult.rows[0].count, 10)
        });
    } catch (err) {
        logger.error('Error in /stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin Endpoints ---
const adminAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};
app.use('/api/admin', adminAuth);

// A. Detailed Stats
app.get('/api/admin/detailed-stats', async (req, res) => {
    try {
        const deviceStats = await dbQuery(req, `SELECT device_type, COUNT(*) as count FROM sessions WHERE device_type IS NOT NULL GROUP BY device_type;`);
        const countryStats = await dbQuery(req, `SELECT country, COUNT(*) as count FROM sessions WHERE country IS NOT NULL AND country != 'Unknown' GROUP BY country;`);

        res.json({
            devices: deviceStats.rows,
            countries: countryStats.rows
        });
    } catch (err) {
        logger.error({ error: err.message }, 'Error in /admin/detailed-stats');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// B. User Growth
app.get('/api/admin/user-growth', async (req, res) => {
    try {
        const growth = await dbQuery(req, `
            SELECT DATE(created_at) as date, COUNT(*) as new_users
            FROM users
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC;
        `);
        res.json(growth.rows);
    } catch (err) {
        logger.error({ error: err.message }, 'Error in /admin/user-growth');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// C. Forms per Day
app.get('/api/admin/forms-per-day', async (req, res) => {
    try {
        const forms = await dbQuery(req, `
            SELECT DATE(created_at) as date, COUNT(*) as forms_filled
            FROM form_logs
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC;
        `);
        res.json(forms.rows);
    } catch (err) {
        logger.error({ error: err.message }, 'Error in /admin/forms-per-day');
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Root Landing Page & JSON-LD Structured Data
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FormBhar - AI Form Filler Platform</title>
  <meta name="description" content="FormBhar is an AI-powered form auto-filling extension and telemetry API platform supporting Google Forms and web forms.">
  <link rel="canonical" href="https://formbhar-backend-7ir1.onrender.com/">
  <meta property="og:title" content="FormBhar - AI Form Filler Platform">
  <meta property="og:description" content="AI Form Filler with Self-Improvement & Dual-Layer Memory Engine.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://formbhar-backend-7ir1.onrender.com/">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FormBhar",
    "applicationCategory": "BrowserExtension",
    "operatingSystem": "Chrome OS, Windows, macOS, Linux",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "AI Form Filler Chrome Extension with Self-Improvement Memory Engine and multi-LLM support.",
    "softwareVersion": "2.6.0"
  }
  </script>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .container { max-width: 600px; background: #151d2a; border: 1px solid #26334d; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    h1 { font-size: 28px; margin: 0 0 8px 0; color: #6366f1; font-weight: 800; }
    .tagline { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .card { background: #0f172a; border: 1px solid #26334d; border-radius: 10px; padding: 14px; }
    .card-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .card-val { font-size: 14px; font-weight: 700; color: #f8fafc; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 700; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399; }
    a { color: #818cf8; text-decoration: none; font-weight: 600; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h1>FormBhar Platform</h1>
      <span class="status-pill"><span class="dot"></span> API Operational</span>
    </div>
    <p class="tagline">Production AI Form Filler Service & Telemetry Engine (v2.6.0)</p>
    <div class="grid">
      <div class="card">
        <div class="card-title">Backend Host</div>
        <div class="card-val">Render Platform</div>
      </div>
      <div class="card">
        <div class="card-title">Memory Engine</div>
        <div class="card-val">Dual-Layer Adaptive</div>
      </div>
    </div>
    <p style="font-size: 13px; color: #94a3b8;">
      Resources: <a href="/health">/health</a> • <a href="/robots.txt">/robots.txt</a> • <a href="/sitemap.xml">/sitemap.xml</a> • <a href="/llms.txt">/llms.txt</a>
    </p>
  </div>
</body>
</html>`);
});

// Custom 404 Error Handler
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl, requestId: req.id });
    }
    res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Found | FormBhar</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: #151d2a; border: 1px solid #26334d; border-radius: 14px; padding: 40px; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    h1 { font-size: 48px; margin: 0 0 10px 0; color: #6366f1; }
    h2 { font-size: 20px; margin: 0 0 12px 0; }
    p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    a { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; }
    a:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <h2>Page Not Found</h2>
    <p>The requested route <code>${req.originalUrl}</code> does not exist on FormBhar.</p>
    <a href="/">Return Home</a>
  </div>
</body>
</html>`);
});



if (require.main === module) {
    // --- Scheduled Tasks ---
    // Run cleanup every 24 hours
    setInterval(() => {
        logger.info('Running daily database cleanup...');
        pool.query(`DELETE FROM sessions WHERE last_ping < NOW() - INTERVAL '30 days';`)
            .then(res => logger.info(`Deleted ${res.rowCount} old sessions.`))
            .catch(err => logger.error({ error: err.message }, 'Error cleaning up sessions'));

        pool.query(`DELETE FROM form_logs WHERE created_at < NOW() - INTERVAL '90 days'; `)
            .then(res => logger.info(`Deleted ${res.rowCount} old form logs.`))
            .catch(err => logger.error({ error: err.message }, 'Error cleaning up form logs'));
    }, 24 * 60 * 60 * 1000);
    app.listen(port, () => {
        logger.info(`Server is running on port ${port}`);
    });
}

module.exports = app;
