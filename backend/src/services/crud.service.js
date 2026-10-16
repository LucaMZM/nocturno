import { AppError } from '../utils/AppError.js';

export function crudService(repository, label) {
  const code = `${label}_NOT_FOUND`;
  const get = async (id) => {
    const item = await repository.findById(id);
    if (!item) throw new AppError(404, code, `${label.replaceAll('_', ' ').toLowerCase()} not found`);
    return item;
  };
  return {
    get, list: (query) => repository.list(query), create: (data) => repository.create(data),
    async update(id, data) {
      await get(id);
      const updated = await repository.update(id, data);
      if (!updated) throw new AppError(404, code, `${label.replaceAll('_', ' ').toLowerCase()} not found`);
      return updated;
    },
    async remove(id) {
      await get(id);
      if (!await repository.remove(id)) throw new AppError(404, code, `${label.replaceAll('_', ' ').toLowerCase()} not found`);
    }
  };
}
