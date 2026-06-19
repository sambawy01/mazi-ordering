# MAZI — Greek Restaurant Ordering App on Foodics POS

## Architecture

- **Backend:** Node.js + TypeScript + Fastify + SQLite + WebSocket
  - Location: `backend/src/`
  - Routes: `backend/src/routes/` (auth, menu, tables, orders, qrcode, webhooks, phone, payment)
  - Services: `backend/src/services/` (foodics-client, paymob-client, cache-service, websocket-service)
  - Config: `backend/src/config.ts`
  - Deployed on Railway: mazi-ordering-production.up.railway.app
- **Frontend:** React Native (Expo SDK 51) — 16 screens
  - Location: `rn-app/src/screens/`
  - Theme: `rn-app/src/theme/index.ts` — COLORS, FONTS, SPACING
  - State: `rn-app/src/services/AppContext.tsx` (React Context + AsyncStorage)
  - API client: `rn-app/src/services/api.ts` (axios)
  - Deployed on Vercel (web export via webpack)
- **Foodics API v5:** POS system, OAuth2, REST API
  - Base: api-sandbox.foodics.com/v5 (sandbox) / api.foodics.com/v5 (prod)
  - Rate limit: 90 req/min — cache aggressively
  - Payment Methods: GET /payment-methods (returns id, name, code, type)
  - Orders: POST /orders and PUT /orders/{id} accept `payments[]` array:
    ```
    "payments": [{ "amount": 91.25, "tendered": 91.25, "payment_method_id": "8f89c571", "tips": 0, "meta": {} }]
    ```

## Payments

- **Gateway:** Paymob (Egypt) charges the customer for Card / InstaPay / Apple Pay.
  Cash skips the gateway. After a successful charge (or for cash), the payment is
  recorded in Foodics via PUT /orders/{id} with a `payments[]` array — Foodics
  never processes money, it only records it.
- **Backend routes** (`backend/src/routes/payment.ts`, prefix `/api`):
  - `GET /payment/methods` — Foodics payment methods (cached 5 min)
  - `GET /payment/bill/:orderId` — itemized bill (items, subtotal, taxes, charges, total, paid, balance)
  - `POST /payment/intent` — `{ orderId, amount, method: 'card'|'instapay'|'apple_pay' }` → Paymob iframe URL
  - `POST /payment/settle` — record a payment in Foodics (used for Cash + manual settle)
  - `POST /payment/webhook` — Paymob confirmation; HMAC-verified, auto-settles in Foodics
- **Paymob flow:** authenticate → create order → get payment key → load hosted iframe.
  All amounts sent to Paymob are in **cents** (integer smallest unit).
- **Frontend screens:** `BillScreen` (itemized bill + 4 pay buttons), `PaymentProcessingScreen`
  (Paymob iframe in a `react-native-webview`), `PaymentResultScreen` (success/failure, no receipt).
  Nav params: `Bill { orderId }`, `PaymentProcessing { orderId, iframeUrl, method }`,
  `PaymentResult { orderId, success, method }`.

### Required env vars (set in Railway dashboard — do NOT commit real values)

- `PAYMOB_API_KEY` — Paymob merchant API key
- `PAYMOB_INTEGRATION_ID_CARD` — integration id for card payments
- `PAYMOB_INTEGRATION_ID_INSTAPAY` — integration id for InstaPay
- `PAYMOB_INTEGRATION_ID_APPLE_PAY` — integration id for Apple Pay
- `PAYMOB_IFRAME_ID` — hosted iframe id for the card/instapay/apple-pay form
- `PAYMOB_WEBHOOK_HMAC_SECRET` — HMAC secret used to verify webhook authenticity
- (optional) `PAYMOB_BASE_URL` — defaults to `https://accept.paymob.com`

## Brand Colors

- Blue background: #8FCCF0 (Aegean blue)
- Gold accent: #F8B52C
- Surface: #FFFDF5
- Text: #1A1A2E

## Key Commands

- Backend dev: `cd backend && npm run dev`
- Build backend: `cd backend && npm run build`
- Run backend: `node dist/server.js`
- Expo web export: `cd rn-app && npx expo export:web` (outputs to web-build/)
- Install deps: `cd rn-app && npm install --legacy-peer-deps`

## Current State

- 29 backend endpoints live on Railway (all passing) + 5 payment endpoints
- 16 React Native screens built (incl. Bill, PaymentProcessing, PaymentResult)
- Web deployment live on Vercel (deploy-eight-mocha-57.vercel.app)
- Foodics + Twilio env vars still need to be set in Railway dashboard
- Bill locking to host phone implemented
- Phone verification via Twilio Verify implemented

## Coding Standards

- TypeScript strict mode
- ESM modules (import/export, .js extensions in backend imports)
- React Native Paper for UI components
- Use `(request.body ?? {}) as { ... }` on every POST/PUT route — null body crashes Fastify
- Cache Foodics GET responses (products, categories, tables, payment-methods)
- Never embed Foodics client_secret in the mobile app — always go through backend
- react-dom must EXACTLY match react version (both 18.2.0) or web build renders white page