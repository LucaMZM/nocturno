import { getPool } from '../config/db.js';
export function buildRecommendationQuery(filters = {}, query = '', ids = null) {
  const values = [query.slice(-1200), filters.groupSize ?? 1, filters.maxPrice ?? null];
  const where = [
    'e.deleted_at IS NULL',
    'e.is_active=TRUE',
    "e.status='PUBLISHED'",
    'e.ends_at>NOW()',
    'tickets.available>=1',
  ];
  const add = (sql, value) => {
    values.push(value);
    where.push(sql.replaceAll('?', '$' + values.length));
  };
  if (filters.municipality) add('lower(v.municipality)=lower(?)', filters.municipality);
  if (filters.province) add('lower(v.province)=lower(?)', filters.province);
  if (filters.excludedGenres?.length)
    add('NOT (e.music_genres && ?::text[])', filters.excludedGenres);
  if (filters.genre) add('?=ANY(e.music_genres)', filters.genre);
  if (filters.atmosphere) add('?=ANY(e.atmosphere)', filters.atmosphere);
  if (filters.idealFor) add('?=ANY(e.ideal_for)', filters.idealFor);
  if (filters.eventType) add('e.event_type=?', filters.eventType);
  if (filters.dressCode) add('e.dress_code=?', filters.dressCode);
  if (filters.age != null) add('coalesce(e.minimum_age,v.minimum_age,0)<=?', filters.age);
  if (filters.dateFrom) add('e.starts_at>=?::timestamptz', filters.dateFrom);
  if (filters.dateTo) add('e.starts_at<?::timestamptz', filters.dateTo);
  if (ids) add('e.id=ANY(?::uuid[])', ids);
  const sql =
    'SELECT e.id,e.slug,e.title,e.description,e.event_type,e.music_genres,e.atmosphere,e.ideal_for,' +
    'e.dress_code,coalesce(e.minimum_age,v.minimum_age) AS minimum_age,e.starts_at,e.ends_at,e.is_demo,e.poster_url,' +
    'v.name AS venue_name,v.municipality,v.province,v.address,tickets.min_price,tickets.available,' +
    "ts_rank_cd(to_tsvector('spanish',concat_ws(' ',e.title,e.description,v.name,array_to_string(e.music_genres,' ')))," +
    "plainto_tsquery('spanish',$1)) AS text_rank " +
    'FROM events e JOIN venues v ON v.id=e.venue_id JOIN LATERAL (' +
    'SELECT min(t.price) AS min_price,sum(t.quantity-t.sold-t.reserved)::int AS available ' +
    'FROM ticket_types t WHERE t.event_id=e.id AND t.active=TRUE AND t.quantity-t.sold-t.reserved>=$2 ' +
    'AND (t.max_per_user IS NULL OR t.max_per_user>=$2) ' +
    'AND (t.sales_start IS NULL OR t.sales_start<=NOW()) AND (t.sales_end IS NULL OR t.sales_end>NOW()) ' +
    'AND ($3::numeric IS NULL OR t.price ' +
    (filters.exclusivePrice ? '<' : '<=') +
    ' $3)) tickets ON TRUE ' +
    'WHERE ' +
    where.join(' AND ') +
    ' ORDER BY text_rank DESC,e.starts_at,e.id LIMIT 100';
  return { sql, values };
}
export const yomoganRepository = {
  async candidates(filters = {}, query = '', ids = null) {
    const { sql, values } = buildRecommendationQuery(filters, query, ids);
    return (await getPool().query(sql, values)).rows.map((r) => ({
      ...r,
      min_price: Number(r.min_price),
      available: Number(r.available),
    }));
  },
  async locations() {
    return (
      await getPool().query(
        'SELECT DISTINCT v.municipality,v.province FROM venues v JOIN events e ON e.venue_id=v.id ' +
          "WHERE e.deleted_at IS NULL AND e.is_active=TRUE AND e.status='PUBLISHED' AND e.ends_at>NOW()",
      )
    ).rows;
  },
  async cached(ids, key) {
    if (!ids.length) return [];
    return (
      await getPool().query(
        'SELECT event_id,document_hash,embedding FROM yomogan_embeddings WHERE event_id=ANY($1::uuid[]) AND model_key=$2',
        [ids, key],
      )
    ).rows;
  },
  async cache(id, key, hash, embedding) {
    await getPool().query(
      "WITH eligible AS MATERIALIZED (SELECT id FROM events WHERE id=$1 AND deleted_at IS NULL AND is_active=TRUE AND status='PUBLISHED' AND ends_at>NOW() FOR SHARE) " +
      'INSERT INTO yomogan_embeddings(event_id,model_key,document_hash,embedding) SELECT id,$2,$3,$4::jsonb FROM eligible ' +
        'ON CONFLICT(event_id,model_key) DO UPDATE SET document_hash=EXCLUDED.document_hash,embedding=EXCLUDED.embedding,indexed_at=NOW()',
      [id, key, hash, JSON.stringify(embedding)],
    );
  },
};
