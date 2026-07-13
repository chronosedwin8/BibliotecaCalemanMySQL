# 📚 Sistema de Gestión de Biblioteca - Guía Funcional

## 🛠️ Stack Tecnológico
- **Frontend:** Vite + React + TypeScript
- **Base de Datos:** Supabase (PostgreSQL + Auth + Storage)
- **Estilos:** TailwindCSS
- **Librerías:**
  - React Router DOM, React Hook Form, Zod
  - TanStack Query, Zustand
  - jsbarcode (códigos barras), html5-qrcode (escaneo)
  - Recharts (gráficos), jsPDF, xlsx
  - date-fns, react-hot-toast

---

## 📊 Base de Datos (Tablas Principales)

### 1. profiles
```sql
id, email, full_name, role (admin/teacher/student), 
codigo_identificacion, telefono, estado, avatar_url, 
created_at, updated_at
```

### 2. books
```sql
id, titulo, autor, isbn, editorial, año_publicacion, 
categoria_id, cantidad_total, cantidad_disponible, 
ubicacion_sala, codigo_barras, imagen_portada_url, 
estado, created_at
```

### 3. categories
```sql
id, nombre, descripcion, color_hex
```

### 4. locations
```sql
id, shelf_name, section, row, capacity, current_occupancy
```

### 5. loans
```sql
id, libro_id, usuario_id, fecha_prestamo, 
fecha_devolucion_estimada, fecha_devolucion_real, 
estado (active/returned/overdue), renovaciones, 
created_at
```

### 6. reservas
```sql
id, libro_id, usuario_id, fecha_reserva, 
fecha_expiracion, estado, created_at
```

### 7. multas
```sql
id, prestamo_id, usuario_id, monto, motivo, 
estado (pendiente/pagada/condonada), 
fecha_generacion, fecha_pago
```

### 8. notificaciones
```sql
id, usuario_id, tipo, mensaje, leida, created_at
```

### 9. estadisticas_diarias (analytics)
```sql
id, fecha, total_prestamos, total_devoluciones, 
total_nuevos_usuarios, libros_mas_prestados (jsonb)
```

### 10. metricas_libros
```sql
id, libro_id, total_prestamos, total_reservas, 
promedio_dias_prestado, popularidad_score
```

### 11. metricas_usuarios
```sql
id, usuario_id, total_prestamos_historico, 
prestamos_activos, libros_devueltos_a_tiempo, 
tasa_cumplimiento, multas_totales
```

### 12. configuracion_sistema
```sql
id, clave, valor, tipo_dato, descripcion
```

---

## 🎯 Funcionalidades del Sistema

### 🔐 1. AUTENTICACIÓN Y ROLES
- Login/Registro con email y contraseña
- 3 Roles: Estudiante, Profesor, Administrativo
- Protección de rutas por rol
- Perfil de usuario editable con foto
- Cambio de contraseña

### 📚 2. GESTIÓN DE LIBROS (Admin)
**CRUD Completo:**
- Crear libro: título, autor, ISBN, categoría, ubicación, stock
- Generación automática de código de barras único
- Upload de imagen de portada
- Editar y eliminar libros
- Búsqueda avanzada: título, autor, categoría, disponibilidad
- Filtros y ordenamiento
- Importación masiva (CSV/Excel)
- Exportación de inventario (Excel/PDF)

**Códigos de Barras:**
- Generación automática al crear libro
- Impresión de etiquetas (múltiples en PDF)
- Escaneo con cámara (html5-qrcode)

### 👥 3. GESTIÓN DE USUARIOS (Admin)
- CRUD de usuarios
- Asignar/cambiar roles
- Activar/Desactivar/Suspender usuarios
- Ver historial de préstamos por usuario
- Ver multas por usuario
- Importación masiva (CSV)

### 🔄 4. SISTEMA DE PRÉSTAMOS

**Registrar Préstamo:**
- Escanear código de barras del libro o buscar manual
- Buscar usuario por código/email/nombre
- Validaciones:
  - Stock disponible > 0
  - Usuario sin multas pendientes
  - No exceder límite de préstamos por rol
- Días de préstamo configurables por rol:
  - Estudiante: 7 días
  - Profesor: 14 días
  - Admin: 30 días
- Actualizar stock automáticamente
- Generar recibo (PDF)
- Enviar email de confirmación

**Registrar Devolución:**
- Escanear código de barras
- Verificar estado del libro
- Calcular multa si hay atraso
- Actualizar stock
- Notificar siguiente en cola de reservas

**Renovaciones:**
- Máximo 2 renovaciones por préstamo
- Validar que no haya reservas pendientes
- Extender fecha de devolución

**Vistas:**
- Préstamos activos (todos los usuarios)
- Préstamos vencidos
- Mis préstamos (vista usuario)
- Historial completo

### 📅 5. SISTEMA DE RESERVAS
- Reservar libros no disponibles
- Cola de espera (FIFO)
- Notificación cuando libro esté disponible
- Expiración automática (48 horas)
- Cancelar reserva
- Panel de reservas pendientes

### 🔍 6. BÚSQUEDA Y CATÁLOGO
**Buscador Global:**
- Búsqueda en tiempo real
- Autocompletado
- Resultados con portada, disponibilidad, ubicación

**Catálogo:**
- Vista Grid con cards de libros
- Filtros: categoría, disponibilidad, autor
- Ordenar por: título, autor, popularidad
- Detalles completos del libro
- Botón reservar si no disponible

### 📊 7. ESTADÍSTICAS Y REPORTES

**Dashboard Admin - KPIs:**
- Total de libros en inventario
- Préstamos activos vs disponibles
- Préstamos del día/semana/mes
- Devoluciones pendientes
- Libros vencidos (contador)
- Multas pendientes (monto total)
- Nuevos usuarios del mes

**Gráficos:**
- Evolución de préstamos (líneas)
- Préstamos por categoría (barras)
- Distribución de inventario (donut)
- Top 10 libros más prestados
- Actividad por día de la semana
- Heat map de horarios de mayor actividad

**Reportes:**
- Top libros más prestados
- Top usuarios más activos
- Libros sin movimiento (candidatos a baja)
- Análisis de multas
- Tasa de devolución a tiempo
- Exportar a Excel/PDF

**Analytics Avanzado:**
- Métricas por libro (total préstamos, popularidad)
- Métricas por usuario (tasa cumplimiento, multas)
- Estadísticas diarias automatizadas
- Análisis de demanda vs stock

### 💰 8. GESTIÓN DE MULTAS
**Configuración:**
- Tarifa por día de atraso (configurable)
- Días de gracia
- Multa máxima por libro

**Funciones:**
- Cálculo automático al devolver tarde
- Generación automática para préstamos activos vencidos
- Registro de pagos
- Condonación de multas (requiere justificación)
- Bloqueo automático si multas > threshold
- Vista de multas pendientes (usuario)
- Reporte de multas (admin)

### 🔔 9. NOTIFICACIONES

**In-App:**
- Badge con contador de no leídas
- Dropdown con últimas notificaciones
- Marcar como leída

**Emails Automáticos:**
- Confirmación de préstamo
- Recordatorio 2 días antes de vencimiento
- Alerta de vencimiento
- Multa generada
- Reserva disponible

**Configuración:**
- Usuario puede activar/desactivar por tipo
- CRON jobs con Supabase Edge Functions

### 📍 10. UBICACIÓN FÍSICA
- Nomenclatura: "Estante A, Fila 3, Sección Literatura"
- Asignar ubicación a cada libro
- Búsqueda por ubicación
- Cambio de ubicación con historial
- Mapa visual interactivo de la biblioteca (opcional)

### ⚙️ 11. CONFIGURACIÓN

**Parámetros del Sistema:**
- Días de préstamo por rol
- Límite de libros por usuario
- Máximo de renovaciones
- Tarifa de multa por día
- Tiempo de expiración de reservas
- Días de anticipación para recordatorios

**Información:**
- Nombre de la biblioteca
- Logo
- Horarios de atención
- Información de contacto

---

## 🎨 Paneles por Rol

### 👨‍🎓 Panel Estudiante/Profesor
**Dashboard:**
- Préstamos activos (cards con countdown)
- Próximas devoluciones
- Multas pendientes
- Reservas activas

**Funcionalidades:**
- Buscar en catálogo
- Ver detalles de libros
- Reservar libros
- Renovar préstamos online
- Ver historial personal
- Editar perfil

### 🔧 Panel Administrativo
**Dashboard:**
- Métricas clave (KPIs)
- Gráficos de tendencias
- Préstamos próximos a vencer
- Top libros más prestados
- Acciones rápidas (botones)

**Módulos:**
- Gestión de libros (CRUD completo)
- Gestión de usuarios (CRUD completo)
- Préstamos y devoluciones
- Reservas pendientes
- Multas
- Reportes y estadísticas
- Configuración del sistema

---

## 🔒 Seguridad

**Supabase RLS (Row Level Security):**
- Usuarios solo ven sus propios datos
- Admins ven todos los datos
- Políticas por tabla según rol

**Triggers en Base de Datos:**
- Auto-crear perfil al registrarse
- Actualizar stock al prestar/devolver
- Calcular métricas automáticamente
- Generar multas automáticamente

**Edge Functions (CRON Jobs):**
- Enviar recordatorios diarios (8 AM)
- Generar multas para vencidos
- Expirar reservas antiguas (48h)
- Calcular estadísticas diarias

---

## 📱 Características UI/UX

**Responsive Design:**
- Mobile-first
- Sidebar colapsable en móvil
- Tablas adaptativas

**Componentes:**
- Loading states (skeleton screens)
- Error states con retry
- Toasts para notificaciones
- Modales para acciones críticas
- Badges de estado (disponible/prestado/vencido)

**Tema:**
- Modo claro/oscuro
- Colores por categoría
- Iconografía consistente

**Accesibilidad:**
- ARIA labels
- Navegación por teclado
- Contraste adecuado

---

## ✅ MVP - Funcionalidades Esenciales

### Fase 1 - Core (2-3 semanas)
1. Setup proyecto (Vite + React + TypeScript + Supabase)
2. Autenticación y roles
3. CRUD de libros con códigos de barras
4. Sistema de préstamos y devoluciones
5. Búsqueda básica
6. Dashboard básico

### Fase 2 - Funcional (2-3 semanas)
7. Gestión de multas
8. Sistema de reservas
9. Notificaciones (in-app + email)
10. Reportes básicos
11. Gestión de usuarios

### Fase 3 - Analytics (1-2 semanas)
12. Estadísticas avanzadas
13. Gráficos interactivos
14. Exportación de reportes
15. Métricas automatizadas

---

## 🗂️ Estructura de Carpetas

```
src/
├── components/
│   ├── common/          # Button, Input, Card, Modal
│   ├── layout/          # Header, Sidebar, Footer
│   ├── books/           # BookCard, BookForm, BookTable
│   ├── loans/           # LoanForm, LoanTable
│   └── stats/           # Charts, KPICard
├── pages/
│   ├── auth/            # Login, Register
│   ├── student/         # StudentDashboard, MisPrestamos
│   ├── teacher/         # TeacherDashboard
│   └── admin/           # AdminDashboard, LibrosPage, etc.
├── hooks/
│   ├── useAuth.ts
│   ├── useBooks.ts
│   ├── useLoans.ts
│   └── useStats.ts
├── services/
│   ├── supabase.ts
│   ├── auth.service.ts
│   ├── books.service.ts
│   └── loans.service.ts
├── types/
│   ├── database.types.ts
│   └── index.ts
├── utils/
│   ├── barcode.ts
│   ├── formatters.ts
│   └── constants.ts
└── App.tsx
```

---

## 🚀 Flujo de Trabajo

### 1. Usuario se registra
- Crea cuenta con email/contraseña
- Se asigna rol (estudiante por defecto)
- Trigger crea perfil automáticamente

### 2. Usuario busca libro
- Usa buscador global o navega catálogo
- Ve disponibilidad en tiempo real
- Si no disponible, puede reservar

### 3. Admin registra préstamo
- Escanea código de barras del libro
- Busca usuario
- Valida disponibilidad y restricciones
- Confirma préstamo
- Stock se actualiza automáticamente
- Usuario recibe email de confirmación

### 4. Sistema envía recordatorios
- Edge Function corre diariamente
- Busca préstamos con vencimiento en 2 días
- Envía emails automáticos

### 5. Usuario devuelve libro
- Admin escanea código
- Sistema calcula si hay multa
- Actualiza stock
- Notifica al siguiente en cola de reservas

### 6. Sistema genera estadísticas
- Edge Function corre cada noche
- Calcula métricas del día
- Actualiza tablas de analytics
- Admin ve reportes actualizados

---

## 🎯 Configuración Inicial Recomendada

**Supabase:**
1. Crear proyecto
2. Ejecutar SQL para crear todas las tablas
3. Configurar RLS en cada tabla
4. Crear triggers y funciones
5. Configurar Auth (email/password)
6. Configurar Storage (para portadas de libros)

**Valores Iniciales de Configuración:** ' debe haber un panel para configurar esto en el admin'
- `dias_prestamo_estudiante: 7`
- `dias_prestamo_profesor: 14`
- `dias_prestamo_admin: 30`
- `limite_libros_por_usuario: 3`
- `max_renovaciones: 2`
- `tarifa_multa_dia: 500` (pesos colombianos)
- `dias_gracia_multa: 0`
- `expiracion_reserva_horas: 48`

---

## 📝 Checklist de Implementación

**Básico (MVP):**
- [ ] Setup Vite + React + TypeScript
- [ ] Configurar Tailwind
- [ ] Crear proyecto Supabase
- [ ] Crear todas las tablas
- [ ] Configurar RLS y triggers
- [ ] Login/Registro
- [ ] CRUD libros
- [ ] Generación de códigos de barras
- [ ] Sistema de préstamos
- [ ] Sistema de devoluciones
- [ ] Búsqueda de libros
- [ ] Dashboard básico

**Avanzado:**
- [ ] Sistema de reservas
- [ ] Multas automáticas
- [ ] Notificaciones por email
- [ ] Escaneo de códigos con cámara
- [ ] Reportes y gráficos
- [ ] Exportación Excel/PDF
- [ ] Métricas automatizadas
- [ ] Importación masiva
- [ ] Tema claro/oscuro

---

## 💡 Tips de Implementación

1. **Empezar con tablas simples:** profiles, books, loans
2. **Implementar autenticación primero:** base para todo el sistema
3. **Hacer CRUD de libros antes de préstamos:** necesitas libros para prestar
4. **Usar React Query para cache:** evita llamadas innecesarias a Supabase
5. **Implementar búsqueda full-text en PostgreSQL:** mejor performance
6. **Usar Edge Functions para tareas programadas:** recordatorios, multas
7. **Mantener código de barras único:** validar en base de datos
8. **Testear flujo completo:** préstamo → recordatorio → devolución → multa

---

**Este es el sistema funcional completo. Cada funcionalidad está lista para implementarse paso a paso. 📚✨**
