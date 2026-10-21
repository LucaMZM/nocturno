import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import '@angular/compiler';
import {createEnvironmentInjector} from '@angular/core';
import {build} from 'esbuild';
const dir=join(process.cwd(),'node_modules/.cache/nocturno-yomogan-tests');
const file=join(dir,'store-'+process.pid+'.mjs');
await mkdir(dir,{recursive:true});
await build({stdin:{contents:"export {YomoganStore} from './src/app/features/yomogan/store/yomogan.store.ts'; export {YomoganApiService} from './src/app/features/yomogan/services/yomogan-api.service.ts';",
  resolveDir:process.cwd(),loader:'ts'},bundle:true,packages:'external',platform:'node',format:'esm',outfile:file});
after(()=>rm(file,{force:true}));
const {YomoganStore,YomoganApiService}=await import(pathToFileURL(file).href);
const reply={mode:'search',message:'Búsqueda real',question:null,events:[],retrieval:'structured',disclaimer:'DEMO'};
test('chat blocks double sends, preserves follow-up context and keeps history in memory',async()=>{
  let resolve;const requests=[];
  const api={chat(messages){requests.push(messages);return new Promise((yes)=>{resolve=yes;});}};
  const injector=createEnvironmentInjector([{provide:YomoganApiService,useValue:api},YomoganStore]);
  try{
    const store=injector.get(YomoganStore);
    const first=store.send('Valencia techno');await store.send('duplicate');
    assert.equal(requests.length,1);assert.equal(store.pending(),true);
    resolve({data:reply});await first;
    const second=store.send('¿Y el sábado?');
    assert.deepEqual(requests[1].map((m)=>m.role),['user','assistant','user']);
    resolve({data:reply});await second;
    assert.equal(store.messages().length,4);
  }finally{injector.destroy();}
});
test('reset rejects stale answers; recoverable errors can retry without duplicate messages',async()=>{
  let resolve,calls=0;const api={chat(){calls++;return new Promise((yes)=>{resolve=yes;});}};
  const injector=createEnvironmentInjector([{provide:YomoganApiService,useValue:api},YomoganStore]);
  try{
    const store=injector.get(YomoganStore);const first=store.send('Valencia');
    store.newConversation();resolve({data:reply});await first;
    assert.deepEqual(store.messages(),[]);assert.equal(store.pending(),false);
    api.chat=async()=>{calls++;throw Error('network');};
    await store.send('Madrid');assert.ok(store.error());assert.equal(store.messages().length,1);
    api.chat=async()=>({data:reply});
    await store.retry();assert.equal(store.messages().length,2);assert.equal(store.error(),null);
  }finally{injector.destroy();}
});
