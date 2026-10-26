const actions=['reply','replyAll','forward','archive','trash','junk','notJunk','unread','flag'];
function validState(state) {
 return state&&typeof state==='object'&&['selected','canModify','junk','unread','flagged','trash','archive'].every(key=>typeof state[key]==='boolean');
}
function registerMessageMenuState(ipcMain,Menu,getWindow) {
 ipcMain.on('message:menu-state',(event,state)=>{
  const contents=getWindow()?.webContents;
  if(!contents||event.sender!==contents||event.senderFrame!==contents.mainFrame||event.senderFrame.url!=='mademail://app/'||!validState(state))return;
  const menu=Menu.getApplicationMenu();
  for(const action of actions){
   const item=menu?.getMenuItemById('message:'+action);if(!item)continue;
   item.enabled=state.selected&&state.canModify&&!['reply','replyAll','forward'].includes(action)&&!(action==='trash'&&state.trash)&&!(action==='archive'&&state.archive);
   if(action==='junk'||action==='notJunk'){item.visible=action==='junk'?!state.junk:state.junk;item.enabled=item.enabled&&item.visible;}
   if(action==='unread')item.label=state.unread?'Mark as Read':'Mark as Unread';
   if(action==='flag')item.label=state.flagged?'Remove Flag':'Flag';
  }
 });
}
module.exports={registerMessageMenuState,validState};
