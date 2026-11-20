import express from 'express';
import helmet from 'helmet';
import { warmPublicIndex } from './services/yomogan.service.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { yomoganRoutes, createChatLimit } from './routes/yomogan.routes.js';
import { AppError } from '../src/utils/AppError.js';
import { ZodError } from 'zod';
export const aiApp=express();
aiApp.disable('x-powered-by');
aiApp.use(helmet());
aiApp.use(express.json({limit:'16kb'}));
aiApp.get('/health',(_req,res)=>res.json({status:'ok',service:'ai'}));
aiApp.use('/api/yomogan',yomoganRoutes);
aiApp.post('/internal/index',createChatLimit({limit:1,windowMs:60000,concurrency:1}),asyncHandler(async (_req,res)=>res.json({data:{indexed:await warmPublicIndex()}})));
aiApp.use((_req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Recurso no disponible'}}));
aiApp.use((error,_req,res,_next)=>{
 const status=error instanceof AppError ? error.status : error instanceof ZodError ? 400 : error.type==='entity.too.large' ? 413 : 500;
 res.status(status).json({error:{code:error instanceof AppError ? error.code:'AI_REQUEST_ERROR',
   message:status===500?'No podemos responder ahora.':error instanceof AppError?error.message:'Solicitud no válida'}});
});
