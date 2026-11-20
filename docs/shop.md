# Shop: catálogo público reactivo

Shop adapta el dominio existente: categoría = género musical, host = promotor,
location = local, producto = evento y variante = tipo de entrada. No crea tablas
duplicadas ni modifica Auth, Users, Profile, reservas o cobros.

## API

| GET | Respuesta |
| --- | --- |
| /api/shop/categories | Géneros presentes en eventos públicos |
| /api/shop/hosts | Promotores con eventos públicos; sin email ni teléfono |
| /api/shop/locations | Locales con eventos públicos |
| /api/shop/events | Eventos en data y metadatos en pagination |
| /api/shop/events/:slug | Evento público, galería y relaciones |
| /api/shop/events/:slug/variants | Tipos activos, stock disponible y purchasable |

Las colecciones y detalles utilizan el contenedor `data`. Los errores conservan
el middleware global y AppError. La validación Zod responde 400 a parámetros
incorrectos; un slug privado o inexistente responde 404.

Ejemplo:

```text
/api/shop/events?municipality=Valencia&genre=TECHNO&maxPrice=20&page=1&limit=12&sort=date
```

Contrato existente, sin alias ambiguos: municipality, province, genre,
atmosphere, eventType, idealFor, venueId, promoterId, dressCode, status,
dateFrom, dateTo, minPrice, maxPrice, minimumAge, search, page, limit y sort.
Ordenaciones: date, price, createdAt y distance. La API también admite latitude,
longitude y radiusKm (2, 5, 10, 25 o 50); coordenadas y radio nunca se persisten.
Fechas en ISO con zona horaria y precios en euros según el modelo existente.

Router → Controller → Service → Repository → PostgreSQL.
El adaptador reutiliza eventQuery, eventService y eventRepository. Sus consultas
SQL existentes aplican las mismas condiciones al listado y al contador, antes de
LIMIT/OFFSET, con valores parametrizados y ordenación de lista blanca.
Las facetas se obtienen mediante consultas de conjuntos, sin N+1.

Se conserva la visibilidad pública existente: activos, no eliminados y
PUBLISHED/SOLD_OUT. Un evento histórico todavía publicado conserva su enlace;
sus variantes no son comprables después de endsAt. FINISHED, CANCELLED y
estados privados quedan excluidos. El agotamiento no oculta el detalle.
`available = max(0, quantity - sold - reserved)`; `purchasable` añade estado,
fin del evento y ventana de venta. El carrito y checkout siguen recalculando
precios y stock en backend, sin confiar en el navegador.

## Angular

- `/`: Discover existente, ampliado con secciones dinámicas del catálogo.
- `/events`: listado reutilizado sin los carruseles de inicio.
- `/events/:slug`: detalle existente con variantes de Shop.
- Se conservan enlaces de Home con filtros, Venue, Promoter y Dashboard.

ShopApiService ofrece los seis métodos públicos tipados. ShopStore es un alias
del SignalStore existente EventsStore, no una segunda instancia o fuente de
verdad. ShopDiscoveryStore gestiona únicamente carga, error y colecciones de
la Home.

La Page observa queryParamMap, normaliza mediante el contrato único de filtros
y carga el Store. Los cambios navegan mediante Router. Atrás, Adelante y F5
restauran filtros y página; las búsquedas reinician la página. Parámetros
desconocidos se eliminan de la URL canónica. Las coordenadas precisas permanecen
en memoria. La paginación reemplaza la página visible: no acumula resultados de
visitas anteriores.

SearchBar conserva debounce de 320 ms y cancela el temporizador al destruirse
o recibir un estado de navegación. EventsStore y mapa desuscriben HttpClient con
takeUntil cuando llega una búsqueda nueva; los identificadores de petición
también impiden que errores o respuestas antiguos cambien el estado actual.
El mapa mantiene los mismos filtros y su límite explícito de 100 marcadores.

Componentes reutilizados: SearchBar, EventFilters, EventCard, EventGrid,
EventMap, ActiveFilters y TicketTypeCard. Nuevos: ShopPagination y ShopCarousel.
El carrusel usa una plantilla tipada para categorías, promotores y locales en
vez de tres componentes idénticos. Imágenes solo cuando existen en la API;
enlaces nativos, foco visible y desplazamiento horizontal interno.

## Índices y compatibilidad

Revisados los índices existentes de migrations 001, 005, 006 y 009:
venue_id, promoter_id, starts_at, status/starts_at, municipality, province,
ticket_types.event_id, slugs únicos y event_images.event_id/position.
No se añade una migración ni se toca el esquema habitual. Un índice GIN o
trigramas se justificaría con EXPLAIN y un volumen real mayor; no se introduce
por duplicar requisitos académicos. El precio agregado no es una columna
persistida de Events.

## Verificación

- Backend: suite completa sobre una base PostgreSQL temporal, migraciones
  existentes, comprobación sintáctica y db:audit.
- Frontend: suite completa, incluido HttpTestingController para cancelación
  real de HttpClient, serialización, seis métodos y estados de carruseles.
- Build Angular de producción.
- Las pruebas de Shop comprueban seis endpoints, filtros combinados, paginación,
  precio, parámetros inválidos, exclusión pública, stock y endpoints anteriores.
- Las pruebas de regresión existentes cubren Auth/cookies, carrito y checkout.
  Esto no equivale a una nueva compra Stripe E2E.

La rama Shop depende de codex/auth-cookie-security (PR #5). Su PR debe apuntar
a esa rama hasta que Auth se fusione. CI admite ese destino para comprobar los
dos trabajos sin modificar main.

### Resultados de esta entrega

- 82/82 tests backend; sin omisiones. Sintaxis y auditoría de integridad correctas.
- 52/52 tests frontend; sin omisiones.
- Build de producción correcto. Persisten los avisos de dependencias CommonJS
  de Leaflet y dijkstrajs.
- Chromium headless con PostgreSQL temporal: carruseles, filtros, F5, página 2,
  búsqueda, Atrás/Adelante y detalle con variantes. Sin errores JavaScript ni
  overflow horizontal a 390, 768 y 1280 px.
- [Home móvil](screenshots/shop/home-390.png),
  [tablet](screenshots/shop/home-768.png),
  [escritorio](screenshots/shop/home-1280.png) y
  [detalle](screenshots/shop/detail-1280.png).
  Estas capturas usan el seed únicamente en una base efímera; no representan
  una modificación del catálogo habitual ni validan disponibilidad externa de imágenes.
