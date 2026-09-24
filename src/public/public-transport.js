/* Only the player's own protocol crosses this boundary. The server owns choices,
 * sessions and battle results; the official client still renders the battle. */
(() => {
  // Load after the shared client's styles; legacy local demos keep their theme.
  const applyTheme = () => {
    const theme = document.createElement('link');
    theme.rel = 'stylesheet'; theme.href = '/public.css';
    document.body.append(theme);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyTheme, { once:true });
  else applyTheme();

  let csrf = '', battle = '', cursor = 0, busy = false, initial = true;
  const notify = data => parent.postMessage(data, location.origin);
  async function request(path, data) {
    const response = await fetch(path, data ? { method: 'POST', headers: { 'Content-Type':'application/json', 'X-CSRF-Token':csrf }, body:JSON.stringify(data) } : {});
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || value.message || 'Unable to connect to the arena.');
    return value;
  }
  const error = message => { if (battle && PS.rooms[battle]) PS.receive(`>${battle}\n|error|${String(message).replace(/[\r\n|]/g,' ')}`); notify({ type:'jev-client-error', message }); };
  const connection = {
    connected:false, canReconnect:()=>true,
    disconnect() { connection.connected=false; }, reconnect() { void poll(); },
    send(raw) {
      const separator=raw.indexOf('|'), room=raw.slice(0,separator), command=raw.slice(separator+1);
      if (/^\/jev(?:reset|practice) /.test(command)) {
        if (busy) return; busy=true;
        void (async()=>{
          const current=await request('/api/status');
          if (current.battleId && current.state!=='ended') await request('/api/forfeit',{battle:current.battleId,requestId:crypto.randomUUID()});
          const [human,jev]=command.split(' ')[1].split(',');
          await request('/api/battles',{human,jev,requestId:crypto.randomUUID()});
          await poll();
        })().catch(e=>error(e.message)).finally(()=>{busy=false;}); return;
      }
      if (command.startsWith('/choose ')) {
        const match=/^\/choose ([^|]+)(?:\|(\d+))?$/.exec(command);
        const requestId = match?.[2] ? Number(match[2]) : PS.rooms[room]?.request?.rqid;
        if (!match || !Number.isSafeInteger(requestId)) { error('Wait for the current turn before choosing.'); return; }
        if (PS.rooms[room]?.choices) { PS.rooms[room].choices.noCancel=true; PS.rooms[room].update(null); }
        void request('/api/choice',{battle:room,command:match[1],rqid:requestId,requestId:crypto.randomUUID()}).catch(e=>error('[Invalid choice] '+e.message));
      } else if (command==='/undo') error('Your submitted choices are locked. Wait for the next turn.');
      // Chat, account commands, arbitrary room joins and simulator commands are not forwarded.
    },
  };
  PS.connection=connection; PS.isOffline=false;
  PS.prefs.set('mute', true);
  // Refresh resumes this server-owned match; the native close/forfeit prompt
  // belongs to the original WebSocket transport and would block reconnection.
  window.onbeforeunload = null;
  PSConnection.connect=()=>{PS.connection=connection;};
  PS.receive('|updateuser|Trainer|1|1');
  let polling=false;
  async function poll() {
    if (polling) return; polling=true;
    try {
      if (!csrf) csrf=(await request('/api/session')).csrf;
      const state=await request('/api/status');
      connection.connected=true;
      if (state.battleId) {
        const changed = battle!==state.battleId;
        if (changed) { if (battle && PS.rooms[battle]) PS.leave(battle); battle=state.battleId;cursor=0; }
        const feed=await request(`/api/feed?battle=${encodeURIComponent(battle)}&after=${cursor}`);
        for (const event of feed.events) if(event.chunk) {
          PS.receive(`>${battle}\n${event.chunk}`);
          // The official room component must mount before it can accept requests.
          if(event.chunk.startsWith('|init|')) await new Promise(resolve => setTimeout(resolve, 0));
        }
        cursor=feed.cursor;
        if((initial || changed) && state.state!=='ended') notify({type:'jev-public-resume',battleId:battle});
      }
      initial=false;
    } catch { connection.connected=false; }
    finally { polling=false; }
  }
  void poll(); setInterval(()=>void poll(),750);
})();
