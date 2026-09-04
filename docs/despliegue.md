# Despliegue

**Producción:** https://biblioteca.colegioaleman.edu.co

## Principio

La compilación ocurre **siempre en GitHub Actions**, nunca en el servidor.
La instancia que corre Coolify tiene poca memoria y un build la agota. El
servidor sólo descarga una imagen ya construida.

Por eso el [`Dockerfile`](../Dockerfile) es de *sólo ejecución*: recibe
`dist/` (frontend) y `server/dist/` (backend) ya compilados y únicamente
instala dependencias de producción.

> No configurar Coolify para construir desde el repositorio Git: esa modalidad
> compila en la instancia.

## Flujo

```
push a main
  └─ GitHub Actions (.github/workflows/deploy.yml)
       ├─ npm ci + npm run build           (frontend, VITE_API_URL=/api)
       ├─ npm ci + npm run build           (backend → server/dist)
       ├─ docker build + push              → ghcr.io/chronosedwin8/bibliotecacalemanmysql:latest
       └─ POST /api/v1/deploy              → Coolify
            └─ descarga la imagen y reinicia el contenedor
```

Desplegar a mano: pestaña **Actions → Build & Deploy → Run workflow**.

## Infraestructura

| Recurso | Valor |
|---|---|
| Coolify | http://18.227.167.82:8000 (v4.3.17) |
| Proyecto | `fc7nrsria80noq5ych8focil` |
| Servidor | `z9hq3dwv03448fglomdw1hin` |
| Aplicación | `oqubrpfehyq5yysndzflnf49` |
| MySQL | `lj1jnenioaoyiwsanonppkbm` |
| Imagen | `ghcr.io/chronosedwin8/bibliotecacalemanmysql` |

El UUID de MySQL **es su hostname interno**, de ahí
`DB_HOST=lj1jnenioaoyiwsanonppkbm`.

TLS lo emite Let's Encrypt automáticamente vía Traefik. El registro A
`biblioteca` → `18.227.167.82` está en ZoneEdit.

## Configuración

Las variables de producción viven en Coolify, no en el repositorio:

```
GET  /api/v1/applications/oqubrpfehyq5yysndzflnf49/envs
PATCH /api/v1/applications/oqubrpfehyq5yysndzflnf49/envs/bulk
```

Incluyen `DB_*`, `JWT_SECRET`, `AWS_*`, `S3_BUCKET` y `PHIDIAS_TOKEN`.
Tras cambiarlas hay que redesplegar.

Secrets del repositorio usados por el workflow: `COOLIFY_URL`,
`COOLIFY_TOKEN`, `COOLIFY_APP_UUID`.

## Operar la base de datos

Sólo están abiertos los puertos **22, 80, 443 y 8000**: exponer MySQL desde
Coolify no funciona porque el grupo de seguridad de AWS lo bloquea. Hay que
entrar por SSH. La clave privada del host la entrega la propia API:

```bash
curl -H "Authorization: Bearer $COOLIFY_TOKEN" \
  http://18.227.167.82:8000/api/v1/security/keys   # → [0].private_key

# Cargar un volcado
cat dump.sql | ssh -i clave root@18.227.167.82 \
  "docker exec -i lj1jnenioaoyiwsanonppkbm mysql -u root -p'<root>' \
   --default-character-set=utf8mb4 biblioteca"
```

Usar **root**, no el usuario `biblioteca`: el volcado trae triggers y con
binary logging activo un usuario sin privilegio SUPER falla con `ERROR 1419`.

## Errores conocidos

- **`HTTP 405` al desplegar** — Coolify ≥ 4.3 exige `POST` en `/api/v1/deploy`;
  antes era `GET`.
- **`GH013` al hacer push** — el repositorio es público y tiene push protection.
  Sacar el secreto del historial; **nunca** usar el enlace de *allow secret*,
  porque publica la credencial.
