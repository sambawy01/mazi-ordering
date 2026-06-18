FROM node:20-slim

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY backend/package.json backend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port (Railway sets PORT env var)
EXPOSE ${PORT:-3000}

# Start
CMD ["node", "dist/server.js"]