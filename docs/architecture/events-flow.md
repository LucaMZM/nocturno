# Events: recorrido real del código

## Del navegador a las tarjetas

1. `frontend/src/app/app.routes.ts` carga `EventsListPage` en `/` y `EventDetailPage` en `/events/:slug`.
2. `frontend/src/app/features/events/pages/events-list.page.html` conecta búsqueda, fechas y controles con `EventsListPage`. El modal está en `frontend/src/app/features/events/components/event-filters.html`; `EventFiltersComponent` emite cambios, no consulta la API.
3. `EventsListPage.onFiltersChange()` combina el cambio con los filtros actuales y reinicia la página. `navigateWithFilters()` actualiza los query params. `syncFiltersFromUrl()` los interpreta con `parseEventFilters()` y los entrega a `EventsStore.replaceFilters()`. `filtersAwaitingNavigation` conserva cambios consecutivos mientras termina la navegación. `untracked()` impide que las lecturas internas del store y ubicación conviertan el efecto de URL en un efecto dependiente de esos estados. El contrato de parseo y serialización vive en `frontend/src/app/shared/utils/event-filter-contract.ts`.
4. `frontend/src/app/features/events/store/events.store.ts` conserva filtros, resultados, paginación y estados de carga/error. `loadEvents()` llama a `EventsApiService.getEvents()` y descarta respuestas antiguas mediante `latestListRequestId`. Para páginas posteriores, añade resultados a la lista.
5. `frontend/src/app/features/events/services/events-api.service.ts` transforma filtros en `HttpParams` con `eventFiltersToHttpParams()` y hace `GET /api/events`. Solo añade coordenadas, radio y orden por distancia cuando la ubicación automática está disponible. La vista Mapa reutiliza este método desde `EventsListPage.loadMap()`, con su propio identificador de petición para descartar respuestas antiguas.
6. En backend, `backend/src/routes/event.routes.js` valida la query con `eventQuery` de `backend/src/validators/event.validator.js` y llama a `eventController.getEvents()` en `backend/src/controllers/event.controller.js`. Este llama a `eventService.getEvents()` en `backend/src/services/event.service.js`, que delega en `eventRepository.findAll()` de `backend/src/repositories/event.repository.js`.
7. `buildEventListQuery()` construye SQL parametrizado con visibilidad pública, filtros, orden, `LIMIT` y `OFFSET`. `findAll()` consulta PostgreSQL y devuelve eventos y total. El controller responde con `data` y `pagination`.
8. De vuelta, el store actualiza sus señales. `events-list.page.html` entrega `eventsStore.events()` a `EventGridComponent`. El `@for` que dibuja cada evento está en `frontend/src/app/features/events/components/event-grid.ts`; cada `EventCardComponent` está en `frontend/src/app/features/events/components/event-card.ts`.

Buscar, elegir un filtro o cambiar el orden sigue el mismo camino. «Ver más planes» usa `onPageChange()` y `page` en la URL. Los favoritos se delegan a `FavoritesStore.toggle()` en `frontend/src/app/features/favorites/store/favorites.store.ts`. Pulsar la tarjeta navega a `/events/:slug`: `EventDetailPage` llama a `EventsStore.loadEventBySlug()`, que usa `EventsApiService.getEventBySlug()`; el backend sigue route → controller → service → `eventRepository.findPublicBySlug()`.

## Explicación de cinco minutos

- **Minuto 1:** abre `app.routes.ts` y muestra qué página corresponde a `/`.
- **Minuto 2:** en `events-list.page.html` pulsa mentalmente un filtro y sigue su output hasta `onFiltersChange()` y `navigateWithFilters()`.
- **Minuto 3:** enseña `syncFiltersFromUrl()`, `parseEventFilters()` y `EventsStore.replaceFilters()`: la URL conserva el filtro al volver o compartir el enlace.
- **Minuto 4:** sigue `loadEvents()` → `getEvents()` → route → controller → service → repository. Señala el `WHERE`, el `LIMIT/OFFSET` y el total en SQL.
- **Minuto 5:** vuelve a las señales del store y al `@for` de `event-grid.ts`; termina con el enlace por slug de `event-card.ts`.
