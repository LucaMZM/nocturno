# Capturas reales de Nocturno

Estas diez imágenes se capturaron con Chromium en un runner aislado de [GitHub Actions](../../.github/workflows/capture-screenshots.yml), con PostgreSQL, backend, frontend y el seed de desarrollo. Son pantallas de la aplicación en funcionamiento; los eventos, importes, compradores y entradas son datos demo. Las fotografías de locales que aparecen en la interfaz permanecen atribuidas en [fuentes de la demo](../demo-sources.md); Nocturno no está afiliado a esos locales.

| Archivo | Vista |
| --- | --- |
| [01-home.png](01-home.png) | Portada |
| [02-discover.png](02-discover.png) | Discover con eventos en Valencia |
| [03-discover-map.png](03-discover-map.png) | Mapa con teselas y marcadores |
| [04-event-detail.png](04-event-detail.png) | Detalle de evento demo |
| [05-ticket-selection.png](05-ticket-selection.png) | Selección de dos entradas y subtotal |
| [06-cart.png](06-cart.png) | Carrito con dos entradas |
| [07-account-ticket.png](07-account-ticket.png) | Entradas de la cuenta demo |
| [08-ticket-qr.png](08-ticket-qr.png) | QR de un ticket demo |
| [09-dashboard.png](09-dashboard.png) | Dashboard ADMIN con métricas del seed |
| [10-checkin.png](10-checkin.png) | Check-in concedido y resumen de asistentes |

El QR se capturó antes de validar la entrada en la base efímera del runner. La misma ejecución validó el acceso y confirmó que un segundo check-in era rechazado. Ese código no representa un acceso vigente.

Para regenerar las capturas, ejecuta manualmente el workflow **Capture portfolio screenshots** en GitHub Actions y descarga el artefacto `nocturno-screenshots`. El script está en [`frontend/tools/capture-screenshots.mjs`](../../frontend/tools/capture-screenshots.mjs). No requiere Stripe ni usa un navegador local.
