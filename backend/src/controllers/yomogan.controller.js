import { asyncHandler } from '../utils/asyncHandler.js';
import { yomoganService } from '../services/yomogan.service.js';
export const yomoganController={
  chat:asyncHandler(async(req,res)=>{
    try{res.set('Cache-Control','no-store');res.json({data:await yomoganService.chat(req.validated.body.messages)});}
    finally{req.releaseYomoganSlot?.();}
  }),
};
