// Small launcher bridge; the official client owns preview, battle controls and rendering.
let selectionDialog;
let heldRoom;
const notifyLauncher = data => { if (parent !== window) parent.postMessage(data, location.origin); };
let lastBattleRoom = '';
const embedStyle = document.createElement('style');
embedStyle.textContent = `
  body {background:#f7f8fa!important}
  .header {display:none!important}
  .ps-room {top:0!important;border:0}
  .ps-room:not([id^="room-battle-"]) {display:none!important}
  .jev-confirm {width:calc(100% - 32px);max-width:460px;border:1px solid #e5e7eb;border-radius:14px;padding:26px;font:14px/1.6 'Segoe UI',sans-serif;color:#182022}
  .jev-confirm::backdrop {background:rgba(24,32,34,.34)}
  .jev-confirm h2 {font-size:23px;line-height:1.2;margin:0 0 18px}
  .jev-confirm p {color:#667080}
  .jev-confirm button {font:inherit;border:1px solid #d8dde5;border-radius:8px;background:#fff;padding:11px 15px;cursor:pointer;margin:8px 8px 0 0}
  .jev-confirm button.primary {background:#4254eb;color:#fff;border-color:#4254eb}
  .jev-confirm button:focus-visible {outline:3px solid #4254eb;outline-offset:3px}
  [data-cmd="/savereplay"], [data-cmd^="/closeand /challenge"] {display:none!important}
`;
document.head.append(embedStyle);
const installConfirmation = () => {
  if (typeof PS === 'undefined') { setTimeout(installConfirmation, 100); return; }
  PS.prefs.set('onepanel', true);
  PS.prefs.set('battlelayout', 'side-by-side');
  const leave = PS.leave.bind(PS);
  PS.leave = roomId => { leave(roomId); if (roomId === lastBattleRoom) notifyLauncher({type:'jev-client-home'}); };
  const send = PS.send.bind(PS);
  PS.send = (message, roomId) => {
    if (message === '/undo' && heldRoom === roomId) { heldRoom = null; return; }
    if (!message.startsWith('/choose team ') || !roomId) return send(message, roomId);
    selectionDialog?.remove();
    const room = PS.rooms[roomId];
    const order = message.slice('/choose team '.length).split('|')[0].replace(/[,\s]/g, '').split('').map(Number);
    if (order.length !== 4) return send(message, roomId);
    heldRoom = roomId;
    const dialog = selectionDialog = document.createElement('dialog');
    dialog.className = 'jev-confirm';
    const title = document.createElement('h2'); title.textContent = 'Confirm your four Pokémon'; title.id = 'jev-confirm-title'; dialog.setAttribute('aria-labelledby', title.id); dialog.append(title);
    const names = order.map(i => room.request.side.pokemon[i - 1].details.split(',')[0]);
    const details = document.createElement('p'); details.textContent = `Leads: ${names[0]} + ${names[1]}. Reserves: ${names[2]}, ${names[3]}.`; dialog.append(details);
    const change = document.createElement('button'); change.textContent = 'Change selection';
    change.onclick = () => { dialog.remove(); room.send('/cancel'); }; dialog.append(change);
    const confirm = document.createElement('button'); confirm.textContent = 'Start battle'; confirm.className = 'primary';
    confirm.onclick = () => {
      heldRoom = null; dialog.remove();
      send(`${message.split('|')[0]}|${room.request.rqid}`, roomId);
      room.choices.noCancel = true; room.update(null);
    };
    dialog.append(confirm);
    dialog.addEventListener('cancel', event => { event.preventDefault(); change.click(); });
    document.body.append(dialog); dialog.showModal();
  };
  const receive = PS.receive.bind(PS);
  PS.receive = message => {
    receive(message);
    const error = message.match(/(?:^|\n)\|(?:error|popup)\|([^\n]+)/)?.[1];
    if (error) notifyLauncher({type:'jev-client-error',message:error});
  };
  setInterval(() => {
    notifyLauncher({type:'jev-client-ready',ready:Boolean(PS.connection?.connected)});
    const battles = Object.values(PS.rooms).filter(room => room.id.startsWith('battle-'));
    const room = battles[battles.length - 1];
    if (room && room.id !== lastBattleRoom) { lastBattleRoom=room.id; PS.focusRoom(room.id); }
  }, 500);
};
installConfirmation();
let pendingCommandGeneration = 0;
window.addEventListener('message', event => {
  if (event.origin === location.origin && event.source === parent && event.data?.type === 'jev-focus-battle') {
    if (typeof PS !== 'undefined' && lastBattleRoom && PS.rooms[lastBattleRoom]) PS.focusRoom(lastBattleRoom);
    window.dispatchEvent(new Event('resize')); return;
  }
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'jev-local-command') return;
  const command = event.data.command;
  if (typeof command !== 'string' || (command !== '/jevretry' && !/^\/jev(?:practice|reset) (?:standard|swapped|[a-z0-9][a-z0-9-]{0,79},[a-z0-9][a-z0-9-]{0,79})$/.test(command))) return;
  if (command !== '/jevretry') {
    selectionDialog?.remove(); selectionDialog = null; heldRoom = null;
  }
  const generation = ++pendingCommandGeneration;
  const started = Date.now();
  const ready = () => {
    if (generation !== pendingCommandGeneration) return;
    if (typeof PS === 'undefined' || !PS.connection?.connected) {
      if (Date.now() - started < 15000) setTimeout(ready, 150);
      else notifyLauncher({type:'jev-client-error',message:'The battle server is not connected. Please reconnect.'});
      return;
    }
    if (!PS.user.named) { PS.send('/trn Trainer'); setTimeout(ready, 250); return; }
    PS.send(command);
  };
  ready();
});
