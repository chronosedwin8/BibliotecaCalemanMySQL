# ─────────────────────────────────────────────────────────────────────────────
# Imagen de EJECUCIÓN. No compila nada.
#
# El frontend (dist/) y el backend (server/dist/) llegan ya construidos por
# GitHub Actions. El servidor sólo instala dependencias de producción y arranca.
# Compilar en el servidor agota la memoria de la instancia.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/server

# Dependencias de producción del backend
COPY server/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Backend ya compilado a JavaScript
COPY server/dist ./dist

# Frontend ya construido. El servidor lo sirve desde ../../dist  (= /app/dist)
COPY dist /app/dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
