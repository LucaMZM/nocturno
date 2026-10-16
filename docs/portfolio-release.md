# Nocturno avanzado · Verificación local histórica (7 de octubre de 2026)

Este documento conserva la comprobación de esa fecha. Para el catálogo y la licencia actuales consulta el [README](../README.md), [fuentes demo](demo-sources.md) y [LICENSE](../LICENSE).

**Fecha:** 7 de octubre de 2026 (Europe/Madrid). Este informe describe lo comprobado en el árbol local. No hay directorio `.git` en esta copia, por lo que `git status` y `git diff` no pueden establecer una base de cambios ni confirmar qué archivos se publicarían. No se hizo push.

## Resultado reproducible

| Comprobación | Resultado |
| --- | --- |
| PostgreSQL migrations | 001–006 registradas en `schema_migrations`; `npm run db:migrate` repetido sin error. |
| Seed | `npm run db:seed` ejecutado dos veces consecutivas: 15 venues, 4 promoters, 27 events, 42 ticket types, 7 orders, 12 tickets en ambas. |
| Constraints | Presentes `events_deleted_inactive_check`, `ticket_types_stock_limit` y unicidad `(event_id, user_id)` en `event_waitlist`. |
| Backend | `npm test`: 20/20, sin saltos; `npm run check`: correcto. Las pruebas de integración usaron PostgreSQL local. |
| Frontend | `npm test`: 12/12; `npm run build`: correcto con Node 24.21.0. Avisos de CommonJS para QR/Leaflet/dijkstrajs, sin errores de compilación. |
| Responsive | 390 px móvil, 768 px tablet y 1280 px escritorio revisados. Sin desbordamiento horizontal del documento en las pantallas observadas; tablas de gestión tienen contenedor de desplazamiento propio. |
| Docker | Daemon inaccesible: no se ejecutó `docker compose up --build`. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` y `STRIPE_WEBHOOK_SECRET` ausentes. Stripe test-mode E2E **no verificado**. Checkout de pago muestra el límite. |

## Flujos contrastados

- **Público:** Home y Discover; filtros en modal central, URL `?municipality=Valencia&genre=TECHNO`, scroll a `0` al aplicar y 2 resultados tanto en Lista como en Mapa; pin y vista previa; Event Detail, Venue y Promoter públicos. El modal bloquea el scroll de fondo; ESC y foco se verificaron en la pasada de navegador precedente.
- **USER:** login demo, favorito, carrito con línea y total, pantalla de checkout con aviso de Stripe no configurado, pedidos históricos, entradas y QR. La compra de pago real quedó sin ejecutar por falta de claves. Los tests backend cubren checkout gratuito, emisión y stock concurrente.
- **Waitlist:** el evento agotado mostró entradas deshabilitadas, inscripción y estado persistente; el test HTTP repite la inscripción y comprueba una sola fila por usuario/evento. No se envían correos.
- **PROMOTER:** dashboard limitado a 146 € y 7 entradas frente al global ADMIN de 236 € y 12; Top Events ordenado por ingresos y por próxima fecha; ventas recientes, tipos de entrada con vendidas/reservadas/disponibles y centro de acceso. La prueba aislada de ownership deniega modificar un evento ajeno.
- **Check-in:** búsqueda manual por prefijo de código, ticket inexistente rechazado, entrada válida aceptada (0/3 → 1/3), segundo uso rechazado y resumen/actividad actualizados. El navegador abrió una cámara y mostró el estado activo; no se verificó un QR leído ópticamente. Hay mensaje y alternativa manual si falla el permiso.
- **ADMIN:** dashboard global, filtros Todos/Activos/Inactivos/Borrados, pedidos con filtro por evento, pagos con referencias demo señaladas y sin acción de refund Stripe para ellas, usuarios, venues y promoters. La papelera está vacía en el seed; su ciclo real se verifica en la suite de integración.
- **Dominio:** tests reales de slug regenerado por título, colisiones, soft-delete/restauración inactiva, consultas separadas, constraint SQL, snapshots, evento cancelado con pedido/tickets históricos conservados, webhook firmado/idempotente y reembolso completo simulado. La API de refund real es idempotente; una referencia `pi_demo_` se rechaza antes de contactar Stripe.
- **Compartir/calendario:** implementación revisada; test `.ics` confirma escape, fecha UTC y ubicación. En este navegador la pulsación de calendario no produjo un evento de descarga observable, y la hoja nativa de compartir tampoco dio confirmación observable; se consideran implementadas pero sin prueba E2E de descarga/compartición.

## Límites y pendientes de publicación

1. Hacer una revisión Git real desde una copia con `.git` o inicializar el repositorio y revisar qué se añade. `.gitignore` excluye `.env`, logs, `node_modules`, builds y temporales. El escaneo local no encontró claves Stripe/JWT ni bloques de clave privada en archivos publicables. Nunca añadir `backend/.env`.
2. Proporcionar claves Stripe **test** y ejecutar pago, fallo, refund y webhook end to end en una cuenta de prueba. Los fixtures locales no sustituyen esa prueba.
3. Arrancar Docker cuando el daemon esté disponible y verificar sus tres servicios y healthchecks.
4. Probar geolocalización concedida en dispositivo que entregue posición y lectura óptica de un QR con cámara. Aquí **Cerca de mí** agotó el tiempo, mostró error comprensible y conservó la ciudad manual; los tests simulados cubren permiso concedido/denegado/timeout.
5. Tomar [capturas reales](screenshots/README.md), revisar derechos de imágenes externas, decidir licencia y preparar secretos/HTTPS del despliegue. No hay licencia concedida todavía.
6. La suite frontend actual comprueba contratos y lógica en Node; faltan tests automatizados con DOM real de componentes Angular. Las pantallas se contrastaron manualmente en el navegador.

Los 21 eventos de compra y sus carteles locales son ficticios. Las seis sesiones reales son informativas y temporales; [fuentes](demo-sources.md). Las imágenes externas y las teselas OpenStreetMap dependen de sus servidores, aunque Discover consulta el catálogo y los filtros en PostgreSQL.

## Preparación previa a GitHub · 7 de octubre de 2026

- Se añadieron dos jobs a [GitHub Actions](../.github/workflows/ci.yml): backend con PostgreSQL 17 temporal, migraciones, tests y check de sintaxis; frontend con tests y build. El YAML se analizó localmente, pero GitHub Actions aún no se ha ejecutado porque no existe repositorio.
- Se repitió la lógica backend de CI sobre una base **vacía y temporal en PostgreSQL 18 local**: se aplicaron 001–006, pasaron 20/20 tests sin saltos y el check de sintaxis. La base se eliminó al terminar. El servicio PostgreSQL 17 del workflow espera su primera ejecución en GitHub. Con Node 24.21.0, frontend pasó 12/12 y completó el build.
- Una simulación de `git add -n --all` con `.gitignore` detectó 257 archivos candidatos. `backend/.env`, logs, `node_modules`, `dist` y `.angular` quedaron fuera; ambos `.env.example` y el workflow entraron. Se retiraron tres `.DS_Store` y un `package-lock.json` raíz sin `package.json` asociado.
- El escaneo de archivos candidatos no encontró claves JWT/Stripe reales, claves privadas ni tokens personales. Las cadenas Stripe en tests son fixtures y las contraseñas del seed son cuentas demo públicas. Esta búsqueda no reemplaza revisar el primer staging real.
- `npm audit --omit=dev` del backend: 0 avisos. Auditoría completa: 3 `high` en `nodemon → chokidar → braces`, solo de desarrollo, sin parche disponible para `braces`; detalle en [preparación para GitHub](publishing.md). `npm ci` frontend notificó 0 vulnerabilidades.
- Docker daemon siguió inaccesible. Stripe E2E continúa pendiente de claves test. La imagen principal del frontend, los carteles y futuras capturas requieren revisión de derechos antes de hacer público el repositorio.
