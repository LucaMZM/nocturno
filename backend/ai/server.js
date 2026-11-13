import { existsSync } from 'node:fs';
const config=new URL('./.env',import.meta.url);
if(existsSync(config)) process.loadEnvFile(config);
if(Object.keys(process.env).some(key=>/^(DATABASE_URL|PGPASSWORD|PGUSER|STRIPE_|JWT_)/.test(key))) {
  console.error('AI no puede arrancar con credenciales de Core en su entorno.');
  process.exit(1);
}
const {aiApp}=await import('./app.js');
const server=aiApp.listen(Number(process.env.AI_PORT??3001),process.env.AI_HOST??'127.0.0.1',()=>console.log('AI_PORT='+server.address().port));

if (process.env.YOMOGAN_WARMUP === 'true') {
  const { warmPublicIndex } = await import('./services/yomogan.service.js');
  void warmPublicIndex().then(async () => {
    const { yomoganAiService } = await import('./services/yomogan-ai.service.js');
    const { z } = await import('zod');
    await yomoganAiService.generate('Preparación del modelo. Responde con ready=true.', {}, z.object({ready:z.boolean()}));
    console.log('Caché pública de embeddings y modelo preparados');
  }).catch(()=>console.warn('No se pudo precalentar la caché; el catálogo seguirá disponible'));
}
