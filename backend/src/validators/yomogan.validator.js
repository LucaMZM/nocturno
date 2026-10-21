import { z } from 'zod';
import { genres, atmospheres, eventTypes, ideals } from './event.validator.js';
export const chatInput=z.object({messages:z.array(z.object({
  role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(1200),
}).strict()).min(1).max(11)}).strict().superRefine(({messages},ctx)=>{
  if(messages.at(-1).role!=='user' || messages.reduce((n,m)=>n+m.content.length,0)>8000)
    ctx.addIssue({code:'custom',path:['messages'],message:'Invalid conversation length or last role'});
});
export const preferenceSchema=z.object({
  municipality:z.string().trim().max(120).nullable(),
  province:z.string().trim().max(120).nullable(),
  genre:z.enum(genres).nullable(),atmosphere:z.enum(atmospheres).nullable(),
  eventType:z.enum(eventTypes).nullable(),idealFor:z.enum(ideals).nullable(),
  dressCode:z.enum(['CASUAL','SMART_CASUAL','ELEGANT','STREETWEAR','NO_DRESS_CODE']).nullable(),
  maxPrice:z.number().min(0).max(10000).nullable(),exclusivePrice:z.boolean(),
  groupSize:z.number().int().min(1).max(10),age:z.number().int().min(0).max(120).nullable(),
  day:z.enum(['any','tonight','tomorrow','weekend','monday','tuesday','wednesday','thursday','friday','saturday','sunday']).nullable(),
  date:z.iso.date().nullable(),
}).strict();
export const replySchema=z.object({
  message:z.string().trim().min(1).max(900),question:z.string().trim().max(200).nullable(),
  recommendations:z.array(z.object({id:z.uuid(),reason:z.string().trim().min(1).max(240)}).strict()).max(3),
}).strict();
