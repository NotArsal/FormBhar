const request = require('supertest');
const crypto = require('crypto');

// Mock PG Pool to prevent actual database connections
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockResolvedValue({ 
      rowCount: 1, 
      rows: [
        { count: '10', id: 'mocked-uuid' },
        { avg_session_seconds: 42 }
      ] 
    }),
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
