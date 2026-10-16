export const pagination = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
