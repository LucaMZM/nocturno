export function slugFromText(value, fallback = 'item') {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 185).replace(/-$/g, '');
  return slug || fallback;
}
