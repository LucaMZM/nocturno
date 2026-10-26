const str = (maxLength) => ({ type: 'string', ...(maxLength ? { maxLength } : {}) });
const nullable = (schema) => ({ ...schema, nullable: true });
const uuid = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date-time' };
const url = { type: 'string', format: 'uri' };
const integer = (minimum = 0) => ({ type: 'integer', minimum });
const money = { type: 'number', minimum: 0, maximum: 99999999.99, multipleOf: 0.01 };
const array = (items) => ({ type: 'array', items });
const values = (items) => ({ type: 'string', enum: items });
const venueTypes = ['CLUB','DISCOTHEQUE','BAR','PUB','ROOFTOP','BEACH_CLUB','CONCERT_HALL','FESTIVAL_SITE','OUTDOOR','OTHER'];
const eventTypes = ['CLUB','RAVE','CONCERT','FESTIVAL','ROOFTOP','BEACH_CLUB','BOAT_PARTY','PUB','AFTER','JAZZ_CLUB','LIVE_SESSION','OTHER'];
const statuses = ['DRAFT','PENDING_REVIEW','PUBLISHED','SOLD_OUT','CANCELLED','FINISHED','REJECTED'];
const genres = ['TECHNO','HARD_TECHNO','HARDGROOVE','HOUSE','TECH_HOUSE','EDM','REGGAETON','LATIN','HIP_HOP','TRAP','POP','INDIE','ROCK','JAZZ','SOUL','LIVE'];
const atmospheres = ['UNDERGROUND','COMMERCIAL','UNIVERSITY','ELEGANT','INTERNATIONAL','ALTERNATIVE','CHILL'];
const ideals = ['FRIENDS','MEETING_PEOPLE','DANCING','DATE','GROUPS','CELEBRATIONS','DRINKS'];
const object = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const eventImageInput = object({ url: str(2048), altText: nullable(str(240)), sourceUrl: nullable(url) }, ['url']);
const bodySchema = {
  User: object({ email: { type: 'string', format: 'email', maxLength: 320 }, displayName: str(120) }, ['email','displayName']),
  Promoter: object({ name: str(160), description: nullable(str(5000)), email: nullable({ type: 'string', format: 'email' }), phone: nullable(str(40)), websiteUrl: nullable(url) }, ['name']),
  Venue: object({ name: str(160), description: nullable(str(5000)), type: values(venueTypes), province: str(120), municipality: str(120), zone: nullable(str(120)), address: str(240), postalCode: nullable({ type: 'string', pattern: '^[0-9]{5}$' }), latitude: nullable({ type: 'number', minimum: -90, maximum: 90 }), longitude: nullable({ type: 'number', minimum: -180, maximum: 180 }), capacity: nullable(integer()), minimumAge: nullable(integer()), websiteUrl: nullable(url), imageUrl: nullable(url) }, ['name','type','province','municipality','address']),
  Event: object({ venueId: uuid, promoterId: nullable(uuid), title: str(180), description: nullable(str(5000)), eventType: values(eventTypes), startsAt: date, endsAt: date, minimumAge: nullable(integer()), dressCode: nullable(values(['CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE'])), musicGenres: array(values(genres)), atmosphere: array(values(atmospheres)), idealFor: array(values(ideals)), posterUrl: nullable({ type: 'string', description: 'HTTP(S) URL or local /posters/*.svg asset' }), images: array(eventImageInput), sourceUrl: nullable(url), imageSourceUrl: nullable(url), status: values(statuses), isActive: { type: 'boolean' } }, ['venueId','title','eventType','startsAt','endsAt']),
  TicketType: object({ name: str(120), price: money, quantity: integer(), salesStart: nullable(date), salesEnd: nullable(date), maxPerUser: nullable(integer(1)), benefits: array(str(160)), active: { type: 'boolean' } }, ['name','price','quantity'])
};
const record = (name, extra = {}) => object({ id: uuid, ...bodySchema[name].properties, createdAt: date, updatedAt: name === 'Event' ? nullable(date) : date, ...extra });
const error = { type: 'object', properties: { error: { type: 'object', properties: { code: str(), message: str(), details: { nullable: true } }, required: ['code','message','details'] } } };
const response = (schema) => ({ description: 'Success', content: { 'application/json': { schema } } });
const wrapped = (schema) => object({ data: schema }, ['data']);
const list = (schema) => object({ data: array(schema), pagination: object({ page: integer(1), limit: integer(1), total: integer(), totalPages: integer() }, ['page','limit','total','totalPages']) }, ['data','pagination']);
const err = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
const commonErrors = { '400': err('Validation error or invalid UUID'), '401': err('Authentication required'), '403': err('Forbidden'), '404': err('Resource not found'), '409': err('Conflict'), '422': err('Business rule or database constraint'), '429': err('Rate limit exceeded'), '500': err('Internal server error'), '502': err('External dependency error'), '503': err('Service unavailable') };
const idParam = (name = 'id') => ({ name, in: 'path', required: true, schema: uuid });
const query = (name, schema) => ({ name, in: 'query', schema });
const pages = [query('page', { type: 'integer', minimum: 1, default: 1 }), query('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 })];
const jsonBody = (schema) => ({ required: true, content: { 'application/json': { schema } } });
function crudPaths(root, name, options = {}) {
  const resource = { $ref: `#/components/schemas/${name}` };
  const tag = name === 'TicketType' ? 'Ticket types' : `${name}s`;
  const path = `/api/${root}`;
  const result = {
    [path]: {
      get: { tags: [tag], summary: `List ${root}`, parameters: options.filters ?? pages, responses: { '200': response(list(resource)), ...commonErrors } },
      post: { tags: [tag], summary: `Create ${name}`, requestBody: jsonBody({ $ref: `#/components/schemas/${name}Input` }), responses: { '201': response(wrapped(resource)), ...commonErrors } }
    },
    [`${path}/{id}`]: {
      get: { tags: [tag], summary: `Get ${name}`, parameters: [idParam()], responses: { '200': response(wrapped(resource)), ...commonErrors } },
      patch: { tags: [tag], summary: `Update ${name}`, parameters: [idParam()], requestBody: jsonBody({ $ref: `#/components/schemas/${name}Patch` }), responses: { '200': response(wrapped(resource)), ...commonErrors } },
      delete: { tags: [tag], summary: `Delete ${name}`, parameters: [idParam()], responses: { '204': { description: 'Deleted, no content' }, ...commonErrors } }
    }
  };
  if (options.noList) { delete result[path].get; delete result[path].post; }
  return result;
}
const eventFilters = [...pages,
  query('municipality', str(120)), query('province', str(120)), query('genre', values(genres)), query('atmosphere', values(atmospheres)), query('eventType', values(eventTypes)),
  query('idealFor', values(ideals)), query('venueId', uuid), query('promoterId', uuid),
  query('dressCode', values(['CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE'])),
  query('status', values(statuses)), query('dateFrom', date), query('dateTo', date), query('minPrice', money), query('maxPrice', money),
  query('minimumAge', integer()), query('search', str(160)),
  query('latitude', { type: 'number', minimum: -90, maximum: 90 }),
  query('longitude', { type: 'number', minimum: -180, maximum: 180 }),
  query('radiusKm', { type: 'number', enum: [2,5,10,25,50] }),
  query('sort', values(['date','price','createdAt','distance']))
];
const ticketRef = { $ref: '#/components/schemas/TicketType' };
const eventRef = { $ref: '#/components/schemas/Event' };
export const swaggerSpec = {
  openapi: '3.0.3',
  info: { title: 'Nocturno API', version: '2.0.0', description: 'Events, management, accounts and ticket commerce. Protected routes use Bearer access tokens; refresh uses an HttpOnly cookie.' },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/health': { get: { tags: ['Health'], summary: 'Process health', responses: { '200': response(object({ status: { type: 'string', enum: ['ok'] } })) } } },
    '/api/openapi.json': { get: { tags: ['Documentation'], summary: 'OpenAPI JSON document', responses: { '200': { description: 'OpenAPI document' } } } },
    '/api/docs': { get: { tags: ['Documentation'], summary: 'Swagger UI', responses: { '200': { description: 'HTML documentation' } } } },
    ...crudPaths('users', 'User', { filters: [...pages, query('search', str(120)), query('role', values(['USER','PROMOTER','ADMIN']))] }),
    ...crudPaths('promoters', 'Promoter'), ...crudPaths('venues', 'Venue'),
    ...crudPaths('events', 'Event', { filters: eventFilters }),
    '/api/venues/slug/{slug}': { get: { tags: ['Venues'], summary: 'Public venue and upcoming events',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: str(200) }],
      responses: { '200': response(wrapped(object({ venue: { $ref: '#/components/schemas/Venue' },
        upcomingEvents: array({ $ref: '#/components/schemas/Event' }), upcomingTotal: integer() }))), ...commonErrors } } },
    '/api/promoters/slug/{slug}': { get: { tags: ['Promoters'], summary: 'Public organizer and upcoming events',
      parameters: [{ name: 'slug', in: 'path', required: true, schema: str(200) }],
      responses: { '200': response(wrapped(object({ promoter: { $ref: '#/components/schemas/Promoter' },
        upcomingEvents: array({ $ref: '#/components/schemas/Event' }), upcomingTotal: integer() }))), ...commonErrors } } },
    '/api/events/slug/{slug}': {
      get: { tags: ['Events'], summary: 'Get a visible published or sold-out event by public slug', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 200 } }], responses: { '200': response(wrapped({ $ref: '#/components/schemas/Event' })), ...commonErrors } }
    },
    '/api/events/{id}/active': {
      patch: { tags: ['Events'], summary: 'Activate or deactivate an event (deleted events cannot be reactivated)', parameters: [idParam()], requestBody: jsonBody({ $ref: '#/components/schemas/EventActiveInput' }), responses: { '200': response(wrapped({ $ref: '#/components/schemas/Event' })), ...commonErrors } }
    },
    '/api/events/{id}/soft-delete': {
      patch: { tags: ['Events'], summary: 'Soft delete an event and keep its relations', parameters: [idParam()], responses: { '200': response(wrapped({ $ref: '#/components/schemas/Event' })), ...commonErrors } }
    },
    '/api/events/{id}/restore': {
      patch: { tags: ['Events'], summary: 'Restore a deleted event as inactive (ADMIN)', parameters: [idParam()], responses: { '200': response(wrapped({ $ref: '#/components/schemas/Event' })), ...commonErrors } }
    },
    '/api/events/{eventId}/attendees': {
      get: {
        tags: ['Tickets'], summary: 'List attendees for a managed event',
        parameters: [idParam('eventId'), ...pages, query('search', str(120))],
        responses: {
          '200': response(list(object({ id: uuid, code: uuid, status: str(), displayName: str(), email: str(), ticketTypeName: str() }))),
          ...commonErrors
        }
      }
    },
    '/api/events/{eventId}/check-in': { get: { tags: ['Tickets'], summary: 'Scoped access-control totals and recent check-ins',
      parameters: [idParam('eventId')], security: [{ bearerAuth: [] }],
      responses: { '200': response(wrapped(object({ eventTitle: str(), capacity: integer(), issued: integer(),
        used: integer(), pending: integer(), rejected: integer(), recent: array({ type: 'object' }) }))), ...commonErrors } } },
    '/api/events/{id}/waitlist': {
      get: { tags: ['Waitlist'], summary: 'My waitlist status', parameters: [idParam()], security: [{ bearerAuth: [] }],
        responses: { '200': response(wrapped(object({ joined: { type: 'boolean' } }))), ...commonErrors } },
      post: { tags: ['Waitlist'], summary: 'Join a sold-out event once per account', parameters: [idParam()], security: [{ bearerAuth: [] }],
        responses: { '201': response(wrapped(object({ joined: { type: 'boolean' }, createdAt: date }))), ...commonErrors } }
    },
    ...crudPaths('ticket-types', 'TicketType', { noList: true }),
    '/api/events/{eventId}/ticket-types': {
      get: { tags: ['Ticket types'], summary: 'List event ticket types', parameters: [idParam('eventId'), ...pages], responses: { '200': response(list(ticketRef)), ...commonErrors } },
      post: { tags: ['Ticket types'], summary: 'Create event ticket type', parameters: [idParam('eventId')], requestBody: jsonBody({ $ref: '#/components/schemas/TicketTypeInput' }), responses: { '201': response(wrapped(ticketRef)), ...commonErrors } }
    },
    '/api/users/{userId}/favorites': {
      get: { tags: ['Favorites'], summary: 'List favorite events', parameters: [idParam('userId'), ...pages], responses: { '200': response(list(eventRef)), ...commonErrors } }
    },
    '/api/users/{userId}/favorites/{eventId}': {
      post: { tags: ['Favorites'], summary: 'Add favorite', parameters: [idParam('userId'), idParam('eventId')], responses: { '201': response(wrapped(object({ userId: uuid, eventId: uuid, createdAt: date }))), ...commonErrors } },
      delete: { tags: ['Favorites'], summary: 'Remove favorite', parameters: [idParam('userId'), idParam('eventId')], responses: { '204': { description: 'Deleted, no content' }, ...commonErrors } }
    }
  },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, refreshCookie: { type: 'apiKey', in: 'cookie', name: 'nocturno_refresh' } }, schemas: {
    Error: error,
    EventActiveInput: object({ isActive: { type: 'boolean' } }, ['isActive']),
    ...Object.fromEntries(Object.entries(bodySchema).flatMap(([name, input]) => [
      [`${name}Input`, input],
      [`${name}Patch`, { ...input, required: [], minProperties: 1 }],
      [name, record(name, name === 'Event' ? { slug: str(200), deletedAt: nullable(date), venueName: str(), venueSlug: str(),
        promoterName: nullable(str()), promoterSlug: nullable(str()), municipality: str(), province: str(),
        venueLatitude: nullable({ type: 'number' }), venueLongitude: nullable({ type: 'number' }),
        distanceKm: nullable({ type: 'number', minimum: 0, description: 'Calculated from request coordinates; never persisted' }),
        posterUrl: nullable({ type: 'string', description: 'Absolute URL or local poster asset' }),
        images: array(object({ id: uuid, url: str(2048), position: integer(), altText: nullable(str(240)), sourceUrl: nullable(url) })),
        minPrice: nullable(money), ticketAvailability: integer() } : name === 'TicketType' ? { eventId: uuid, sold: integer(), reserved: integer() } : name === 'User' ? { role: values(['USER','PROMOTER','ADMIN']), isActive: { type: 'boolean' }, promoterId: nullable(uuid) } : { slug: str(220) })]
    ]))
  } }
};

swaggerSpec.paths['/api/events'].get.description = 'Public listing: active, non-deleted PUBLISHED and SOLD_OUT events. Without status both are included; an explicit status narrows the public list. Inactive and deleted events are excluded. Latitude and longitude must be sent together; radiusKm and sort=distance require coordinates. Distance is calculated per request and is not stored.';
swaggerSpec.paths['/api/events/{id}'].get.description = 'UUID lookup for internal editing and future dashboard/CRM use; it can return inactive or soft-deleted events.';
swaggerSpec.paths['/api/events/{id}'].delete.summary = 'Legacy soft-delete alias (no physical deletion)';
swaggerSpec.paths['/api/events/{id}'].patch.description = 'General event fields, including status and isActive. Editing title regenerates the slug with collision handling.';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const secured = (operation) => ({ ...operation, security: [{ bearerAuth: [] }] });
const simple = (tag, summary, schema = { type: 'object' }) =>
  secured({ tags: [tag], summary, responses: { '200': response(wrapped(schema)), ...commonErrors } });
const paged = (tag, summary, schema, parameters = pages) =>
  secured({ tags: [tag], summary, parameters,
    responses: { '200': response(list(schema)), ...commonErrors } });
const post = (tag, summary, schema, output = { type: 'object' }) =>
  secured({ tags: [tag], summary, requestBody: jsonBody(schema),
    responses: { '200': response(wrapped(output)), ...commonErrors } });

Object.assign(swaggerSpec.components.schemas, {
  UserInput: object({ ...bodySchema.User.properties, password: str(),
    role: values(['USER','PROMOTER','ADMIN']), promoterId: nullable(uuid) },
  ['email','displayName','password']),
  UserPatch: object({ email: { type: 'string', format: 'email' }, displayName: str(120),
    role: values(['USER','PROMOTER','ADMIN']), promoterId: nullable(uuid), isActive: { type: 'boolean' } }),
  AuthSession: object({ user: ref('User'), accessToken: str() }, ['user','accessToken']),
  Cart: object({ id: uuid, items: array(object({ id: uuid, ticketTypeId: uuid, quantity: integer(1),
    unitPriceCents: integer(), eventTitle: str(), name: str() })), totalCents: integer() }, ['id','items','totalCents']),
  Order: object({ id: uuid, userId: uuid, status: str(), totalCents: integer(),
    currency: str(), expiresAt: date, createdAt: date, buyerName: str(), buyerEmail: str(),
    paymentStatus: nullable(str()), eventTitles: str(), itemCount: integer(),
    items: array(object({ id: uuid, eventId: uuid, ticketTypeId: uuid, name: str(), quantity: integer(1),
      eventTitle: str(), venueName: str(), startsAt: date,
      unitPriceCents: integer(), subtotalCents: integer() })), tickets: array(object({ id: uuid, code: uuid, status: str() })) }),
  Payment: object({ id: uuid, orderId: uuid, provider: str(), providerPaymentId: str(),
    status: str(), amountCents: integer(), currency: str(), createdAt: date,
    refundRequestedAt: nullable(date), providerRefundId: nullable(str()), buyerName: str() }),
  Ticket: object({ id: uuid, code: uuid, status: str(), eventId: uuid, eventTitle: str(),
    ticketTypeName: str(), issuedAt: date, usedAt: nullable(date) }),
  DashboardSummary: object({ events: integer(), upcomingEvents: integer(), ticketsSold: integer(),
    occupancyPercent: { type: 'number' }, revenueCents: integer(), orders: integer(),
    revenuePeriodCents: integer(), activeEvents: integer(), soldOutEvents: integer(),
    attendees: integer(), averageTicketCents: integer(), sales24h: integer(), sales7d: integer(), sales30d: integer(),
    topEvents: array({ type: 'object' }), salesTrend: array({ type: 'object' }),
    users: nullable(integer()), promoters: nullable(integer()), lowStock: array(object({
      id: uuid, name: str(), eventTitle: str(), available: integer() })),
    recentSales: array(object({ id: uuid, eventTitle: str(), quantity: integer(), subtotalCents: integer(), buyerName: str() })) })
});

Object.assign(swaggerSpec.paths, {
  '/api/config/events': { get: { tags: ['Events'], summary: 'Public gallery limits',
    responses: { '200': response(wrapped(object({ maxImages: integer(1) }, ['maxImages']))) } } },
  '/api/config/payments': { get: { tags: ['Payments'], summary: 'Public Stripe configuration',
    responses: { '200': response(wrapped(object({ enabled: { type: 'boolean' }, publishableKey: nullable(str()) }))) } } },
  '/api/auth/register': { post: { tags: ['Auth'], summary: 'Register USER and set refresh cookie',
    requestBody: jsonBody(object({ email: { type: 'string', format: 'email' }, password: str(), displayName: str(120) }, ['email','password','displayName'])),
    responses: { '201': response(wrapped(ref('AuthSession'))), ...commonErrors } } },
  '/api/auth/login': { post: { tags: ['Auth'], summary: 'Log in and set refresh cookie',
    requestBody: jsonBody(object({ email: { type: 'string', format: 'email' }, password: str() }, ['email','password'])),
    responses: { '200': response(wrapped(ref('AuthSession'))), ...commonErrors } } },
  '/api/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh cookie and return new access JWT',
    security: [{ refreshCookie: [] }], responses: { '200': response(wrapped(ref('AuthSession'))), ...commonErrors } } },
  '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke refresh session', security: [{ refreshCookie: [] }],
    responses: { '204': { description: 'Logged out' }, ...commonErrors } } },
  '/api/auth/me': { get: simple('Auth', 'Current user', ref('User')),
    patch: post('Auth', 'Update display name', object({ displayName: str(120) }, ['displayName']), ref('User')) },
  '/api/me/favorites': { get: paged('Favorites', 'My favorite events', eventRef) },
  '/api/me/favorites/{eventId}': {
    post: secured({ tags: ['Favorites'], summary: 'Add my favorite', parameters: [idParam('eventId')],
      responses: { '201': response(wrapped(object({ userId: uuid, eventId: uuid, createdAt: date }))), ...commonErrors } }),
    delete: secured({ tags: ['Favorites'], summary: 'Remove my favorite', parameters: [idParam('eventId')],
      responses: { '204': { description: 'Removed' }, ...commonErrors } })
  },
  '/api/cart': { get: simple('Cart', 'Get my cart', ref('Cart')) },
  '/api/cart/items': {
    post: post('Cart', 'Add ticket type to cart', object({ ticketTypeId: uuid, quantity: integer(1) }, ['ticketTypeId','quantity']), ref('Cart')),
    delete: secured({ tags: ['Cart'], summary: 'Empty cart', responses: { '200': response(wrapped(ref('Cart'))), ...commonErrors } })
  },
  '/api/cart/items/{id}': {
    patch: { ...post('Cart', 'Change item quantity', object({ quantity: integer(1) }, ['quantity']), ref('Cart')), parameters: [idParam()] },
    delete: secured({ tags: ['Cart'], summary: 'Remove cart item', parameters: [idParam()],
      responses: { '200': response(wrapped(ref('Cart'))), ...commonErrors } })
  },
  '/api/checkout': { post: secured({ tags: ['Checkout'], summary: 'Reserve stock and create/reuse order; paid orders create Stripe PaymentIntent',
    parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: uuid }],
    responses: { '200': response(wrapped(object({ order: ref('Order'), clientSecret: nullable(str()) }))), ...commonErrors } }) },
  '/api/orders': { get: paged('Orders', 'My orders; all orders for ADMIN', ref('Order'),
    [...pages, query('search', str(120)), query('status', values(['AWAITING_PAYMENT','PAID','CANCELLED','EXPIRED','REFUNDED'])),
      query('eventId', uuid), query('dateFrom', date), query('dateTo', date)]) },
  '/api/orders/{id}': { get: { ...simple('Orders', 'My order; any order for ADMIN', ref('Order')), parameters: [idParam()] } },
  '/api/payments': { get: paged('Payments', 'List payments (ADMIN)', ref('Payment'),
    [...pages, query('search', str(120)), query('status', values(['PENDING','PAID','FAILED','REFUNDED'])),
      query('dateFrom', date), query('dateTo', date)]) },
  '/api/payments/{id}/refund': { post: secured({ tags: ['Payments'], summary: 'Request an idempotent full Stripe refund (ADMIN)',
    parameters: [idParam()], responses: { '202': response(wrapped(object({ status: str(), providerRefundId: str() }))), ...commonErrors } }) },
  '/api/tickets': { get: paged('Tickets', 'My tickets', ref('Ticket')) },
  '/api/tickets/admin/all': { get: paged('Tickets', 'All issued tickets (ADMIN)', ref('Ticket'),
    [...pages, query('search', str(120)), query('status', values(['VALID','USED','CANCELLED','REFUNDED']))]) },
  '/api/tickets/{id}': { get: { ...simple('Tickets', 'My ticket', ref('Ticket')), parameters: [idParam()] } },
  '/api/tickets/{code}/check-in': { post: { ...post('Tickets', 'Check in ticket (event promoter or ADMIN)',
    object({ eventId: uuid }, ['eventId']), ref('Ticket')), parameters: [idParam('code')] } },
  '/api/dashboard': { get: simple('Dashboard', 'Scoped management metrics', ref('DashboardSummary')) },
  '/api/dashboard/top-events': { get: { ...simple('Dashboard', 'Top events for current manager', array({ type: 'object' })),
    parameters: [query('sort', values(['revenue','tickets','date']))] } },
  '/api/dashboard/events': { get: paged('Dashboard', 'Managed events; deleted=only is ADMIN only', eventRef,
    [...pages, query('search', str(160)), query('status', values(statuses)),
      query('deleted', values(['exclude','only'])), query('active', values(['all','true','false'])),
      query('promoterId', uuid), query('venueId', uuid), query('municipality', str(120)),
      query('dateFrom', date), query('dateTo', date)]) },
  '/api/dashboard/sales': { get: paged('Dashboard', 'Scoped paid sales', object({ id: uuid,
    orderId: uuid, eventId: uuid, eventTitle: str(), ticketTypeName: str(), quantity: integer(1),
    subtotalCents: integer(), buyerName: str() }), [...pages, query('eventId', uuid), query('search', str(160))]) },
  '/api/stripe/webhook': { post: { tags: ['Payments'], summary: 'Stripe signed webhook (success, failure, full refund; idempotent)',
    parameters: [{ name: 'Stripe-Signature', in: 'header', required: true, schema: str() }],
    responses: { '200': { description: 'Processed or already processed' }, ...commonErrors } } }
});

for (const [path, methods] of Object.entries(swaggerSpec.paths)) {
  if (path.startsWith('/api/auth') || path.startsWith('/api/me') || path.startsWith('/api/cart') ||
      path.startsWith('/api/checkout') || path.startsWith('/api/orders') ||
      path.startsWith('/api/payments') || path.startsWith('/api/tickets') ||
      path.startsWith('/api/dashboard') || path.startsWith('/api/users/') || path === '/api/users' ||
      path.startsWith('/api/ticket-types')) {
    for (const operation of Object.values(methods)) {
      if (!operation.security && path !== '/api/auth/register' && path !== '/api/auth/login' &&
          path !== '/api/stripe/webhook') operation.security = [{ bearerAuth: [] }];
    }
  }
  if (path === '/api/events' || path.startsWith('/api/events/{id}') || path.startsWith('/api/events/{eventId}')) {
    for (const [method, operation] of Object.entries(methods)) {
      if (method !== 'get' || path === '/api/events/{id}' || path === '/api/events/{eventId}/attendees')
        operation.security = [{ bearerAuth: [] }];
    }
  }
  if (path === '/api/venues' || path.startsWith('/api/venues/') ||
      path === '/api/promoters' || path.startsWith('/api/promoters/')) {
    for (const [method, operation] of Object.entries(methods))
      if (method !== 'get') operation.security = [{ bearerAuth: [] }];
  }
}

swaggerSpec.paths['/api/yomogan/chat']={post:{
  tags:['Yomogan'],summary:'Public event recommendations with explicit search fallback when AI is unavailable',
  requestBody:{required:true,content:{'application/json':{schema:{
    type:'object',additionalProperties:false,required:['messages'],properties:{
      messages:{type:'array',minItems:1,maxItems:11,items:{type:'object',additionalProperties:false,
        required:['role','content'],properties:{role:{type:'string',enum:['user','assistant']},
          content:{type:'string',minLength:1,maxLength:1200}}}}
    }
  }}}},
  responses:{'200':{description:'Mode (assistant/search/clarification), message, question, verified event references, applied filters, retrieval method and DEMO disclaimer'},
    '400':{description:'Invalid conversation'},'429':{description:'Usage limit; Retry-After header'},'503':{description:'Catalogue unavailable'}}
}};

swaggerSpec.paths['/api/yomogan/config']={get:{tags:['Yomogan'],summary:'Public avatar asset path, never provider credentials',
  responses:{'200':{description:'Configured avatarUrl or null if the official photograph is unavailable'}}}};

swaggerSpec.components.schemas.EventDeletionImpact = object({
  eventId: uuid, title: str(180), analysisToken: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  operation: values(['delete', 'archive', 'blocked']), recoverable: { type: 'boolean' },
  relations: array(object({ key: str(), label: str(), count: integer(),
    action: values(['delete', 'deactivate', 'preserve', 'block']), reason: str() })),
  blockers: array(str()), warnings: array(str()),
});
swaggerSpec.paths['/api/events/{id}/deletion-impact'] = { get: secured({
  tags: ['Events'], summary: 'Read-only dependency preview (ADMIN or owning PROMOTER)',
  parameters: [idParam()], responses: {
    '200': response(wrapped(ref('EventDeletionImpact'))), ...commonErrors,
  },
}) };
swaggerSpec.paths['/api/events/{id}/deletion'] = { post: secured({
  tags: ['Events'], summary: 'Confirm current impact atomically; preserve commercial history; replay requestId safely',
  parameters: [idParam()], requestBody: jsonBody(object({
    analysisToken: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    operation: values(['delete', 'archive']), requestId: uuid,
  }, ['analysisToken', 'operation', 'requestId'])),
  responses: { '200': response(wrapped(object({ eventId: uuid,
    operation: values(['delete', 'archive']), replayed: { type: 'boolean' } }))),
    ...commonErrors, '409': { description: 'IMPACT_STALE, EVENT_DELETION_BLOCKED or requestId conflict: refresh preview' } },
}) };

// Profile owns both canonical endpoints and the legacy Auth URL.
swaggerSpec.paths['/api/profile/me'] = {
  get: simple('Profile', 'Get my authenticated profile', ref('User')),
  patch: post('Profile', 'Update only my display name',
    object({ displayName: str(120) }, ['displayName']), ref('User')),
};
for (const operation of Object.values(swaggerSpec.paths['/api/profile/me']))
  operation.security = [{ bearerAuth: [] }];
for (const operation of Object.values(swaggerSpec.paths['/api/auth/me'])) {
  operation.tags = ['Profile'];
  operation.deprecated = true;
  operation.description = 'Compatibility alias of /api/profile/me; delegated to Profile.';
}
