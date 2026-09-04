# Sincronización de estudiantes desde Phidias

Los estudiantes de BiblioCalem se actualizan desde la API académica del colegio.
Phidias es la fuente de verdad; la biblioteca no edita estudiantes a mano.

## Origen de los datos

`GET /1/course/consolidate` — Estudiantes Matriculados.

La respuesta viene anidada en tres niveles:

```
nivel[]              name: KINDERGARTEN | PRIMARIA | SECUNDARIA
 └─ courses[]        name: KINDERKRIPPE, KLASSE 1, KLASSE 2…
     └─ sections[]   name: KKP1, K1A, K3C…
         └─ students[]
```

## Mapeo a `profiles`

| Campo en BD | Origen en Phidias | Ejemplo |
|---|---|---|
| `codigo_identificacion` | `student.code` | `3581` |
| `email` | `student.email` | `3581@colegioaleman.edu.co` |
| `full_name` | `firstname` + `lastname1` + `lastname2` | `GLORIA INÉS PÉREZ YEPES` |
| `level` | nombre del **nivel** | `PRIMARIA` |
| `course` | nombre del **course** | `KLASSE 3` |
| `section` | nombre de la **section** | `K3C` |
| `estado` | derivado de `enrollment.status` | `activo` |

> El código `K3C` va en **`section`**, no en `course`. Es la convención que ya
> traía la base de datos y coincide 1:1 con el anidamiento de Phidias.

Si `lastname1`/`lastname2` vienen vacíos se cae al campo `lastname` completo.

## Reglas

- **Sólo se importan matrículas con `enrollment.status = "activo"`.** Los estados
  `inscrito`, `pendiente`, `Admitido` y `retirado` se ignoran.
- **Emparejamiento:** primero por `codigo_identificacion` (estable), y si no, por email.
- **Nunca se borra a nadie.** Un estudiante que ya no aparece matriculado pasa a
  `estado = 'inactivo'`: no puede iniciar sesión, pero conserva préstamos, multas
  e historial. Es reversible desde la misma pantalla de Usuarios.
- **Nunca se toca `password_hash`** de alguien que ya existe. Si un alumno cambió
  su contraseña, se respeta.
- **Nunca se toca a quien no tenga rol `student`.** Protege las cuentas admin.
- **Nuevos estudiantes** se crean con la contraseña por defecto `Colegio123`,
  la misma convención de la importación por Excel.
- **Sin email no se puede crear el perfil** (`email` es UNIQUE y NOT NULL). Esos
  registros se reportan como omitidos.

## Cómo se ejecuta

Pantalla **Usuarios → botón "Sincronizar Phidias"** (sólo admin).

El modal primero hace una **simulación** que no escribe nada y muestra cuántos
se crearían, actualizarían y desactivarían. La escritura sólo ocurre al pulsar
*Aplicar sincronización*.

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/users/phidias/status` | ¿Hay token configurado? |
| `POST` | `/api/users/phidias/sync` | Body `{ dryRun?, desactivarAusentes?, year? }` |

Ambos requieren rol `admin`. `dryRun: true` no escribe nada.

## Configuración

En `server/.env` (nunca en el frontend — el token es un secreto y en un
`VITE_*` acabaría dentro del bundle que descarga cualquier visitante):

```
PHIDIAS_BASE_URL=https://ds-barranquilla.phidias.co/rest
PHIDIAS_TOKEN=<JWT>
PHIDIAS_TIMEOUT_MS=60000
```

Al correr en Node no hay problema de CORS, así que no se usan proxies.
El cliente reintenta 2 veces ante fallo de red, pero **no** ante 401/403:
si el token es inválido, reintentar no ayuda.

## Archivos

- [`server/src/services/phidias.ts`](../server/src/services/phidias.ts) — cliente HTTP.
- [`server/src/services/studentSync.ts`](../server/src/services/studentSync.ts) — lógica de sincronización.
- [`server/src/routes/users.routes.ts`](../server/src/routes/users.routes.ts) — endpoints.
- [`src/pages/admin/UsersPage.tsx`](../src/pages/admin/UsersPage.tsx) — botón y modal.
