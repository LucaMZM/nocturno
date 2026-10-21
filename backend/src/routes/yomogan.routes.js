import { Router } from 'express';
import { validate } from '../validators/common.js';
import { chatInput } from '../validators/yomogan.validator.js';
import { yomoganController } from '../controllers/yomogan.controller.js';
import { AppError } from '../utils/AppError.js';
export function createChatLimit({limit=12,windowMs=60000,concurrency=2}={}){
  const clients=new Map();let running=0;
  return (req,res,next)=>{
    const now=Date.now();
    for(const [key,entry] of clients)if(entry.until<=now)clients.delete(key);
    const key=req.ip,entry=clients.get(key)??{count:0,until:now+windowMs};
    if(entry.count>=limit||running>=concurrency||(!clients.has(key)&&clients.size>=10000)){
      res.set('Retry-After','60');return next(new AppError(429,'YOMOGAN_RATE_LIMIT','Yomogan necesita un momento. Inténtalo de nuevo en un minuto.'));
    }
    entry.count++;clients.set(key,entry);running++;
    let completed=false;
    const release=()=>{if(!completed){completed=true;running--;}};
    req.releaseYomoganSlot=release;res.once('finish',release);next();
  };
}
export const yomoganRoutes=Router();
yomoganRoutes.post('/chat',validate(chatInput),createChatLimit(),yomoganController.chat);
