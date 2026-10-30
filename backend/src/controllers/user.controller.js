import { crudController } from './crud.controller.js';
import { userService } from '../services/user.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const base = crudController(userService);
export const userController = {
  ...base,
  update: asyncHandler(async (req, res) => res.json({
    data: await userService.update(req.params.id, req.validated.body, req.user)
  })),
  remove: asyncHandler(async (req, res) => {
    await userService.remove(req.params.id, req.user);
    res.status(204).end();
  })
};
