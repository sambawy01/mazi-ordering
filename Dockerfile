FROM node:20-slim

WORKDIR /app

# Copy package files
COPY backend/package.json backend/package-lock.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source
COPY backend/ ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)})"

# Start
CMD ["node", "dist/server.js"]