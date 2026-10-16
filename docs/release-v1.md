# Nocturno v1 · Estado de release candidate

> Informe histórico de la pasada v1. Para la versión avanzada actual, consulta [verificación de portfolio](portfolio-release.md).

## Qué incluye la demo

La base local se prepara con `cd backend && npm run db:migrate && npm run db:seed`. El seed se puede repetir y deja 15 locales, 4 promotores, 27 eventos (21 ficticios para comercio y 6 sesiones reales informativas), 42 tipos de entrada, 7 pedidos pagados ficticios y 12 entradas. Los locales están repartidos entre Valencia, Madrid y Barcelona; tienen dirección, código postal y coordenadas. Los 21 carteles SVG de `frontend/public/posters` corresponden a los eventos ficticios; las fuentes de las sesiones reales figuran en [fuentes de la demo](demo-sources.md). El panel obtiene sus ventas, ocupación e ingresos de PostgreSQL. Las únicas credenciales de la demo están en el README.

## Recorridos que conviene enseñar

1. Elegir Valencia, Madrid y Barcelona desde la cabecera; Discover conserva la localidad en la URL.
2. Combinar género, fecha, precio y ambiente. Un conjunto de comprobación es Valencia + TECHNO + esta noche + máximo 20 € + radio 10 km con coordenadas de Valencia. El backend filtra por distancia antes de paginar.
3. Pulsar **Cerca de mí**: el navegador solicita ubicación en ese momento. En caso de éxito, aparecen radio, orden por distancia y distancia en las tarjetas. Si falla o se deniega el permiso, la ciudad manual permanece disponible.
4. Abrir un evento por slug, añadir una entrada al carrito y revisar la cuenta. Las compras de pago necesitan Stripe test; las entradas gratuitas no.
5. Entrar como PROMOTER, revisar métricas y ventas recientes, filtrar eventos y ventas, editar un evento y crear tipos de entrada.
6. Entrar como ADMIN para filtrar usuarios, pedidos, pagos y entradas, además de gestionar eventos, promotores y locales.
7. En Eventos del ADMIN, alternar Todos, Activos, Inactivos y Borrados. El borrado conserva el estado de publicación y desactiva; Restaurar deja el evento inactivo; Activar es una acción posterior.

## Estado de las dependencias externas

- **Stripe test:** no hay claves de prueba. Las firmas y transiciones de webhooks están probadas con fixtures locales, pero falta un PaymentIntent, un fallo y un reembolso reales en cuenta Stripe test. Configurar `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` y `STRIPE_WEBHOOK_SECRET` en `backend/.env` y Stripe CLI para completar esa comprobación. El flujo de pago informa claramente cuando Stripe está desconfigurado.
- **Docker:** `docker-compose.yml` fija versiones y define healthchecks; solo se puede probar `docker compose up --build` con el daemon activo. La falta de daemon no afecta al arranque local por Node y PostgreSQL.
- **Geolocalización real:** la posición depende del permiso del navegador y de los servicios de ubicación del sistema. Las pruebas automatizadas cubren éxito, denegación, timeout y ausencia de API mediante simulación. El navegador de esta sesión agotó el tiempo de ubicación y mostró el mensaje correspondiente sin perder la ciudad elegida. Queda pendiente comprobar en un dispositivo con ubicación operativa las ramas de permiso concedido y denegado, el selector de radio y la distancia visible en EventCard.

## Verificación

```bash
cd backend && npm test && npm run check
cd frontend && npm test && npm run build
```

Los tests backend incluyen una prueba aislada de autorización PROMOTER, edición de slug, compra concurrente, emisión de tickets y webhooks idempotentes. Los tests frontend actuales comprueban lógica de filtros, URL, distancia, geolocalización simulada y roles; las rutas y formularios se contrastan adicionalmente en navegador. No hay una suite de componentes Angular con DOM automatizado, por lo que esa cobertura sigue siendo una mejora pendiente antes de una versión de producción.

La revisión visual de esta sesión se pudo hacer a 636 px de ancho, sin desbordamiento horizontal en Discover ni en el formulario de evento. El control del navegador ignoró la solicitud de 390 px, así que ese breakpoint no quedó probado de forma visual.

## Límites de v1

Los pagos del seed son registros ficticios para la demo y no llegan a Stripe. Los reembolsos parciales no están representados; la lógica v1 cubre reembolso completo. `distanceKm` se calcula por petición y nunca se persiste. Para producción se deben generar secretos JWT propios, habilitar HTTPS y cookies Secure, configurar CORS con el dominio definitivo, usar credenciales Stripe reales y no ejecutar el seed demo.
