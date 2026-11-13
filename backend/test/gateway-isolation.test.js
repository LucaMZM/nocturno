import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createGateway} from '../gateway/server.js';
const listen=async server=>{server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));return 'http://127.0.0.1:'+server.address().port;};
const close=server=>new Promise(r=>server.close(r));
test('Gateway conserva bytes Stripe y cookies Core, pero no comparte credenciales con AI',async()=>{
 const received=[];
 const echo=service=>createServer(async(req,res)=>{
  const bytes=[];for await(const chunk of req)bytes.push(chunk);
  received.push({service,headers:req.headers,body:Buffer.concat(bytes).toString()});
  res.setHeader('set-cookie','nocturno_access=secret; HttpOnly');res.end('ok');
 });
 const core=echo('core'),ai=echo('ai');
 const gateway=createGateway({core:await listen(core),ai:await listen(ai),timeout:500});
 const url=await listen(gateway);
 try{
  const headers={cookie:'nocturno_access=private',authorization:'Bearer private','stripe-signature':'t=1,v1=signature','x-nocturno-csrf':'1','content-type':'application/json'};
  const raw=' { "amount": 10,\n"currency": "eur" } ';
  const payment=await fetch(url+'/api/stripe/webhook',{method:'POST',headers,body:raw});
  assert.equal(received[0].body,raw);assert.equal(received[0].headers['stripe-signature'],headers['stripe-signature']);
  assert.ok(payment.headers.get('set-cookie').includes('HttpOnly'));
  const chat=await fetch(url+'/api/yomogan/chat',{method:'POST',headers,body:'{}'});
  for(const key of ['cookie','authorization','stripe-signature','x-nocturno-csrf'])assert.equal(received[1].headers[key],undefined);
  assert.equal(chat.headers.get('set-cookie'),null);
  assert.equal((await fetch(url+'/api/yomogan/admin')).status,404);
  await close(ai);
  assert.equal((await fetch(url+'/api/yomogan/chat',{method:'POST',headers,body:'{}'})).status,502);
  assert.equal((await fetch(url+'/api/auth/me')).status,200);
 }finally{await close(gateway);await close(core);if(ai.listening)await close(ai);}
});
test('AI se niega a arrancar con credenciales críticas heredadas',async()=>{
 const child=spawn(process.execPath,['ai/server.js'],{cwd:process.cwd(),env:{PATH:process.env.PATH,DATABASE_URL:'postgres://forbidden:forbidden@localhost/forbidden'},stdio:'pipe'});
 let stderr='';child.stderr.on('data',data=>stderr+=data);
 const code=await new Promise(r=>child.once('exit',r));
 assert.equal(code,1);assert.match(stderr,/credenciales de Core/);assert.ok(!stderr.includes('forbidden'));
});
test('AI expone solo chat/config; pedidos, usuarios, sesiones y escritura no existen',async()=>{
 const {aiApp}=await import('../ai/app.js');
 const server=aiApp.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  for(const path of ['/api/orders','/api/auth/me','/api/users','/api/events/any']){
   assert.equal((await fetch(url+path)).status,404);
   assert.equal((await fetch(url+path,{method:'PATCH',headers:{'content-type':'application/json'},body:'{}'})).status,404);
  }
  assert.equal((await fetch(url+'/api/yomogan/config')).status,200);
 }finally{await close(server);}
});

test('AI arranca como proceso sin secretos y consulta Core solamente por HTTP',async()=>{
 const core=createServer((req,res)=>{
  assert.equal(req.headers.cookie,undefined);
  res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[]}));
 });
 const coreUrl=await listen(core);
 const child=spawn(process.execPath,['ai/server.js'],{env:{PATH:process.env.PATH,AI_PORT:'0',YOMOGAN_CORE_URL:coreUrl},stdio:'pipe'});
 try{
  const port=await new Promise((resolve,reject)=>{
   child.stdout.on('data',chunk=>{const match=String(chunk).match(/AI_PORT=(\d+)/);if(match)resolve(match[1]);});
   child.once('error',reject);child.once('exit',()=>reject(Error('AI terminó antes de arrancar')));
  });
  const url='http://127.0.0.1:'+port;
  assert.equal((await fetch(url+'/api/orders')).status,404);
  const response=await fetch(url+'/api/yomogan/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Hola'}]})});
  assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.data.events.length,0);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await close(core);}
});

test('Gateway → Core real mantiene registro, perfil y logout cuando AI está caída',async()=>{
 const {env}=await import('../src/config/env.js');
 if(!env.DATABASE_URL)return;
 const {app}=await import('../src/app.js');
 const {getPool,closePool}=await import('../src/config/db.js');
 const {randomUUID}=await import('node:crypto');
 const core=app.listen(0,'127.0.0.1');await new Promise(r=>core.once('listening',r));
 const coreUrl='http://127.0.0.1:'+core.address().port;
 const gateway=createGateway({core:coreUrl,ai:'http://127.0.0.1:1',timeout:500});
 const root=await listen(gateway);
 let userId;
 try{
  assert.equal((await fetch(root+'/api/yomogan/config')).status,502);
  assert.equal((await fetch(root+'/api/catalog-context/locations')).status,404);
  const response=await fetch(root+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json','x-nocturno-csrf':'1'},body:JSON.stringify({
    email:'gateway-'+randomUUID()+'@example.test',displayName:'Prueba aislada',password:'GatewayTest!2026',
  })});
  assert.equal(response.status,201);
  userId=(await response.json()).data.user.id;
  const cookies=response.headers.getSetCookie();assert.ok(cookies.every(value=>value.includes('HttpOnly')));
  const cookie=cookies.map(value=>value.split(';')[0]).join('; ');
  assert.equal((await fetch(root+'/api/profile/me',{headers:{cookie}})).status,200);
  assert.equal((await fetch(root+'/api/auth/logout',{method:'POST',headers:{cookie,'x-nocturno-csrf':'1'}})).status,204);
  assert.equal((await fetch(root+'/api/profile/me',{headers:{cookie}})).status,401);
 }finally{
  await close(gateway);await close(core);
  if(userId)await getPool().query('DELETE FROM users WHERE id=$1',[userId]);
  await closePool();
 }
});
