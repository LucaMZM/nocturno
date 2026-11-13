import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../validators/common.js';
import { catalogContextController } from '../controllers/catalog-context.controller.js';
import { preferenceSchema } from '../../ai/validators/yomogan.validator.js';
export const catalogContextRoutes = Router();
const input=z.object({
  filters:preferenceSchema.partial().extend({
    dateFrom:z.iso.datetime({offset:true}).optional(),
    dateTo:z.iso.datetime({offset:true}).optional(),
  }),
  query:z.string().max(1200),
  ids:z.array(z.uuid()).max(100).nullable(),
}).strict();
catalogContextRoutes.get('/locations',catalogContextController.locations);
catalogContextRoutes.post('/events',validate(input),catalogContextController.events);
