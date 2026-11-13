# Evolución por hitos

## A: interfaz
Se retiran los avatares personales de UI, tipos, escritura y respuestas de API.
La columna histórica users.avatar_url y su constraint permanecen. No se modifican
sesiones ni cookies. Yomogan conserva su identidad. Home deja de pedir facetas
para carruseles, aunque los seis endpoints Shop siguen disponibles.

## B: gestión y medición
/dashboard/events mantiene tabla y añade cuadrícula y calendario. El estado está
en DashboardStore; la URL contiene filtros, página, vista y mes. Los filtros se
aplican antes del conteo y paginación en PostgreSQL. La ordenación usa una lista
blanca. El calendario solicita TODAS las páginas de 100 eventos del rango del
mes, intersectado con los filtros. Horarios y límites civiles: Europe/Madrid.

La migración incremental 015_event_daily_views.sql solo añade contadores diarios
y un índice. No se ha aplicado a la base habitual. Aplicarla con npm run db:migrate
antes de arrancar esta versión contra esa base.

POST /api/shop/events/:slug/view registra una visita autorizada expresamente desde
el detalle; GET /api/dashboard/most-visited?days=7 (o 30) muestra el ranking real,
limitado por ownership. Sin registros, se muestra vacío. sort=views ordena por
últimos 30 días; sold sigue siendo la suma real del stock vendido.

### Privacidad y límites de la métrica
No se activa medición automáticamente, ni se reutiliza el demostrador de cookies
como consentimiento jurídico. El visitante autoriza cada registro desde el detalle.
PostgreSQL contiene únicamente event_id, día y contador. Un HMAC efímero de IP/día
permanece solo en memoria del servidor para deduplicar; no se registran IPs en esta
tabla. No son personas únicas: NAT puede infracontar, un reinicio o varias réplicas
pueden contar de nuevo. Un atacante puede falsificar User-Agent; la detección de
bots/prefetch y los límites reducen abuso, no certifican tráfico humano.
Se requieren política de privacidad y revisión del despliegue antes de utilizar
estas métricas para analítica comercial. Los logs generales existentes del servidor
tienen su política independiente; esto no los convierte en anónimos.

### Pruebas
A: 82 backend, 51 frontend, build correcto.
B: 83 backend, 53 frontend, build correcto; migraciones y auditoría en base temporal.
Pruebas SQL de ownership, filtros, orden y visitas/dedupe. Tests del contrato URL
y cambios DST. Navegador headless con seed exclusivamente en base efímera:
Home sin carruseles, perfil sin avatares, grid a 390/768/1280 sin overflow,
calendario, cambio de mes y recarga con filtros. Capturas en screenshots/evolucion.

## Continuidad
Los hitos C (separación Core/AI/Gateway) y D (mejoras y mediciones Ollama) deben
verificarse por separado. No inferir aislamiento por la existencia de este documento.

## C: arquitectura separada
Core conserva npm start y escucha 127.0.0.1:3000. AI arranca con npm run start:ai
en 127.0.0.1:3001; Gateway con npm run start:gateway en 127.0.0.1:8080.
Angular npm start usa proxy 8080. Las rutas públicas de Yomogan no cambian.

AI no carga backend/.env y rechaza arrancar si hereda DATABASE_URL, PGPASSWORD,
PGUSER, STRIPE_* o JWT_*. Su configuración reside exclusivamente en ai/.env
(copiar ai/.env.example). No copiar allí el .env de Core. El código RAG y el
adaptador Ollama se han trasladado a ai/, sin segunda implementación en Core.
La caché de embeddings es acotada y propia del proceso AI, no escribe PostgreSQL.

La proyección Core /api/catalog-context es de solo lectura y filtra publicación,
stock, precios y datos públicos en SQL. El Gateway bloquea su acceso externo;
AI la consulta directamente sin cookies ni credenciales. No tiene herramientas
para ejecutar acciones, consultar usuarios o comercio. Gateway pasa los bytes
del webhook sin parsearlos; las cookies y cabeceras CSRF llegan solo a Core.
Tiene límites de cuerpo, timeout, rutas explícitas y errores sin secretos.

### Límites de aislamiento
Puertos y procesos NO constituyen una frontera de seguridad frente a código
arbitrario con el mismo usuario de macOS. Localmente se separan responsabilidades
y entornos; el despliegue debe usar usuarios/contenedores distintos, sin volúmenes
de secretos compartidos. Compose separa PostgreSQL en red data, inaccesible para
AI, y no publica Core/AI. Solo frontend expone acceso al host. Compose es opcional
y su runtime no se declara verificado sin daemon. La red de catálogo permite
salida al proveedor; aplicar una allowlist de egress en producción.
Los logs de Core siguen su configuración previa; Gateway y AI no registran
tokens ni cuerpos. El límite de AI se aplica globalmente al tráfico del Gateway
y limita concurrencia; no se confía en X-Forwarded-For enviado por visitantes.

### Arranque en Mac
1. Iniciar PostgreSQL desde Postgres.app.
2. brew services start ollama (modelos existentes: qwen3:4b y embeddinggemma).
3. En backend: npm run db:migrate antes del primer arranque de esta versión.
4. En terminales separadas dentro de backend:
   npm start
   npm run start:ai
   npm run start:gateway
5. En frontend: npm start.
6. Stripe CLI: stripe listen --forward-to localhost:8080/api/stripe/webhook.
   Guardar el whsec del listener solo en backend/.env, nunca en AI ni Git.

La migración 015 no se ha aplicado a la base habitual. El arranque contra datos
habituales requiere aplicarla explícitamente; no ejecutar db:seed ni db:reset.
