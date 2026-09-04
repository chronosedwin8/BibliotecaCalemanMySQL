# SSO con Microsoft Entra ID

Los usuarios entran con su cuenta institucional `@colegioaleman.edu.co`.
El inicio de sesión por contraseña **se mantiene** como alternativa.

## Registro en Azure

| Dato | Valor |
|---|---|
| Aplicación | Biblioteca Caleman |
| Application (client) ID | `36564d1e-5d8b-448d-a5e6-b4421b383b7c` |
| Directory (tenant) ID | `d065e67d-8e26-4632-a114-1caaf9422f02` |
| Tipo de cuenta | Solo esta organización |
| Redirect URI (Web) | `https://biblioteca.colegioaleman.edu.co/api/auth/microsoft/callback` |

Para probar en local hay que registrar **además**
`http://localhost:4001/api/auth/microsoft/callback`, también de tipo *Web*.

## Por qué el flujo va por el backend

Es un **cliente confidencial**: el `client_secret` vive sólo en el servidor y el
navegador nunca lo ve. Microsoft autentica, el backend valida el `id_token` y
emite el JWT propio de la aplicación, el mismo que ya usaba el login por
contraseña. El resto de la app no cambia.

```
navegador ──► GET /api/auth/microsoft         (genera state + nonce)
          ──► login.microsoftonline.com
          ◄── GET /api/auth/microsoft/callback?code&state
                 ├─ canjea el código por id_token (servidor ↔ Microsoft)
                 ├─ valida firma (JWKS), audience, issuer, nonce y tenant
                 ├─ exige dominio institucional
                 ├─ busca o crea el perfil
                 └─ redirige a /auth/callback?ticket=…
          ──► POST /api/auth/sso/exchange     (canjea el ticket por el JWT)
```

**El JWT no viaja en la URL.** El backend entrega un *ticket* de un solo uso y
60 segundos de vida; el frontend lo canjea por POST. Así el token no queda en el
historial del navegador ni en los logs del proxy.

## Reglas

- **Sólo dominios de `SSO_ALLOWED_DOMAINS`** (por defecto `colegioaleman.edu.co`).
  Cualquier otra cuenta se rechaza aunque Microsoft la autentique.
- **Alta automática:** si la cuenta no existe en la BD se crea con rol
  `student` y estado `activo`.
- **Los inactivos no entran.** Un egresado con cuenta viva en Microsoft pero
  perfil `inactivo` recibe un mensaje y no obtiene sesión. Es coherente con el
  login por contraseña, que ya los bloquea.
- **Las cuentas creadas por SSO no tienen contraseña.** Se guardan con
  `password_hash = ''`; `bcrypt.compare` contra un hash vacío siempre falla, así
  que sólo pueden entrar por Microsoft (verificado con pruebas).
- **El rol nunca se toca en el login.** Un admin que entra por SSO sigue siendo
  admin; el alta automática sólo aplica a cuentas nuevas.

## Configuración

```
ENTRA_TENANT_ID=d065e67d-8e26-4632-a114-1caaf9422f02
ENTRA_CLIENT_ID=36564d1e-5d8b-448d-a5e6-b4421b383b7c
ENTRA_CLIENT_SECRET=<secreto de Azure>
ENTRA_REDIRECT_URI=https://biblioteca.colegioaleman.edu.co/api/auth/microsoft/callback
SSO_ALLOWED_DOMAINS=colegioaleman.edu.co
FRONTEND_URL=https://biblioteca.colegioaleman.edu.co
```

En producción van como variables de entorno de la aplicación en Coolify.
Si falta cualquiera, el SSO se desactiva solo: `/api/auth/sso/status` devuelve
`{"microsoft": false}` y el frontend no muestra el botón. La app sigue
funcionando con contraseña.

> El secreto de Azure **caduca**. Cuando expire, el botón dejará de funcionar
> con un error de Microsoft: hay que generar uno nuevo y actualizar la variable.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/auth/sso/status` | ¿Está configurado el SSO? |
| `GET` | `/api/auth/microsoft` | Arranca el flujo |
| `GET` | `/api/auth/microsoft/callback` | Retorno de Microsoft |
| `POST` | `/api/auth/sso/exchange` | Canjea el ticket por el JWT |

## Limitación conocida

El `state`, el `nonce` y los tickets viven **en memoria del proceso**. Con una
sola instancia funciona; si algún día se escala a varias réplicas hay que
moverlos a la base de datos o a Redis, porque el callback podría caer en una
instancia distinta a la que inició el flujo.

## Archivos

- [`server/src/auth/entra.ts`](../server/src/auth/entra.ts) — cliente OIDC y validación.
- [`server/src/routes/auth.routes.ts`](../server/src/routes/auth.routes.ts) — endpoints.
- [`src/pages/auth/SsoCallback.tsx`](../src/pages/auth/SsoCallback.tsx) — aterrizaje y canje.
- [`src/pages/auth/Login.tsx`](../src/pages/auth/Login.tsx) — botón de Microsoft.
