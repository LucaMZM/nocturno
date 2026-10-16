export function toCamel(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()), value]));
}
export const toCamelRows = (rows) => rows.map(toCamel);
