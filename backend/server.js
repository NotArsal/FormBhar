require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: true
}));
app.use(express.json());

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
        last_ping TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
            console.log('Database initialized successfully.');
        } else {
            console.warn('DATABASE_URL not set. Skipping DB initialization.');
        }
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}
// initDb(); // Keep commented out for production. Run manually via schema.sql in Supabase.

// Routes

// 1. Initial User Registration / Update
app.post('/api/register-user', async (req, res) => {
    const { userId, extensionVersion } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

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
        console.error('Error in /register-user:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Start Session
app.post('/api/start-session', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const result = await pool.query(
            `INSERT INTO sessions (user_id)
             VALUES ($1)
             RETURNING id;`,
            [userId]
        );

        res.json({
            success: true,
            sessionId: result.rows[0].id
        });
    } catch (err) {
        console.error('Error starting session:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Ping Live Session
app.post('/api/ping', async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    try {
        await pool.query(
            `UPDATE sessions
             SET last_ping = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [sessionId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error in /ping:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Log Form Fill
app.post('/api/log-form', async (req, res) => {
    const { userId, formTitle, questionsCount } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        await pool.query(
            `INSERT INTO form_logs (user_id, form_title, questions_count)
       VALUES ($1, $2, $3)`,
            [userId, formTitle || 'Unknown Form', questionsCount || 0]
        );
        res.json({ success: true, message: 'Form logged successfully' });
    } catch (err) {
        console.error('Error in /log-form:', err);
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

        res.json({
            totalUsers,
            liveUsers,
            formsFilled
        });
    } catch (err) {
        console.error('Error in /stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Basic health check
app.get('/', (req, res) => {
    res.send('FormBhar Analytics API is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
