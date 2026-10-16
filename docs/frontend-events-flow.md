# Flujo de Events

```text
app.routes.ts (/) → EventsListPage → EventFiltersComponent / EventGridComponent
  → EventsStore → EventsApiService → GET /api/events
  → event.routes.js → eventController → eventService → eventRepository → PostgreSQL
  ← JSON paginado ← EventsStore ← EventCardComponent
```

Los filtros están en la URL. `event-filter-contract.ts` los valida y serializa; un cambio navega a otra URL, el store consulta de nuevo y protege la pantalla contra respuestas antiguas. El filtro `atmosphere` usa la columna `events.atmosphere`. La búsqueda espera 320 ms.

La tarjeta abre `/events/:slug`. `EventDetailPage` llama `EventsStore.loadEventBySlug()` y `EventsApiService.getEventBySlug()`, que termina en `GET /api/events/slug/:slug`. `EventDetailStore` carga después local, promotor y tipos de entrada. El slug público solo resuelve eventos activos, publicados o agotados y no borrados. En gestión se usa UUID: las páginas de crear y editar comparten `EventFormComponent`; el backend vuelve a generar el slug cuando cambia el título. Las entradas se gestionan en `/dashboard/events/:id/tickets`.

Un promotor solo puede consultar y modificar sus propios eventos y entradas. Admin puede gestionar todos. `PATCH /api/events/:id/soft-delete` mantiene relaciones y oculta el evento públicamente.
