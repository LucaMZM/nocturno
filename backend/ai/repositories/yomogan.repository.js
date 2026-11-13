import { env } from '../config/env.js';
import { AppError } from '../../src/utils/AppError.js';
const cache = new Map();
async function read(path, input) {
  try {
    const response = await fetch(env.YOMOGAN_CORE_URL + '/api/catalog-context/' + path, {
      method: input ? 'POST' : 'GET', redirect:'error',
      headers: input ? {'content-type':'application/json','x-nocturno-csrf':'1'} : {},
      ...(input ? {body:JSON.stringify(input)} : {}), signal:AbortSignal.timeout(5000),
    });
    if(!response.ok) throw Error('catalog');
    return (await response.json()).data;
  } catch { throw new AppError(503,'CATALOG_UNAVAILABLE','El catálogo no está disponible. Inténtalo de nuevo.'); }
}
export const yomoganRepository = {
  candidates: (filters={},query='',ids=null) => read('events',{filters,query,ids}),
  locations: () => read('locations'),
  async cached(ids,key) {return ids.map(id=>cache.get(key+id)).filter(Boolean);},
  async cache(id,key,hash,embedding) {
    if(cache.size>=2000) cache.delete(cache.keys().next().value);
    cache.set(key+id,{event_id:id,document_hash:hash,embedding});
  },
};
