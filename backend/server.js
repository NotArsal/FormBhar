require('dotenv').config();
const pino = require('pino');
const logger = pino();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const geoip = require('geoip-lite');
const useragent = require('express-useragent');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 5000;

// Config - move hardcoded URLs to env
const API_BASE_URL = process.env.API_BASE_URL || 'https://formbhar-backend-production.up.railway.app';
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 100;

// Input validation helpers
const isValidUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const sanitizeString = (str, maxLength = 500) => {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLength).replace(/[<>]/g, '');
};

const sanitizeNumber = (num, defaultVal = 0, maxVal = 10000) => {
  const parsed = parseInt(num, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.min(Math.max(parsed, 0), maxVal);
};

// Rate limiter
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({
    origin: true
}));
app.use(express.json());
app.use(useragent.express());
app.use('/api/', generalLimiter);



// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false
});

// Create tables if they don't exist
async function initDb() {
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        extension_version TEXT
      );
  
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_type TEXT,
    ip_address TEXT,
    country TEXT
      );
  
      CREATE TABLE IF NOT EXISTS form_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        form_title TEXT,
        questions_count INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
  
      CREATE INDEX IF NOT EXISTS idx_sessions_last_ping ON sessions(last_ping);
    `;

    try {
        if (process.env.DATABASE_URL) {
            await pool.query(createTablesQuery);
            logger.info('Database initialized successfully.');
        } else {
            console.warn('DATABASE_URL not set. Skipping DB initialization.');
        }
    } catch (err) {
        logger.error('Error initializing database:', err);
    }
}
// initDb(); // Keep commented out for production. Run manually via schema.sql in Supabase.

// Routes

// 1. Initial User Registration / Update
app.post('/api/register-user', async (req, res) => {
    const { userId, extensionVersion } = req.body;
    if (!userId || !isValidUUID(userId)) return res.status(400).json({ error: 'Valid userId required' });

    try {
        await pool.query(
            `INSERT INTO users (id, extension_version, last_active)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (id) 
       DO UPDATE SET last_active = CURRENT_TIMESTAMP, extension_version = $2;`,
            [userId, extensionVersion || 'unknown']
        );
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
        await pool.query(
            `INSERT INTO users (id, extension_version) 
             VALUES ($1, 'unknown') 
             ON CONFLICT (id) DO NOTHING`,
            [userId]
        );

        // Extract IP, Geo, and Device Info
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        let cleanIp = ipAddress;
        if (cleanIp && cleanIp.includes(',')) cleanIp = cleanIp.split(',')[0].trim();
        // Handle local IPv6 representations for testing
        if (cleanIp === '::1' || cleanIp === '127.0.0.1') cleanIp = '127.0.0.1';

        const geo = geoip.lookup(cleanIp);
        const country = geo ? geo.country : 'Unknown';

        const deviceType = req.useragent.isMobile ? 'Mobile' : (req.useragent.isTablet ? 'Tablet' : 'Desktop');
        const browser = req.useragent.browser;
        const deviceString = `${deviceType} - ${browser}`;

        const result = await pool.query(
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
        await pool.query(
            `UPDATE sessions
             SET last_ping = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [sessionId]
        );

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
        await pool.query(
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
        // Total Users
        const totalUsersResult = await pool.query(`SELECT COUNT(*) as count FROM users;`);
        const totalUsers = parseInt(totalUsersResult.rows[0].count, 10);

        // Cleanup old sessions (optional professional touch)
        // Keep it out of awaiting in critical stats path if it's too slow, but here is fine for now
        pool.query(`DELETE FROM sessions WHERE last_ping < NOW() - INTERVAL '1 day';`).catch(err => console.error('Cleanup error:', err));

        // Live Users (active within 60 seconds)
        const liveUsersResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE last_ping > NOW() - INTERVAL '60 seconds';
    `);
        const liveUsers = parseInt(liveUsersResult.rows[0].count, 10);

        // Forms Filled
        const formsFilledResult = await pool.query(`SELECT COUNT(*) as count FROM form_logs;`);
        const formsFilled = parseInt(formsFilledResult.rows[0].count, 10);

        // Average Session Time (in seconds)
        // Calculated by looking at the average difference between last_ping and started_at for sessions where they differ.
        const avgSessionResult = await pool.query(`
            SELECT AVG(EXTRACT(EPOCH FROM (last_ping - started_at))) as avg_session_seconds
            FROM sessions
            WHERE last_ping > started_at;
        `);
        const avgSessionTime = Math.round(avgSessionResult.rows[0].avg_session_seconds || 0);

        // Daily Active Users (DAU)
        const dauResult = await pool.query(`
            SELECT COUNT(DISTINCT user_id) as count
            FROM sessions
            WHERE last_ping > NOW() - INTERVAL '24 hours';
        `);
        const dailyActiveUsers = parseInt(dauResult.rows[0].count, 10);

        res.json({
            totalUsers,
            liveUsers,
            formsFilled,
            avgSessionTime,
            dailyActiveUsers
        });
    } catch (err) {
        logger.error('Error in /stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Admin Endpoints ---

// A. Detailed Stats
app.get('/api/admin/detailed-stats', async (req, res) => {
    try {
        const deviceStats = await pool.query(`SELECT device_type, COUNT(*) as count FROM sessions WHERE device_type IS NOT NULL GROUP BY device_type;`);
        const countryStats = await pool.query(`SELECT country, COUNT(*) as count FROM sessions WHERE country IS NOT NULL AND country != 'Unknown' GROUP BY country;`);

        res.json({
            devices: deviceStats.rows,
            countries: countryStats.rows
        });
    } catch (err) {
        console.error('Error in /admin/detailed-stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// B. User Growth
app.get('/api/admin/user-growth', async (req, res) => {
    try {
        const growth = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as new_users
            FROM users
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC;
        `);
        res.json(growth.rows);
    } catch (err) {
        console.error('Error in /admin/user-growth:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// C. Forms per Day
app.get('/api/admin/forms-per-day', async (req, res) => {
    try {
        const forms = await pool.query(`
            SELECT DATE(created_at) as date, COUNT(*) as forms_filled
            FROM form_logs
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC;
        `);
        res.json(forms.rows);
    } catch (err) {
        console.error('Error in /admin/forms-per-day:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Scheduled Tasks ---
cron.schedule('0 2 * * *', () => {
    // Run at 2:00 AM every day
    logger.info('Running daily database cleanup...');
    pool.query(`DELETE FROM sessions WHERE last_ping < NOW() - INTERVAL '30 days';`)
        .then(res => logger.info(`Deleted ${res.rowCount} old sessions.`))
        .catch(err => console.error('Error cleaning up sessions:', err));

    pool.query(`DELETE FROM form_logs WHERE created_at < NOW() - INTERVAL '90 days'; `)
        .then(res => logger.info(`Deleted ${res.rowCount} old form logs.`))
        .catch(err => console.error('Error cleaning up form logs:', err));
});

// Basic health check
app.get('/', (req, res) => {
    res.send('FormBhar Analytics API is running');
});

app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
});
