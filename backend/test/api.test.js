import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';
import { swaggerSpec } from '../src/config/swagger.js';
import { buildEventListQuery } from '../src/repositories/event.repository.js';
import { errorMiddleware } from '../src/middlewares/error.middleware.js';
import { notFoundMiddleware } from '../src/middlewares/not-found.middleware.js';
import { AppError } from '../src/utils/AppError.js';
import { userCreate } from '../src/validators/user.validator.js';
import { userRoutes } from '../src/routes/user.routes.js';
import { promoterRoutes } from '../src/routes/promoter.routes.js';
import { venueRoutes } from '../src/routes/venue.routes.js';
import { eventRoutes } from '../src/routes/event.routes.js';
import { ticketTypeRoutes } from '../src/routes/ticket-type.routes.js';
import { favoriteRoutes, myFavoriteRoutes } from '../src/routes/favorite.routes.js';
import { yomoganRoutes } from '../src/routes/yomogan.routes.js';
import { profileRoutes } from '../src/routes/profile.routes.js';
import { authRoutes } from '../src/routes/auth.routes.js';
import { cartRoutes } from '../src/routes/cart.routes.js';
import { checkoutRoutes, orderRoutes } from '../src/routes/checkout.routes.js';
import { paymentRoutes } from '../src/routes/payment.routes.js';
import { ticketRoutes } from '../src/routes/ticket.routes.js';
import { dashboardRoutes } from '../src/routes/dashboard.routes.js';
import { listMigrationFiles } from '../src/db/migrate.js';
import { safeRequestPath } from '../src/config/logging.js';
import { eventQuery } from '../src/validators/event.validator.js';

test('combined event filters bind user values and preserve safe sort allowlist', () => {
  const query = buildEventListQuery({ page: 2, limit: 10, sort: 'price', municipality: 'Valencia', genre: 'TECHNO', status: 'PUBLISHED', minPrice: 15, search: "x' OR 1=1--" });
  assert.match(query.sql, /e\.is_active = TRUE AND e\.deleted_at IS NULL/);
  assert.match(query.sql, /e\.status = \$3/);
  assert.match(query.sql, /v\.municipality ILIKE \$1/);
  assert.match(query.sql, /\$2 = ANY\(e\.music_genres\)/);
  assert.match(query.sql, /tickets\.min_price >= \$4/);
  assert.match(query.sql, /ORDER BY tickets\.min_price ASC/);
  assert.ok(!query.sql.includes("x' OR"));
  assert.equal(query.values.at(-1), 10);
  assert.equal(query.filterValues.length, 5);
  assert.equal(query.filterValues[2], 'PUBLISHED');
});

test('geographic filters require a coordinate pair and use bound SQL values', () => {
  const base = { page: 1, limit: 12, municipality: 'Valencia', genre: 'TECHNO',
    maxPrice: 20, latitude: 39.47, longitude: -0.37, radiusKm: 10, sort: 'distance' };
  assert.equal(eventQuery.safeParse(base).success, true);
  for (const invalid of [
    { ...base, longitude: undefined }, { ...base, radiusKm: 100 },
    { ...base, latitude: 91 }, { ...base, latitude: undefined, longitude: undefined },
  ]) assert.equal(eventQuery.safeParse(invalid).success, false);
  const query = buildEventListQuery(base);
  assert.match(query.sql, /geo\.distance_km <= \$\d+/);
  assert.match(query.sql, /ORDER BY geo\.distance_km ASC NULLS LAST/);
  assert.deepEqual(query.values.slice(0, 2), [39.47, -0.37]);
  assert.ok(query.filterValues.includes(10));
});

test('health route is registered and errors use the standard envelope', () => {
  const healthLayer = app.router.stack.find((layer) => layer.route?.path === '/health');
  assert.ok(healthLayer);
  const healthResponse = { json(value) { this.body = value; } };
  healthLayer.route.stack[0].handle({}, healthResponse);
  assert.deepEqual(healthResponse.body, { status: 'ok' });
  let error;
  notFoundMiddleware({}, {}, (value) => { error = value; });
  assert.equal(error.code, 'NOT_FOUND');
  const res = { status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  errorMiddleware(new AppError(400, 'INVALID_ID', 'Invalid id'), {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: { code: 'INVALID_ID', message: 'Invalid id', details: null } });
  errorMiddleware(userCreate.safeParse({}).error, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.details.length > 0);
  errorMiddleware({ code: 'ECONNREFUSED', message: 'private host' }, {}, res, () => {});
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.code, 'DATABASE_UNAVAILABLE');
  assert.ok(!JSON.stringify(res.body).includes('private host'));
  errorMiddleware(new Error('private stack'), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
});

test('OpenAPI documents every registered resource method', () => {
  for (const [prefix, router] of [
    ['/api/users', userRoutes], ['/api/users', favoriteRoutes], ['/api/promoters', promoterRoutes],
    ['/api/venues', venueRoutes], ['/api/events', eventRoutes], ['/api/ticket-types', ticketTypeRoutes],
    ['/api/me', myFavoriteRoutes], ['/api/auth', authRoutes], ['/api/profile', profileRoutes], ['/api/auth', profileRoutes], ['/api/cart', cartRoutes],
    ['/api/yomogan', yomoganRoutes], ['/api/checkout', checkoutRoutes], ['/api/orders', orderRoutes],
    ['/api/payments', paymentRoutes], ['/api/tickets', ticketRoutes], ['/api/dashboard', dashboardRoutes]
  ]) {
    for (const layer of router.stack) {
      if (!layer.route) continue;
      const suffix = layer.route.path === '/' ? '' : layer.route.path.replace(/:([A-Za-z]+)/g, '{$1}');
      const path = `${prefix}${suffix}`;
      for (const method of Object.keys(layer.route.methods)) assert.ok(swaggerSpec.paths[path]?.[method], `${method.toUpperCase()} ${path}`);
    }
  }
});

test('migration runner discovers the initial SQL migration', async () => {
  assert.deepEqual(await listMigrationFiles(), ['001_initial_schema.sql', '002_event_lifecycle.sql', '003_identity_commerce.sql', '004_venue_postal_code.sql', '005_event_soft_delete_invariant.sql', '006_portfolio_domain.sql', '007_event_sources.sql', '008_demo_catalogue_provenance.sql', '009_event_images.sql', '010_event_gallery_user_edits.sql', '011_yomogan_embeddings.sql', '012_integrity_constraints.sql', '013_event_deletion_audit.sql']);
});

test('event routes keep slug lookup separate from UUID and document lifecycle operations', () => {
  const paths = eventRoutes.stack.map((layer) => layer.route?.path).filter(Boolean);
  assert.ok(paths.indexOf('/slug/:slug') < paths.indexOf('/:id'));
  for (const path of ['/api/events/slug/{slug}', '/api/events/{id}/active', '/api/events/{id}/soft-delete', '/api/events/{id}/restore'])
    assert.ok(swaggerSpec.paths[path]?.get || swaggerSpec.paths[path]?.patch);
  assert.ok(!swaggerSpec.paths['/api/events/{id}/status']);
});

test('Helmet denies framing while health and Swagger UI remain available', async () => {
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    for (const path of ['/health', '/api/docs/']) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      const csp = response.headers.get('content-security-policy');
      assert.match(csp, /default-src 'self'/);
      if (path.startsWith('/api/docs')) {
        assert.match(csp, /script-src 'self' 'unsafe-inline'/);
        assert.match(await response.text(), /swagger-ui/);
      } else assert.doesNotMatch(csp, /script-src 'self' 'unsafe-inline'/);
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('access logs omit ticket check-in codes and query parameters', () => {
  const code = '9b25c18a-b7be-4642-bdfb-8dbff90f9731';
  assert.equal(safeRequestPath(`/api/tickets/${code}/check-in?token=private`),
    '/api/tickets/[redacted]/check-in');
  assert.equal(safeRequestPath('/api/events?search=private'), '/api/events');
});
