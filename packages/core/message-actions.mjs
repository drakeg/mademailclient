export function messageCommands(message,{canModify=false}={}) {
 const junk=['junk','spam'].includes(message?.folder);
 const modify=!!message&&canModify;
 const sending='Sending is not implemented yet.';
 const unavailable=message?'Connected accounts are read-only in this alpha.':'Select a message first.';
 const command=(label,enabled=false,visible=true,reason=unavailable)=>({label,enabled,visible,reason:enabled?'':reason});
 return {
  reply:command('Reply',false,true,sending),replyAll:command('Reply All',false,true,sending),forward:command('Forward',false,true,sending),
  archive:command('Archive',modify&&message.folder!=='archive'),trash:command('Delete',modify&&message.folder!=='trash'),
  junk:command('Junk',modify&&!junk,!junk),notJunk:command('Not Junk',modify&&junk,junk),
  unread:command(message?.unread?'Mark as Read':'Mark as Unread',modify),
  flag:command(message?.flagged?'Remove Flag':'Flag',modify),
 };
}
// Synthetic data only. Provider mutations require their own authorized adapter.
export function applyDemoMessageAction(message,action) {
 if(!messageCommands(message,{canModify:true})[action]?.enabled)throw new Error('Message action unavailable');
 if(action==='unread')return {...message,unread:!message.unread};
 if(action==='flag')return {...message,flagged:!message.flagged};
 return {...message,folder:action==='notJunk'?'inbox':action};
}
