export function messageCommands(message,{canModify=false,canSend=false,busy=false,pendingAction}={}) {
 const junk=['junk','spam'].includes(message?.folder);
 const modify=!!message&&canModify&&!busy;
 const sending='Configure an outgoing account to send mail.';
 const unavailable=!message?'Select a message first.':busy?'Saving the current mailbox change. Please wait.':!canModify?'This account is read-only. Reconnect with a write-enabled authorization.':'This action does not apply to the selected message.';
 const command=(label,enabled=false,visible=true,reason=unavailable)=>({label,enabled,visible,reason:enabled?'':reason});
 return {
  reply:command('Reply',!!message&&canSend,true,sending),replyAll:command('Reply All',!!message&&canSend,true,sending),forward:command('Forward',!!message&&canSend,true,sending),
  move:command('Move to Folder…',modify),
  archive:command('Archive',modify&&message.folder!=='archive',true,!busy&&message?.folder==='archive'?'This message is already in Archive.':unavailable),
  trash:command(busy&&pendingAction==='trash'?'Deleting…':'Delete',modify&&message.folder!=='trash',true,busy&&pendingAction==='trash'?'Moving this message to Deleted Items…':!busy&&message?.folder==='trash'?'This message is already in Deleted Items.':unavailable),
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
