// Solo opera sobre la caché del proceso AI, nunca sobre PostgreSQL.
const response = await fetch((process.env.AI_URL ?? 'http://127.0.0.1:3001') + '/internal/index', {
  method:'POST', headers:{'content-type':'application/json'}, body:'{}', signal:AbortSignal.timeout(180000),
});
if (!response.ok) throw new Error('No se ha podido preparar la caché de IA: HTTP '+response.status);
console.log('Catálogo público indexado:', (await response.json()).data.indexed);
