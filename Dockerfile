# syntax=docker/dockerfile:1.4

# -----------------
# Stage 1: Build Frontend
# -----------------
FROM node:22-alpine AS build-frontend
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source
COPY . .

# Build Angular app
ENV FIREBASE_API_KEY=dummy
ENV FIREBASE_AUTH_DOMAIN=dummy
ENV FIREBASE_PROJECT_ID=dummy
ENV FIREBASE_STORAGE_BUCKET=dummy
ENV FIREBASE_MESSAGING_SENDER_ID=dummy
ENV FIREBASE_APP_ID=dummy

RUN npm run build

# -----------------
# Stage 2: Build Backend
# -----------------
FROM node:22-alpine AS build-backend
WORKDIR /app/server

# Copy server package files
COPY server/package.json ./
RUN npm install

# Copy server source
COPY server/ ./
RUN npm run build

# -----------------
# Stage 3: Production Release
# -----------------
FROM node:22-alpine AS production
WORKDIR /app

# Set node env
ENV NODE_ENV=production

# Copy backend dependencies (only prod)
COPY server/package.json ./server/
WORKDIR /app/server
RUN npm install --omit=dev

WORKDIR /app
# Copy built backend code
COPY --from=build-backend /app/server/dist ./server/dist

# Copy built frontend code
COPY --from=build-frontend /app/dist ./dist

EXPOSE 4000

# Start the express server
CMD ["node", "server/dist/index.js"]
