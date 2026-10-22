import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createMenuTemplate } = createRequire(import.meta.url)('../apps/desktop/menu.cjs');
const options = { showAbout() {} };
test('Mac delegates application and window menus to native roles', () => {
  const menu = createMenuTemplate('darwin', options);
  assert.equal(menu[0].role, 'appMenu');
  assert.ok(menu.some(item => item.role === 'windowMenu'));
  assert.ok(menu.find(item => item.label === 'Edit').submenu.some(item => item.role === 'pasteAndMatchStyle'));
  assert.deepEqual(menu.find(item => item.label === 'File').submenu, [{ role: 'close' }]);
});
test('Windows has mnemonics, File Exit, Help About and no Mac menus', () => {
  const menu = createMenuTemplate('win32', options);
  assert.deepEqual(menu.map(item => item.label), ['&File', '&Edit', '&View', '&Mailbox', '&Help']);
  assert.ok(menu[0].submenu.some(item => item.role === 'quit'));
  assert.equal(menu.at(-1).submenu[0].click, options.showAbout);
});

test('native Mailbox actions select only their intended folder and View exposes window recovery',()=>{
 const commands=[];let restored=false;
 const menu=createMenuTemplate('darwin',{...options,mailboxCommand:folder=>commands.push(folder),restoreWindow:()=>{restored=true;}});
 const mailbox=menu.find(item=>item.label==='Mailbox');mailbox.submenu.forEach(item=>item.click());
 assert.deepEqual(commands,['junk','trash']);
 menu.find(item=>item.label==='View').submenu.find(item=>item.label==='Restore Standard Window').click();assert.equal(restored,true);
});
