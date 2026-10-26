import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import helmet from 'helmet';
import { env, frontendOrigins } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { userRoutes } from './routes/user.routes.js';
import { promoterRoutes } from './routes/promoter.routes.js';
import { venueRoutes } from './routes/venue.routes.js';
import { eventRoutes } from './routes/event.routes.js';
import { ticketTypeRoutes } from './routes/ticket-type.routes.js';
import { favoriteRoutes, myFavoriteRoutes } from './routes/favorite.routes.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { requestLoggers } from './config/logging.js';
import { profileRoutes } from './routes/profile.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { cartRoutes } from './routes/cart.routes.js';
import { checkoutRoutes, orderRoutes } from './routes/checkout.routes.js';
import { stripeController } from './controllers/stripe.controller.js';
import { paymentRoutes } from './routes/payment.routes.js';
import { ticketRoutes } from './routes/ticket.routes.js';
import { yomoganRoutes } from './routes/yomogan.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';

export const app = express();
app.disable('x-powered-by');
// Swagger UI serves inline bootstrapping code; keep that exception scoped to its own route.
const standardHelmet = helmet({ frameguard: { action: 'deny' } });
const swaggerHelmet = helmet({ frameguard: { action: 'deny' }, contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
  }
} });
app.use((req, res, next) => (req.path.startsWith('/api/docs') ? swaggerHelmet : standardHelmet)(req, res, next));
app.use(requestLoggers);
app.use(cors({ origin: frontendOrigins(), credentials: true }));
app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeController.webhook);
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/config/payments', (_req, res) => res.json({ data: {
  publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
  enabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY && env.STRIPE_WEBHOOK_SECRET
    && (env.NODE_ENV === 'production' || (env.STRIPE_SECRET_KEY.startsWith('sk_test_')
      && env.STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_')))),
  testMode: Boolean(env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
    && env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_'))
} }));
app.get('/api/config/events', (_req, res) => res.json({ data: {
  maxImages: env.EVENT_GALLERY_MAX_IMAGES
} }));
app.get('/api/openapi.json', (_req, res) => res.json(swaggerSpec));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/yomogan',yomoganRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
// Compatibility alias: both URLs delegate to Profile, never to Auth logic.
app.use('/api/auth', profileRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', favoriteRoutes);
app.use('/api/users', userRoutes);
app.use('/api/me', myFavoriteRoutes);
app.use('/api/promoters', promoterRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ticket-types', ticketTypeRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
