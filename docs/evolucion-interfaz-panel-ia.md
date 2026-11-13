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
