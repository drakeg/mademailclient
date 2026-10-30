// Reconcile a refresh with confirmed local flag changes without losing loaded text.
export function reconcileMessage(fresh,previous,confirmed={}){
 const message={...fresh,...(previous?.loaded?{body:previous.body,loaded:true}:{}),...(previous?.loading?{loading:true}:{})};
 const pending={};
 for(const key of ['unread','flagged'])if(Object.hasOwn(confirmed,key)&&fresh[key]!==confirmed[key]){message[key]=confirmed[key];pending[key]=confirmed[key];}
 return {message,pending};
}
export function patchMessageFlags(messages,id,patch){
 return messages.map(message=>message.id===id?{...message,...patch}:message);
}
