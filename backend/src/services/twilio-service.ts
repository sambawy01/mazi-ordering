import axios from 'axios';
import { config } from '../config.js';

/**
 * Twilio Verify API service.
 * Handles phone verification via SMS OTP.
 * Twilio generates, sends, and validates the code — we don't store it.
 */

const TWILIO_BASE = 'https://verify.twilio.com/v2/Services';

export class TwilioVerifyService {
  private accountSid: string;
  private authToken: string;
  private verifyServiceSid: string;
  private authHeader: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || '';
    // Twilio uses Basic Auth with Account SID : Auth Token
    this.authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
  }

  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.verifyServiceSid);
  }

  /**
   * Send a verification code to a phone number via SMS.
   * Twilio generates the code and sends it — we never see it.
   * @param phoneNumber E.164 format, e.g. +306941234567
   * @param channel 'sms' | 'call' | 'whatsapp'
   */
  async sendVerification(phoneNumber: string, channel: 'sms' | 'call' | 'whatsapp' = 'sms'): Promise<{ success: boolean; sid?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID.' };
    }

    try {
      const res = await axios.post(
        `${TWILIO_BASE}/${this.verifyServiceSid}/Verifications`,
        new URLSearchParams({
          'To': phoneNumber,
          'Channel': channel,
        }),
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        },
      );
      return { success: true, sid: res.data.sid };
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data as any)?.message || err.message : 'Unknown error';
      console.error('[Twilio] Send verification failed:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Verify the code the user entered.
   * Twilio checks if the code matches what they sent.
   * @param phoneNumber E.164 format
   * @param code The 4-6 digit code the user entered
   */
  async checkVerification(phoneNumber: string, code: string): Promise<{ success: boolean; status: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, status: 'error', error: 'Twilio not configured' };
    }

    try {
      const res = await axios.post(
        `${TWILIO_BASE}/${this.verifyServiceSid}/VerificationCheck`,
        new URLSearchParams({
          'To': phoneNumber,
          'Code': code,
        }),
        {
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        },
      );

      const status = res.data.status; // 'approved' | 'pending' | 'canceled'
      return {
        success: status === 'approved',
        status,
      };
    } catch (err) {
      const msg = axios.isAxiosError(err) ? (err.response?.data as any)?.message || err.message : 'Unknown error';
      console.error('[Twilio] Verification check failed:', msg);
      return { success: false, status: 'error', error: msg };
    }
  }
}

// Singleton
let twilioInstance: TwilioVerifyService | null = null;

export function getTwilioService(): TwilioVerifyService {
  if (!twilioInstance) {
    twilioInstance = new TwilioVerifyService();
  }
  return twilioInstance;
}