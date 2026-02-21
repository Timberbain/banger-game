# Stage 1: Build client
FROM node:22-slim AS build-client
WORKDIR /build

# Copy shared code (needed by client build)
COPY shared/ shared/

# Copy client and install deps
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci

# Copy client source and build
COPY client/ client/
RUN cd client && npm run build

# Stage 2: Build server
FROM node:22-slim AS build-server
WORKDIR /build

# Copy shared code (needed by server build)
COPY shared/ shared/

# Copy server and install deps
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci

# Copy server source and build
COPY server/ server/
RUN cd server && npm run build

# Stage 3: Production runtime
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV MAPS_BASE_DIR=/app/public
ENV CLIENT_DIST_PATH=/app/public

# Copy server production dependencies
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && rm -rf /root/.npm

# Copy compiled server (includes dist/server/src/ and dist/shared/)
COPY --from=build-server /build/server/dist/ dist/

# Copy client build output to /app/public
COPY --from=build-client /build/client/dist/ public/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/server/src/index.js"]
