import { createServer, request } from 'node:http';
import { pathToFileURL } from 'node:url';
export function createGateway({core='http://127.0.0.1:3000',ai='http://127.0.0.1:3001',timeout=70000}={}) {
 return createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  const isAi=/^\/api\/yomogan\/(chat|config)(?:\?|$)/.test(req.url);
  if(req.url.startsWith('/api/catalog-context') || !req.url.startsWith('/api/') || (req.url.startsWith('/api/yomogan/')&&!isAi)) {res.writeHead(404);return res.end();}
  const target=new URL(isAi?ai:core);
  const allowed=isAi?['content-type','accept','user-agent']:['content-type','accept','user-agent','cookie','origin','referer','x-nocturno-csrf','sec-fetch-site','stripe-signature','authorization'];
  const headers={};
  for(const key of allowed)if(req.headers[key])headers[key]=req.headers[key];
  const upstream=request({hostname:target.hostname,port:target.port,path:req.url,method:req.method,headers,timeout},incoming=>{
   const outgoing={...incoming.headers};
   if(isAi)delete outgoing['set-cookie'];
   res.writeHead(incoming.statusCode,outgoing);incoming.pipe(res);
  });
  let size=0;
  req.on('data',chunk=>{size+=chunk.length;if(size>(isAi?16384:1048576)){res.writeHead(413);res.end();upstream.destroy();}else upstream.write(chunk);});
  req.on('end',()=>upstream.end());
  req.on('aborted',()=>upstream.destroy());
  res.on('close',()=>upstream.destroy());
  upstream.on('timeout',()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'SERVICE_UNAVAILABLE',message:'Servicio temporalmente no disponible'}}));}});
 });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
 createGateway({core:process.env.CORE_URL,ai:process.env.AI_URL}).listen(8080,process.env.GATEWAY_HOST??'127.0.0.1',()=>console.log('Gateway preparado en puerto 8080'));
