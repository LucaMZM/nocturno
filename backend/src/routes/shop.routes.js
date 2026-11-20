import { eventViewsController } from '../controllers/event-views.controller.js';
import { Router } from 'express';
import { shopController } from '../controllers/shop.controller.js';
import { validate } from '../validators/common.js';
import { eventQuery, eventSlug } from '../validators/event.validator.js';

export const shopRoutes = Router();
shopRoutes.get('/categories', shopController.categories);
shopRoutes.get('/hosts', shopController.hosts);
shopRoutes.get('/locations', shopController.locations);
shopRoutes.get('/events', validate(eventQuery, 'query'), shopController.events);
shopRoutes.get('/events/:slug/variants', validate(eventSlug, 'params'), shopController.variants);
shopRoutes.get('/events/:slug', validate(eventSlug, 'params'), shopController.detail);

shopRoutes.post('/events/:slug/view', validate(eventSlug, 'params'), eventViewsController.record);
