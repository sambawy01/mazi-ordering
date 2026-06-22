import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../db/index.js', () => ({
  saveWaiterSession: vi.fn(),
  getWaiterSession: vi.fn(),
  deleteWaiterSession: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: { backend: { jwtSecret: 'test-jwt-secret' }, app: { currency: 'EGP' } },
}));

vi.mock('./foodics-client.js', () => ({
  getFoodicsClient: () => ({
    hasToken: () => true,
    listUsers: vi.fn().mockResolvedValue([
      { id: 'u1', pin: '1234', number: 'EMP001', email: 'waiter@mazi.app', name: 'Yannis', is_owner: false },
      { id: 'u2', pin: '5678', number: 'EMP002', email: 'owner@mazi.app', name: 'Maria', is_owner: true },
    ]),
  }),
}));

import { loginWaiter, validateSession, logoutWaiter } from './auth-service.js';
import { saveWaiterSession, getWaiterSession, deleteWaiterSession } from '../db/index.js';

describe('loginWaiter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs in with valid pin and app_id', async () => {
    const session = await loginWaiter('EMP001', '1234');
    expect(session.token).toBeDefined();
    expect(session.user.name).toBe('Yannis');
    expect(saveWaiterSession).toHaveBeenCalledOnce();
  });

  it('throws on invalid pin', async () => {
    await expect(loginWaiter('EMP001', 'wrong')).rejects.toThrow('Invalid waiter credentials');
  });

  it('throws on unknown app_id', async () => {
    await expect(loginWaiter('UNKNOWN', '1234')).rejects.toThrow('Invalid waiter credentials');
  });

  it('matches by email', async () => {
    const session = await loginWaiter('owner@mazi.app', '5678');
    expect(session.user.name).toBe('Maria');
    expect(session.user.is_owner).toBe(true);
  });

  it('matches by id', async () => {
    const session = await loginWaiter('u1', '1234');
    expect(session.user.id).toBe('u1');
  });
});

describe('validateSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns decoded token for valid session', () => {
    const token = jwt.sign({ sub: 'u1', name: 'Yannis', email: 'w@mazi.app', role: 'waiter' }, 'test-jwt-secret');
    vi.mocked(getWaiterSession).mockReturnValue({
      token, user_id: 'u1', user_name: 'Yannis', user_email: 'w@mazi.app',
      is_owner: 0, created_at: Date.now(), expires_at: Date.now() + 3600000,
    });
    const result = validateSession(token);
    expect(result?.sub).toBe('u1');
    expect(result?.role).toBe('waiter');
  });

  it('returns null for invalid JWT', () => {
    expect(validateSession('invalid')).toBeNull();
  });

  it('returns null when session not in DB', () => {
    const token = jwt.sign({ sub: 'u1' }, 'test-jwt-secret');
    vi.mocked(getWaiterSession).mockReturnValue(null);
    expect(validateSession(token)).toBeNull();
  });

  it('returns null and deletes expired session', () => {
    const token = jwt.sign({ sub: 'u1' }, 'test-jwt-secret');
    vi.mocked(getWaiterSession).mockReturnValue({
      token, user_id: 'u1', user_name: 'Y', user_email: 'w@m.a',
      is_owner: 0, created_at: Date.now() - 7200000, expires_at: Date.now() - 3600000,
    });
    expect(validateSession(token)).toBeNull();
    expect(deleteWaiterSession).toHaveBeenCalledWith(token);
  });
});

describe('logoutWaiter', () => {
  beforeEach(() => vi.clearAllMocks());
  it('deletes the session', () => {
    logoutWaiter('some-token');
    expect(deleteWaiterSession).toHaveBeenCalledWith('some-token');
  });
});
