import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

import authRoutes      from './routes/auth.routes.js';
import booksRoutes     from './routes/books.routes.js';
import usersRoutes     from './routes/users.routes.js';
import loansRoutes     from './routes/loans.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import locationsRoutes from './routes/locations.routes.js';
import multasRoutes    from './routes/multas.routes.js';
import configRoutes    from './routes/config.routes.js';
import researchRoutes  from './routes/research.routes.js';
import catalogRoutes   from './routes/catalog.routes.js';
import reservasRoutes, { expireOldReservas } from './routes/reservas.routes.js';

const app  = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',       authRoutes);
app.use('/api/books',      booksRoutes);
app.use('/api/users',      usersRoutes);
app.use('/api/loans',      loansRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/locations',  locationsRoutes);
app.use('/api/multas',     multasRoutes);
app.use('/api/config',     configRoutes);
app.use('/api/research',   researchRoutes);
app.use('/api/catalog',    catalogRoutes);
app.use('/api/reservas',   reservasRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Servir el frontend React en producción (build en ../dist)
const distPath = join(__dirname, '../../dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // Todas las rutas no-API devuelven el index.html (SPA)
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`✅ Biblioteca API corriendo en http://localhost:${PORT}`);

  // Job: expirar reservas vencidas cada 15 minutos
  const INTERVAL_MS = 15 * 60 * 1000;
  setInterval(async () => {
    try {
      const n = await expireOldReservas();
      if (n > 0) console.log(`⏰ ${n} reserva(s) expirada(s) automáticamente`);
    } catch (e) {
      console.error('Error en job de expiración de reservas:', e);
    }
  }, INTERVAL_MS);
});
