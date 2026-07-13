FROM node:20-alpine AS builder

WORKDIR /app

# Instalar deps del frontend
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copiar fuentes y construir el frontend
COPY . .
# VITE_API_URL vacío → usará /api (mismo servidor), sin CORS
ENV VITE_API_URL=/api
RUN npm run build

# Instalar deps del backend
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --legacy-peer-deps

# ── Imagen final ──────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app/server

# Copiar node_modules del backend
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/package*.json ./

# Copiar código fuente del servidor
COPY server/src ./src
COPY server/.env.example ./.env.example

# Copiar el build del frontend al lugar que lee el servidor (../dist)
COPY --from=builder /app/dist ../dist

EXPOSE 4000

CMD ["node", "node_modules/tsx/dist/cli.mjs", "src/index.ts"]
