// Runs only with --smoke-test against bundled fictional mail.
function attachSmokeTest(app, window, Menu) {
  const fail = error => { console.error('DESKTOP_SMOKE_FAILED', error); app.exit(1); };
  const timeout = setTimeout(() => fail('Timed out waiting for the packaged interface'), 30000);
  window.webContents.once('did-fail-load', (_event, code, description) => fail(`${code}: ${description}`));
  window.webContents.once('render-process-gone', (_event, details) => fail(details.reason));
  window.webContents.once('did-finish-load', async () => {
    try {
      const prefs = window.webContents.getLastWebPreferences();
      if (!prefs.sandbox || !prefs.contextIsolation || prefs.nodeIntegration) throw new Error('Unsafe renderer preferences');
      if (!window.isClosable() || !window.isMinimizable() || !window.isMaximizable() || window.isFullScreen()) throw new Error('Native window controls unavailable');
      if (!Menu.getApplicationMenu()) throw new Error('Native application menu missing');
      const result = await window.webContents.executeJavaScript(`(async () => {
        const assert = (ok, message) => { if (!ok) throw new Error(message); };
        const wait = async (test) => { for (let n=0; n<100; n++) { if(test()) return; await new Promise(r=>setTimeout(r,50)); } throw new Error('Interface did not initialize'); };
        await wait(()=>document.querySelectorAll('.message').length===7);
        assert(window.desktopMail?.isDesktop === true,'Desktop preload bridge');
        assert(getComputedStyle(document.querySelector('.window-menu')).display==='none','No duplicated desktop menu');
        document.querySelector('#tab-view').click();document.querySelector('#layout-columns').click();
        assert(document.body.dataset.mailLayout==='columns','Column layout selection');
        assert(getComputedStyle(document.querySelector('.reading-pane')).display==='none','Column layout hides reader');
        document.querySelector('#layout-preview').click();document.querySelector('#tab-home').click();
        assert(getComputedStyle(document.querySelector('.reading-pane')).display!=='none','Reading pane restored');
        assert(document.querySelector('#mailbox-title').textContent==='All inboxes','Unified inbox title');
        document.querySelector('[data-view="personal"]').click();
        assert(document.querySelectorAll('.message').length===3,'Personal account filter');
        const search=document.querySelector('#search'); search.value='garden'; search.dispatchEvent(new Event('input'));
        assert(document.querySelectorAll('.message').length===1,'Search matching messages');
        search.value='no-such-message'; search.dispatchEvent(new Event('input'));
        assert(!document.querySelector('.message'),'Empty search');
        search.value=''; search.dispatchEvent(new Event('input'));
        document.querySelector('#rules-toggle').click();
        const rules=document.querySelector('#rules'); assert(rules.open,'Rules dialog');
        rules.querySelector('[name="term"]').value='invoice'; rules.querySelector('[name="value"]').value='Finance';
        rules.querySelector('form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
        assert(document.querySelector('#preview').textContent.includes('1 matching inbox message'),'Rules preview');
        rules.close();
        return {title:document.title, checks:11};
      })()`);
      console.log('DESKTOP_SMOKE_OK', JSON.stringify({ platform:process.platform, arch:process.arch, ...result }));
      clearTimeout(timeout); app.exit(0);
    } catch (error) { fail(error.message); }
  });
}
module.exports = { attachSmokeTest };
