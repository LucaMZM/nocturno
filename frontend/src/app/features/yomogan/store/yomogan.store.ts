import { inject } from '@angular/core';
import { signalStore,patchState,withMethods,withState } from '@ngrx/signals';
import { toApiProblem } from '../../../shared/utils/api-error';
import { YomoganApiService,YomoganMessage } from '../services/yomogan-api.service';
interface ChatState {
  open:boolean;messages:YomoganMessage[];pending:boolean;error:string|null;avatarUrl:string|null;
}
const initial:ChatState={open:false,messages:[],pending:false,error:null,avatarUrl:null};
export const YomoganStore=signalStore(
  {providedIn:'root'},withState(initial),
  withMethods((store,api=inject(YomoganApiService))=>{
    let version=0;
    async function respond(){
      if(store.pending())return;
      const requestVersion=version;
      const messages=store.messages().slice(-11).map(({role,content})=>({role,content}));
      // Stay within the HTTP conversation budget without persisting chat history.
      while(messages.reduce((n,m)=>n+m.content.length,0)>8000)messages.shift();
      patchState(store,{pending:true,error:null});
      try{
        const {data}=await api.chat(messages);
        if(requestVersion!==version)return;
        const content=[data.message,data.question].filter(Boolean).join(' ');
        patchState(store,{pending:false,messages:[...store.messages(),{role:'assistant',content,reply:data}]});
      }catch(error){
        if(requestVersion!==version)return;
        patchState(store,{pending:false,error:toApiProblem(error,'No hemos podido consultar Yomogan. Inténtalo otra vez.').message});
      }
    }
    return {
      async loadConfig(){
        try{const {data}=await api.config();patchState(store,{avatarUrl:data.avatarUrl});}
        catch{/* The conversation remains available without an avatar configuration. */}
      },
      setOpen(open:boolean){patchState(store,{open});},
      async send(content:string){
        const message=content.trim();
        if(store.pending()||store.error()||!message||message.length>1200)return;
        patchState(store,{messages:[...store.messages(),{role:'user',content:message}]});
        await respond();
      },
      async retry(){if(store.error())await respond();},
      newConversation(){
        version++;
        patchState(store,{messages:[],pending:false,error:null});
      },
    };
  })
);
