# MAZI Ordering

Mobile ordering app for the MAZI Greek restaurant, built on the Foodics POS system. Customers scan a QR code to browse the menu, build a cart, and pay via Paymob (Card / InstaPay / Apple Pay). Waiters manage tables and orders from the same app.

## Architecture

```
┌──────────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│  React Native (Expo) │◄─────►│  Node.js Backend     │◄─────►│  Foodics API v5 │
│  (Waiter + Customer) │  HTTP │  TypeScript + Fastify│  HTTP │  (Cloud REST)   │
└──────────────────────┘   WS  └──────────────────────┘       └─────────────────┘
                                    │         │
                              ┌─────┴───┐ ┌───┴──────┐
                              │ SQLite  │ │ WebSocket│
                              │ (cache) │ │ (realtime)│
                              └─────────┘ └──────────┘
                                    │
                              ┌─────┴───────────────┐
                              │ Paymob (payments)   │
                              │ Twilio (SMS OTP)    │
                              └─────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile app** | React Native (Expo SDK 51), React Navigation, React Native Paper |
| **Backend** | Node.js + TypeScript + Fastify + SQLite (better-sqlite3) + WebSocket |
| **POS** | Foodics API v5 (menu, tables, orders, payments) |
| **Payments** | Paymob (Card / InstaPay / Apple Pay) |
| **Phone verification** | Twilio Verify (SMS OTP) |
| **Deployment** | Railway (backend), Vercel (web build) |

## Project Layout

```
mazi-ordering/
├── backend/               # Node.js + TypeScript API server
│   ├── src/
│   │   ├── routes/        # REST endpoints (auth, menu, tables, orders, payment)
│   │   ├── services/      # Foodics, Paymob, Twilio, cache, auth, WebSocket
│   │   ├── db/            # SQLite init + cache operations
│   │   ├── types/         # TypeScript type definitions
│   │   ├── config.ts      # Environment configuration
│   │   └── server.ts      # Fastify entry point
│   ├── data/              # SQLite DB file (gitignored)
│   ├── .env.example
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   └── package.json
├── rn-app/                # React Native (Expo) mobile app
│   ├── src/
│   │   ├── screens/       # Screen components
│   │   ├── services/      # AppContext (state), api.ts (HTTP client)
│   │   ├── theme/         # Colors, fonts, spacing
│   │   └── types/         # TS types
│   ├── App.tsx            # Root component + navigation
│   ├── vercel.json        # Vercel web deployment config
│   └── package.json
├── assets/                # Brand images
├── demo.html              # Interactive HTML demo
├── Dockerfile             # Backend container config (Railway)
├── railway.toml           # Railway deployment config
├── .github/workflows/     # CI (GitHub Actions)
└── CLAUDE.md              # AI-oriented project guide
```

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
# Fill in Foodics, Twilio, and Paymob credentials
npm install
npm run dev    # starts on port 3000
```

### Mobile App

```bash
cd rn-app
npm install --legacy-peer-deps
npx expo start   # scan QR code with Expo Go app
```

### Web Build (Vercel)

```bash
cd rn-app
npx expo export:web
# Deploy the web-build/ directory to Vercel
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FOODICS_BASE_URL` | Sandbox or production Foodics API URL |
| `FOODICS_CLIENT_ID` | OAuth client ID from Foodics |
| `FOODICS_CLIENT_SECRET` | OAuth client secret from Foodics |
| `FOODICS_REDIRECT_URI` | OAuth redirect URI |
| `FOODICS_BRANCH_ID` | Default branch ID for orders |
| `FOODICS_ACCESS_TOKEN` | Direct access token (optional, bypasses OAuth) |
| `BACKEND_PORT` | Backend server port (default 3000) |
| `JWT_SECRET` | Secret for signing waiter session tokens (required in production) |
| `DB_PATH` | SQLite file path (default ./data/foodics.db) |
| `NODE_ENV` | development or production |
| `CORS_ORIGINS` | Comma-separated allowed origins (empty = allow all in dev) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify service SID |
| `PAYMOB_API_KEY` | Paymob API key |
| `PAYMOB_INTEGRATION_ID_CARD` | Paymob integration ID for card payments |
| `PAYMOB_INTEGRATION_ID_INSTAPAY` | Paymob integration ID for InstaPay |
| `PAYMOB_INTEGRATION_ID_APPLE_PAY` | Paymob integration ID for Apple Pay |
| `PAYMOB_IFRAME_ID` | Paymob iframe ID for hosted payment form |
| `PAYMOB_WEBHOOK_HMAC_SECRET` | Paymob HMAC secret for webhook verification |

## Testing

```bash
cd backend
npm test           # run all tests
npm run test:watch # watch mode
```

## CI

GitHub Actions runs on every push to main:
- TypeScript type-check
- Production build
- Test suite

## Brand

- **Colors**: Aegean blue + Gold
- **Theme**: Greek Mediterranean

## External API References

- [Foodics API Docs](https://apidocs.foodics.com) - Rate limit: 90 req/min per token per IP
- [Paymob Accept API](https://docs.paymob.com/)
- [Twilio Verify](https://www.twilio.com/docs/verify)
