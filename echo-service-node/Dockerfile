# --- Builder: install deps and build ---
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps (expects package-lock.json; if you don't have one, use `npm install`)
COPY package*.json ./
RUN npm ci

# Build the app
COPY . .
RUN npm run build

# --- Runner: prod-only image ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install curl before switching to node user
RUN apk add --no-cache curl iproute2

# Install *production* deps only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bring in the built files
COPY --from=builder /app/dist ./dist

# Run as non-root
USER node

# Your app listens on 3000 by default
EXPOSE 3000
CMD ["node", "dist/server.js"]
