import { AppError } from '../utils/AppError.js';
import { entityRemovalRepository } from '../repositories/entity-removal.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { crudService } from './crud.service.js';
import { hashPassword } from '../utils/password.js';
const base = crudService(userRepository, 'USER');
export const userService = { ...base,
  async remove(id, actor) {
    if (id === actor?.id) throw new AppError(409, 'SELF_DELETE', 'No puedes eliminar tu propia cuenta');
    const current = await base.get(id);
    if (current.role === 'ADMIN') throw new AppError(409, 'ADMIN_DELETE_BLOCKED', 'Desactiva o cambia el rol antes de eliminar a un administrador');
    const result = await entityRemovalRepository.removeUser(id);
    if (!result.found) throw new AppError(404, 'USER_NOT_FOUND', 'Resource not found');
    if (!result.deleted) throw new AppError(409, 'USER_HAS_DEPENDENCIES', 'No se puede eliminar: existen relaciones que deben conservarse.', {
      dependencies: result.dependencies, recommendation: 'Desactiva el usuario para conservar sus pedidos y entradas.'
    });
  },
  async create({ password, ...data }) {
    if (data.role === 'PROMOTER' && !data.promoterId)
      throw new AppError(422, 'PROMOTER_REQUIRED', 'Selecciona un promotor');
    return base.create({ ...data, promoterId: data.role === 'PROMOTER' ? data.promoterId : null,
      email: data.email.toLowerCase(), passwordHash: await hashPassword(password) });
  },
  async update(id, data, actor) {
    const result = await userRepository.updateManaged(id, data, actor?.id);
    if (!result) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    return result;
  }
};
