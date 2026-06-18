import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getFoodicsClient } from './foodics-client.js';
import { saveWaiterSession, getWaiterSession, deleteWaiterSession } from '../db/index.js';
import type { FoodicsUser, WaiterSession } from '../types/index.js';

/**
 * Auth service: handles waiter login by app_id/pin,
 * creates JWT session tokens, validates them.
 */

// In-memory waiter ID → Foodics user mapping (loaded on first login)
// The "app_id" the waiter types is their PIN or employee number
export async function loginWaiter(appId: string, pin: string): Promise<WaiterSession> {
  const client = getFoodicsClient();
  if (!client.hasToken()) {
    throw new Error('Backend not connected to Foodics. Set FOODICS_ACCESS_TOKEN or complete OAuth first.');
  }

  // Fetch all users and find by matching pin
  // In production, you'd cache this and/or use a direct lookup
  const users = await client.listUsers();
  const user = users.find(
    (u: FoodicsUser) => u.pin === pin && (u.number === appId || u.email === appId || u.id === appId),
  );

  if (!user) {
    throw new Error('Invalid waiter credentials');
  }

  // Create JWT token
  const token = jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: 'waiter' },
    config.backend.jwtSecret,
    { expiresIn: '12h' },
  );

  const now = Date.now();
  const session: WaiterSession = {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      is_owner: user.is_owner,
    },
    createdAt: now,
  };

  // Save to DB
  saveWaiterSession({
    token,
    user_id: user.id,
    user_name: user.name,
    user_email: user.email,
    is_owner: user.is_owner,
    created_at: now,
    expires_at: now + 12 * 60 * 60 * 1000,
  });

  return session;
}

export function validateSession(token: string): { sub: string; name: string; email: string; role: string } | null {
  try {
    // Check JWT
    const decoded = jwt.verify(token, config.backend.jwtSecret) as { sub: string; name: string; email: string; role: string };
    
    // Check DB session exists and not expired
    const dbSession = getWaiterSession(token);
    if (!dbSession) return null;
    if (Date.now() > dbSession.expires_at) {
      deleteWaiterSession(token);
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function logoutWaiter(token: string): void {
  deleteWaiterSession(token);
}