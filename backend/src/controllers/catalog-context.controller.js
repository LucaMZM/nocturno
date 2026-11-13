import { asyncHandler } from '../utils/asyncHandler.js';
import { catalogContextService } from '../services/catalog-context.service.js';
export const catalogContextController = {
  locations: asyncHandler(async(_req,res)=>res.json({data:await catalogContextService.locations()})),
  events: asyncHandler(async(req,res)=>res.json({data:await catalogContextService.events(req.validated.body)})),
};
