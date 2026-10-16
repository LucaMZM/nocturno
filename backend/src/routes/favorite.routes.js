import { Router } from 'express';
import { favoriteController as c, myFavoriteController as mine } from '../controllers/favorite.controller.js';
import { validate, validateId, listQuery } from '../validators/common.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireOwnOrAdmin } from '../middlewares/ownership.middleware.js';
export const favoriteRoutes = Router();
favoriteRoutes.use('/:userId', requireAuth, validateId('userId'), requireOwnOrAdmin());
favoriteRoutes.get('/:userId/favorites', validate(listQuery, 'query'), c.list);
favoriteRoutes.post('/:userId/favorites/:eventId', validateId('eventId'), c.add);
favoriteRoutes.delete('/:userId/favorites/:eventId', validateId('eventId'), c.remove);

export const myFavoriteRoutes = Router();
myFavoriteRoutes.use(requireAuth);
myFavoriteRoutes.get('/favorites', validate(listQuery, 'query'), mine.list);
myFavoriteRoutes.post('/favorites/:eventId', validateId('eventId'), mine.add);
myFavoriteRoutes.delete('/favorites/:eventId', validateId('eventId'), mine.remove);
