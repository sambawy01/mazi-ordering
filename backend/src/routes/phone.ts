import type { FastifyInstance } from 'fastify';
import { getTwilioService } from '../services/twilio-service.js';
import { setVerifiedPhone, isPhoneVerifiedDB } from '../db/index.js';

/**
 * Phone verification routes using Twilio Verify API.
 * Flow:
 *   1. POST /phone/send-code    → sends SMS OTP to guest's phone
 *   2. POST /phone/verify-code  → checks the code, marks phone as verified
 *   3. GET /phone/verified/:phone → checks if a phone was verified recently
 *
 * Verified phones are stored in SQLite (verified_phones table) so they survive
 * server restarts and redeploys.
 */

export async function phoneRoutes(app: FastifyInstance): Promise<void> {

  // POST /phone/send-code — send SMS OTP to guest's phone
  // Body: { phone: "+3069****4567", channel?: "sms" | "call" | "whatsapp" }
  app.post('/phone/send-code', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { phone, channel } = (request.body ?? {}) as { phone?: string; channel?: 'sms' | 'call' | 'whatsapp' };

    if (!phone) {
      return reply.code(400).send({ error: 'phone is required' });
    }

    // Basic phone format validation (E.164: starts with +, 8-15 digits)
    const phoneClean = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\+\d{8,15}$/.test(phoneClean)) {
      return reply.code(400).send({ error: 'Invalid phone format. Use E.164 format: +3069****4567' });
    }

    const twilio = getTwilioService();
    if (!twilio.isConfigured()) {
      // Dev mode: skip actual SMS, return success
      return reply.send({
        success: true,
        dev_mode: true,
        message: 'Twilio not configured — OTP skipped in dev mode. Any code will work.',
      });
    }

    const result = await twilio.sendVerification(phoneClean, channel || 'sms');

    if (result.success) {
      return reply.send({ success: true, sid: result.sid });
    } else {
      return reply.code(400).send({ error: result.error });
    }
  });

  // POST /phone/verify-code — verify the SMS code
  // Body: { phone: "+3069****4567", code: "1234" }
  app.post('/phone/verify-code', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { phone, code } = (request.body ?? {}) as { phone?: string; code?: string };

    if (!phone || !code) {
      return reply.code(400).send({ error: 'phone and code are required' });
    }

    const phoneClean = phone.replace(/[\s\-\(\)]/g, '');

    const twilio = getTwilioService();
    if (!twilio.isConfigured()) {
      // Dev mode: accept any 4-6 digit code
      if (/^\d{4,6}$/.test(code)) {
        setVerifiedPhone(phoneClean);
        return reply.send({ success: true, verified: true, phone: phoneClean, dev_mode: true });
      } else {
        return reply.code(400).send({ error: 'Invalid code' });
      }
    }

    const result = await twilio.checkVerification(phoneClean, code);

    if (result.success) {
      // Mark phone as verified for 30 minutes
      setVerifiedPhone(phoneClean);
      return reply.send({ success: true, verified: true, phone: phoneClean });
    } else {
      return reply.code(400).send({ error: result.error || 'Verification failed', status: result.status });
    }
  });

  // GET /phone/verified/:phone — check if phone is verified
  app.get('/phone/verified/:phone', async (request, reply) => {
    const { phone } = request.params as { phone: string };
    const phoneClean = phone.replace(/[\s\-\(\)]/g, '');

    const verified = isPhoneVerifiedDB(phoneClean);
    return reply.send({ verified, phone: phoneClean });
  });
}

/**
 * Helper: check if a phone is verified (used by orders + payment routes)
 */
export function isPhoneVerified(phone: string): boolean {
  const phoneClean = phone.replace(/[\s\-\(\)]/g, '');
  return isPhoneVerifiedDB(phoneClean);
}