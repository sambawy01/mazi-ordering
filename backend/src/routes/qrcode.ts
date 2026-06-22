import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { getDB } from '../db/index.js';
import { validateSession } from '../services/auth-service.js';

export async function qrcodeRoutes(app: FastifyInstance): Promise<void> {
  // POST /qrcode/generate — generate QR for a table (waiter only)
  // Body: { table_id, reservation_name, branch_id? }
  app.post('/qrcode/generate', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    const { table_id, reservation_name, branch_id } = (request.body ?? {}) as {
      table_id?: string;
      reservation_name?: string;
      branch_id?: string;
    };

    if (!table_id) return reply.code(400).send({ error: 'table_id is required' });
    if (!reservation_name) return reply.code(400).send({ error: 'reservation_name is required' });

    const bid = branch_id || config.foodics.branchId;

    // QR payload — compact JSON
    const payload = JSON.stringify({
      t: table_id,
      r: reservation_name,
      b: bid,
    });

    // Generate QR as base64 PNG
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    // Also generate as SVG for printing
    const qrSvg = await QRCode.toString(payload, {
      type: 'svg',
      width: 300,
      margin: 2,
    });

    // Save to DB (no FK constraint — table may not be cached yet)
    const id = uuidv4();
    const db = getDB();
    db.prepare(`
      INSERT INTO qr_codes (id, table_id, reservation_name, branch_id, qr_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, table_id, reservation_name, bid, payload);

    return reply.send({
      id,
      table_id,
      reservation_name,
      branch_id: bid,
      qr_payload: payload,
      qr_png: qrDataUrl,    // data:image/png;base64,...
      qr_svg: qrSvg,
    });
  });

  // GET /qrcode/list — list all generated QR codes (waiter only)
  app.get('/qrcode/list', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    const db = getDB();
    const codes = db.prepare(`
      SELECT id, table_id, table_name, reservation_name, branch_id, created_at
      FROM qr_codes ORDER BY created_at DESC
    `).all();
    return reply.send({ codes });
  });

  // GET /qrcode/:id — get a specific QR code
  app.get('/qrcode/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const db = getDB();
    const code = db.prepare(`SELECT * FROM qr_codes WHERE id = ?`).get(id) as any;
    if (!code) return reply.code(404).send({ error: 'QR code not found' });

    const qrDataUrl = await QRCode.toDataURL(code.qr_data, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    return reply.send({
      ...code,
      qr_png: qrDataUrl,
    });
  });

  // POST /qrcode/decode — decode a scanned QR payload (client app calls this)
  app.post('/qrcode/decode', async (request, reply) => {
    const { payload } = (request.body ?? {}) as { payload?: string };
    if (!payload) return reply.code(400).send({ error: 'payload is required' });

    try {
      const decoded = JSON.parse(payload) as { t: string; r: string; b: string };
      if (!decoded.t || !decoded.b) {
        return reply.code(400).send({ error: 'Invalid QR payload' });
      }
      return reply.send({
        table_id: decoded.t,
        reservation_name: decoded.r,
        branch_id: decoded.b,
      });
    } catch {
      return reply.code(400).send({ error: 'Invalid QR payload format' });
    }
  });
}