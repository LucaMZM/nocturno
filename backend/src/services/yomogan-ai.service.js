import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
const unavailable=()=>new AppError(503,'YOMOGAN_UNAVAILABLE','Yomogan no puede responder ahora. Puedes seguir buscando eventos.');
async function request(base,path,key,body) {
  try {
    const response=await fetch(base.replace(/\/$/,'')+path,{method:'POST',redirect:'error',
      headers:{'content-type':'application/json',...(key?{authorization:'Bearer '+key}:{})},
      body:JSON.stringify(body),signal:AbortSignal.timeout(env.YOMOGAN_TIMEOUT_MS)});
    if(!response.ok)throw Object.assign(new Error('AI provider request failed'),{code:'AI_HTTP_'+response.status});
    const text=await response.text();
    if(text.length>3000000)throw unavailable();
    return JSON.parse(text);
  } catch(cause) {const error=unavailable();error.cause=cause;throw error;}
}
export const yomoganAiService={
  get modelKey(){return [env.YOMOGAN_EMBED_PROVIDER,env.YOMOGAN_EMBED_URL,env.YOMOGAN_EMBED_MODEL].join('|');},
  async generate(system,input,schema) {
    const format=z.toJSONSchema(schema);
    const messages=[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}];
    const ollama=env.YOMOGAN_PROVIDER==='ollama';
    const body=ollama
      ?{model:env.YOMOGAN_MODEL,messages,format,stream:false,think:false,keep_alive:0,
        options:{temperature:0.2,num_predict:600,num_ctx:8192}}
      :{model:env.YOMOGAN_MODEL,messages,temperature:0.2,max_tokens:600,
        response_format:{type:'json_schema',json_schema:{name:'yomogan',strict:true,schema:format}}};
    const result=await request(env.YOMOGAN_CHAT_URL,ollama?'/api/chat':'/chat/completions',env.YOMOGAN_API_KEY,body);
    const content=ollama?result.message?.content:result.choices?.[0]?.message?.content;
    const diagnostic={finish:result.done_reason??result.choices?.[0]?.finish_reason,characters:content?.length??0};
    let parsed;
    try{parsed=JSON.parse(content);}
    catch{throw Object.assign(unavailable(),{cause:{code:'AI_RESPONSE_JSON',...diagnostic}});}
    const checked=schema.safeParse(parsed);
    if(!checked.success)throw Object.assign(unavailable(),{cause:{code:'AI_RESPONSE_SCHEMA',...diagnostic,
      fields:checked.error.issues.map(({path,code})=>({path:path.join('.'),code}))}});
    return checked.data;
  },
  async embed(texts) {
    if(env.YOMOGAN_EMBED_PROVIDER==='disabled')throw unavailable();
    const ollama=env.YOMOGAN_EMBED_PROVIDER==='ollama';
    const result=await request(env.YOMOGAN_EMBED_URL,ollama?'/api/embed':'/embeddings',env.YOMOGAN_EMBED_API_KEY,
      {model:env.YOMOGAN_EMBED_MODEL,input:texts,...(ollama?{keep_alive:'0',truncate:true}:{})});
    const vectors=ollama?result.embeddings:result.data?.slice().sort((a,b)=>a.index-b.index).map((r)=>r.embedding);
    if(!Array.isArray(vectors)||vectors.length!==texts.length||
      vectors.some((v)=>!Array.isArray(v)||v.length<1||v.length>4096||v.some((n)=>!Number.isFinite(n)))||
      vectors.some((v)=>v.length!==vectors[0].length))throw unavailable();
    return vectors;
  },
};
