import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('../config.js', () => ({
  config: {
    paymob: {
      baseUrl: 'https://accept.paymob.com',
      apiKey: 'test-api-key',
      integrationCardId: '12345',
      integrationInstapayId: '67890',
      integrationApplePayId: '',
      iframeId: '999',
      webhookSecret: 'test-hmac-secret',
    },
    app: { currency: 'EGP' },
  },
}));

import { PaymobClient, toCents } from './paymob-client.js';

describe('toCents', () => {
  it('converts whole numbers', () => {
    expect(toCents(100)).toBe(10000);
  });
  it('converts decimal amounts with rounding', () => {
    expect(toCents(91.25)).toBe(9125);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(99.999)).toBe(10000);
  });
  it('handles zero', () => {
    expect(toCents(0)).toBe(0);
  });
  it('handles large amounts', () => {
    expect(toCents(10000)).toBe(1000000);
  });
});

describe('PaymobClient', () => {
  let client: PaymobClient;
  beforeEach(() => { client = new PaymobClient(); });

  describe('isConfigured', () => {
    it('returns true when API key is set', () => {
      expect(client.isConfigured()).toBe(true);
    });
  });

  describe('getIntegrationId', () => {
    it('returns card integration id', () => {
      expect(client.getIntegrationId('card')).toBe('12345');
    });
    it('returns instapay integration id', () => {
      expect(client.getIntegrationId('instapay')).toBe('67890');
    });
    it('returns empty string for unconfigured apple_pay', () => {
      expect(client.getIntegrationId('apple_pay')).toBe('');
    });
  });

  describe('getIframeUrl', () => {
    it('builds correct URL with payment key', () => {
      const url = client.getIframeUrl('pay-key-123');
      expect(url).toBe('https://accept.paymob.com/api/acceptance/iframes/999?payment_token=pay-key-123');
    });
    it('uses provided iframeId override', () => {
      const url = client.getIframeUrl('pay-key-123', '777');
      expect(url).toContain('/iframes/777?');
    });
  });

  describe('verifyWebhook', () => {
    it('returns false when hmac is empty', () => {
      expect(client.verifyWebhook('', { success: true })).toBe(false);
    });
    it('returns false for wrong hmac', () => {
      const txn = {
        amount_cents: 10000, created_at: '2024-01-01T00:00:00Z', currency: 'EGP',
        error_occured: false, has_parent_transaction: false, id: 123,
        integration_id: 1, is_3d_secure: false, is_auth: false, is_capture: false,
        is_refunded: false, is_standalone_payment: false, is_voided: false,
        'order.id': 456, owner: 789, pending: false,
        'source_data.pan': '****', 'source_data.sub_type': 'Mastercard',
        'source_data.type': 'card', success: true,
      };
      expect(client.verifyWebhook('wrong-hmac', txn)).toBe(false);
    });
    it('returns true for correct hmac', () => {
      const txn = {
        amount_cents: 10000, created_at: '2024-01-01T00:00:00Z', currency: 'EGP',
        error_occured: false, has_parent_transaction: false, id: 123,
        integration_id: 1, is_3d_secure: false, is_auth: false, is_capture: false,
        is_refunded: false, is_standalone_payment: false, is_voided: false,
        'order.id': 456, owner: 789, pending: false,
        'source_data.pan': '****', 'source_data.sub_type': 'Mastercard',
        'source_data.type': 'card', success: true,
      };
      const keys = [
        'amount_cents','created_at','currency','error_occured',
        'has_parent_transaction','id','integration_id','is_3d_secure',
        'is_auth','is_capture','is_refunded','is_standalone_payment',
        'is_voided','order.id','owner','pending',
        'source_data.pan','source_data.sub_type','source_data.type','success',
      ];
      const concatenated = keys.map((k) => {
        const parts = k.split('.');
        let val: unknown = txn;
        for (const p of parts) { val = (val as Record<string, unknown>)?.[p]; }
        if (val === true) return 'true';
        if (val === false) return 'false';
        if (val === null || val === undefined) return '';
        return String(val);
      }).join('');
      const correctHmac = crypto.createHmac('sha512','test-hmac-secret').update(concatenated).digest('hex');
      expect(client.verifyWebhook(correctHmac, txn)).toBe(true);
    });
  });
});
