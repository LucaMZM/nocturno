import { userRepository } from '../repositories/user.repository.js';
import { crudService } from './crud.service.js';
import { hashPassword } from '../utils/password.js';
const base = crudService(userRepository, 'USER');
export const userService = { ...base,
  async create({ password, ...data }) {
    return base.create({ ...data, email: data.email.toLowerCase(), passwordHash: await hashPassword(password) });
  },
  update: (id, data) => base.update(id, data.email ? { ...data, email: data.email.toLowerCase() } : data)
};
