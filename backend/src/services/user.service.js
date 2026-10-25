import { AppError } from '../utils/AppError.js';
import { entityRemovalRepository } from '../repositories/entity-removal.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { crudService } from './crud.service.js';
import { hashPassword } from '../utils/password.js';
const base = crudService(userRepository, 'USER');
export const userService = { ...base,
  async remove(id) {
    const result = await entityRemovalRepository.removeUser(id);
    if (!result.found) throw new AppError(404, 'USER_NOT_FOUND', 'Resource not found');
    if (!result.deleted) throw new AppError(409, 'USER_HAS_DEPENDENCIES', 'No se puede eliminar: existen relaciones que deben conservarse.', {
      dependencies: result.dependencies,
      recommendation: 'Desactiva el usuario mediante isActive=false para conservar sus pedidos y entradas.'
    });
  },
  async create({ password, ...data }) {
    return base.create({ ...data, email: data.email.toLowerCase(), passwordHash: await hashPassword(password) });
  },
  update: (id, data) => base.update(id, data.email ? { ...data, email: data.email.toLowerCase() } : data)
};
