const request = require('supertest');
const crypto = require('crypto');

// Mock PG Pool to prevent actual database connections
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockImplementation((queryText) => {
      const q = String(queryText || '');
      if (q.includes('AVG(')) {
        return Promise.resolve({ rowCount: 1, rows: [{ avg_session_seconds: 42 }] });
      }
      if (q.includes('INSERT INTO sessions')) {
        return Promise.resolve({ rowCount: 1, rows: [{ id: 'mocked-session-uuid' }] });
      }
      return Promise.resolve({ rowCount: 1, rows: [{ count: '10', id: 'mocked-uuid' }] });
    })
  };
  return { Pool: jest.fn(() => mPool) };
});

const app = require('../server');
const { Pool } = require('pg');

describe('Server API Endpoints', () => {
  let poolInstance;

  beforeEach(() => {
    poolInstance = new Pool();
    poolInstance.query.mockClear();
  });

  it('should return health check', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('FormBhar Analytics API is running');
  });

  it('should return /health JSON status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('version', '2.5.0');
  });

  it('should register user', async () => {
    const userId = crypto.randomUUID();
    const res = await request(app)
      .post('/api/register-user')
      .send({ userId, extensionVersion: '2.4.5' });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(poolInstance.query).toHaveBeenCalledTimes(1);
  });

  it('should get global stats', async () => {
    const res = await request(app).get('/api/stats');
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('totalUsers', 10);
    expect(poolInstance.query).toHaveBeenCalled();
  });
});
