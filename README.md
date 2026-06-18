# Foodics Ordering App

Mobile ordering app for Foodics POS — waiters and customers in one Flutter app.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Flutter Mobile │◄───►│  Node.js Backend │◄───►│  Foodics API v5  │
│ (Waiter+Client) │ HTTP│  (TypeScript)    │ HTTP│  (Cloud REST)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                        ┌──────┴──────┐
                        │  SQLite +   │
                        │  WebSocket  │
                        └─────────────┘
```

- **Mobile**: Flutter 3.x, one codebase for iOS + Android
- **Backend**: Node.js + TypeScript + Fastify, SQLite cache, WebSocket realtime
- **Foodics**: OAuth2.0, REST API v5 (sandbox + production)

## Project Layout

```
foodics-ordering/
├── backend/           # Node.js + TypeScript API server
│   ├── src/
│   │   ├── routes/    # REST endpoints
│   │   ├── services/  # Foodics client, cache, auth
│   │   ├── db/        # SQLite layer
│   │   ├── utils/     # QR gen, helpers
│   │   ├── types/     # TypeScript types
│   │   └── server.ts  # Entry point
│   ├── data/          # SQLite DB file (gitignored)
│   └── .env.example
├── mobile/           # Flutter app (created separately)
└── docs/             # Documentation
```

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env
# Fill in Foodics credentials
npm install
npm run dev
```

### Mobile

```bash
cd mobile
flutter pub get
flutter run
```

## Environment

| Variable | Description |
|----------|-------------|
| `FOODICS_BASE_URL` | `https://api-sandbox.foodics.com/v5` (sandbox) or `https://api.foodics.com/v5` (prod) |
| `FOODICS_CLIENT_ID` | OAuth client ID from Foodics |
| `FOODICS_CLIENT_SECRET` | OAuth client secret from Foodics |
| `FOODICS_REDIRECT_URI` | OAuth redirect URI |
| `FOODICS_BRANCH_ID` | Default branch ID for orders |
| `BACKEND_PORT` | Backend server port (default 3000) |
| `JWT_SECRET` | Secret for signing waiter session tokens |
| `DB_PATH` | SQLite file path (default `./data/foodics.db`) |

## Foodics API Reference

- Docs: https://apidocs.foodics.com
- Rate limit: 90 req/min per token per IP
- Auth: `Authorization: Bearer <access_token>`
- All times in UTC