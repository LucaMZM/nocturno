import { crudController } from './crud.controller.js';
import { userService } from '../services/user.service.js';
export const userController = crudController(userService);
