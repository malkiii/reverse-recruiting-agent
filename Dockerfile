# Serves both Modal (modal_app.py) and Docker Compose (compose.yaml).
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Named paths only, so no local .env file can end up in the image.
COPY tsconfig.json next.config.ts ./
COPY src ./src
