/* A guided view over the pinned official client's current controls.
 * Legality, request parsing, targeting, PP, pass/recharge and choice submission
 * stay with Showdown. No private opponent data or Jev state is read here.
 */
(() => {
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const arena = el('main', 'arena'); arena.id = 'arena';
  const left = el('section', 'arena-left');
  const stage = el('div', 'arena-stage'); stage.setAttribute('aria-label', 'Battlefield');
  const team = el('section', 'arena-team');
  const history = el('details', 'arena-history'), historySummary = el('summary', '', 'Battle history'), historyBody = el('div', 'arena-history-body');
  history.append(historySummary, historyBody); left.append(stage, team, history);
  const controls = el('section', 'arena-controls'); controls.setAttribute('aria-label', 'Your actions');
  arena.append(left, controls); document.body.append(arena);
  let currentRoom, signature = '', switchOpen = false, lastDecision = '', busy = false, logText = '';
  const name = mon => mon?.name || mon?.speciesForme || mon?.details?.split(',')[0] || 'Pokémon';
  const species = mon => mon?.speciesForme || mon?.details?.split(',')[0] || name(mon);
  const hp = mon => mon?.fainted ? 0 : mon?.maxhp ? Math.round(100 * mon.hp / mon.maxhp) : null;
  const image = mon => {
    const img = el('img'); img.alt = ''; img.width = 64; img.height = 64;
    img.src = 'https://play.pokemonshowdown.com/sprites/gen5/' + species(mon).toLowerCase().replace(/[^a-z0-9-]/g, '') + '.png';
    img.onerror = () => { img.hidden = true; }; return img;
  };
  const health = mon => {
    const percent = hp(mon), block = el('span', 'arena-health');
    if (percent === null) return block;
    const bar = el('span', 'arena-hp'), fill = el('span'); fill.style.width = percent + '%';
    fill.style.backgroundColor = percent > 50 ? '#26a66c' : percent > 20 ? '#d19a27' : '#d34b59';
    bar.append(fill); block.append(bar, el('small', '', mon.fainted ? 'Fainted' : percent + '%' + (mon.status ? ' · ' + ({par:'Paralyzed',brn:'Burned',psn:'Poisoned',tox:'Badly poisoned',slp:'Asleep',frz:'Frozen'}[mon.status] || mon.status) : ''))); return block;
  };
  function button(label, action, cls = '') {
    const b = el('button', 'arena-button ' + cls, label); b.type = 'button'; b.onclick = action; return b;
  }
  function syncStage() {
    const rect = stage.getBoundingClientRect(), frame = currentRoom?.battle?.scene?.$frame?.[0];
    if (!frame) return;
    frame.classList.add('arena-battle');
    // Keep the native scene mounted in its own component. Only position it over
    // the reserved stage; moving it would break the renderer's lifecycle.
    frame.style.setProperty('--arena-left', rect.left + 'px');
    frame.style.setProperty('--arena-top', rect.top + 'px');
    frame.style.setProperty('--arena-scale', String(rect.width / 640));
    frame.style.setProperty('--arena-visible', rect.width > 0 ? 'visible' : 'hidden');
  }
  new ResizeObserver(syncStage).observe(stage);
  window.addEventListener('scroll', syncStage, { passive: true }); window.addEventListener('resize', syncStage);
  function nativeAction(source) {
    const room = currentRoom, rqid = room?.request?.rqid, decision = room?.choices?.toString();
    return () => {
      if (busy || !source.isConnected || currentRoom !== room || room.request?.rqid !== rqid || room.choices?.toString() !== decision) return;
      if (source.disabled || ['true', 'fade'].includes(source.getAttribute('aria-disabled'))) return;
      busy = true; source.click();
      setTimeout(() => { busy = false; signature = ''; tick(); controls.querySelector('h2')?.focus({preventScroll:true}); }, 0);
    };
  }
  function nativeButtons(native, selector) {
    const seen = new Set();
    return [...native.querySelectorAll(selector)].filter(b => { const cmd=b.dataset.cmd; if (!cmd || seen.has(cmd)) return false; seen.add(cmd); return true; });
  }
  function copyDisabled(source, target) { target.disabled = source.disabled || ['true','fade'].includes(source.getAttribute('aria-disabled')); }
  function pokemonButton(source, mon, subtitle) {
    const b = button('', nativeAction(source), 'arena-pokemon'); copyDisabled(source,b);
    const text = el('span','arena-pokemon-text'); text.append(el('strong','',name(mon)), el('small','',subtitle || ''));
    if (currentRoom.request?.requestType !== 'team') text.append(health(mon));
    b.append(image(mon), text); return b;
  }
  function heading(title, hint) {
    const h = el('h2','',title); h.tabIndex=-1; controls.append(h);
    if (hint) controls.append(el('p','arena-hint',hint));
  }
  function back(native) {
    const source = native.querySelector('[data-cmd="/cancelone"], [data-cmd="/cancel"]');
    if (source) controls.append(button('Back', nativeAction(source), 'arena-link'));
  }
  function renderTeam(room) {
    team.replaceChildren(); team.hidden = room.request?.requestType === 'team';
    if (team.hidden) return;
    team.append(el('h3','','Your team'));
    const list = el('div','arena-team-list');
    for (const mon of room.side?.pokemon || []) {
      const item=el('div','arena-teammate' + (mon.fainted?' fainted':''));
      const text=el('span'); text.append(el('span','',name(mon)),health(mon)); item.append(image(mon),text); list.append(item);
    }
    team.append(list);
  }
  function render(room, native) {
    controls.replaceChildren(); renderTeam(room);
    const request = room.request, choices = room.choices;
    if (room.battle.ended) {
      const winner = [...room.battle.stepQueue].reverse().find(line => line.startsWith('|win|'))?.slice(5);
      heading(winner ? winner === room.battle.nearSide.name ? 'You won!' : 'Jev wins this one.' : 'Battle finished.', 'See the choices behind each turn, or play again.');
      controls.append(button('Review Jev’s decisions', () => parent.postMessage({type:'jev-review-decisions',battleId:room.id},location.origin), 'arena-primary'));
      controls.append(button('Play again', () => parent.postMessage({type:'jev-client-home'},location.origin), 'arena-link')); return;
    }
    if (!room.battle.atQueueEnd) { heading('The turn is playing out…'); return; }
    if (document.querySelector('.jev-confirm[open]')) { heading('Your team is ready.', 'Confirm your four to start the battle.'); return; }
    if (!request || !choices || request.requestType === 'wait' || choices.isDone()) {
      heading('Waiting for Jev…', 'Your choices are in.');
      const source=native?.querySelector('[data-cmd="/cancel"]');
      if(source && !choices?.noCancel) controls.append(button('Change choices',nativeAction(source),'arena-link'));
      return;
    }
    if (!native) { heading('Preparing your choices…'); return; }
    const index = choices.index(), own = request.side.pokemon;
    if (request.requestType === 'team') {
      const picked = choices.alreadySwitchingIn;
      heading(['Choose your first lead','Choose your second lead','Choose a reserve','Choose your last reserve'][picked.length] || 'Your team is ready', picked.length < 2 ? 'Your two leads start on the field together.' : 'Reserves can switch in during the battle.');
      const slots=el('ol','arena-preview-slots');
      for(let i=0;i<4;i++){const li=el('li',i===picked.length?'current':'');li.append(el('small','',i<2?'Lead '+(i+1):'Reserve '+(i-1)),el('span','',picked[i]?name(own[picked[i]-1]):'—'));slots.append(li);}
      controls.append(slots);
      const grid=el('div','arena-pokemon-grid');
      for(const source of nativeButtons(native,'.switchmenu [data-cmd^="/switch "]')) {
        const slot=Number(source.dataset.cmd.split(' ')[1]), mon=own[slot-1]; if(!mon)continue;
        grid.append(pokemonButton(source,mon,picked.includes(slot)?'Selected':room.battle.dex.species.get(species(mon)).types?.join(' / ')));
      }
      controls.append(grid); back(native); return;
    }
    const targeting=Boolean(choices.current.move);
    if(request.requestType==='move') {
      const steps=el('ol','arena-steps');
      for(let i=0;i<request.active.length;i++) if(request.active[i] && !own[i]?.fainted) {
        const li=el('li',i===index?'current':i<index?'done':''); li.append(el('span','arena-step-number',i<index?'✓':String(i+1)),el('span','',name(own[i])));steps.append(li);
      }
      controls.append(steps);
    }
    if(targeting) {
      heading('Choose a target',name(own[index]) + ' will use ' + choices.currentMove()?.name + '.');
      const grid=el('div','arena-pokemon-grid');
      for(const source of nativeButtons(native,'.switchmenu button[data-cmd]')) {
        const loc=Number(source.dataset.cmd.split(' ').at(-1));
        const mon=(loc>0?room.battle.farSide:room.battle.nearSide).active[Math.abs(loc)-1];
        if(!mon || mon.fainted)continue;
        const b=pokemonButton(source,mon,loc>0?'Jev’s Pokémon':'Your Pokémon');
        if(loc<0)b.classList.add('arena-ally');grid.append(b);
      }
      controls.append(grid);back(native);return;
    }
    if(request.requestType==='switch' || switchOpen) {
      heading(choices.isReviving()?'Choose a Pokémon to revive':'Choose a replacement', 'For ' + name(own[index]) + '.');
      const grid=el('div','arena-pokemon-grid');
      for(const source of nativeButtons(native,'.switchmenu [data-cmd^="/switch "]')) {
        const mon=own[Number(source.dataset.cmd.split(' ')[1])-1];if(!mon)continue;
        const b=pokemonButton(source,mon,mon.active?'On the field':mon.fainted?'Unavailable':'Reserve');grid.append(b);
      }
      controls.append(grid);
      if(switchOpen)controls.append(button('Back to moves',()=>{switchOpen=false;signature='';tick();},'arena-link'));else back(native);
      return;
    }
    heading('What should ' + name(own[index]) + ' do?');
    const grid=el('div','arena-moves');
    for(const source of nativeButtons(native,'.movemenu .movebutton[data-cmd]')) {
      const moveIndex=Number(source.dataset.cmd.split(' ')[1])-1;
      const requested=request.active[index]?.moves[moveIndex]; if(!requested)continue;
      const move=room.battle.dex.moves.get(requested.id || requested.name);
      const b=button('',nativeAction(source),'arena-move');copyDisabled(source,b);
      b.append(el('strong','',requested.name || move.name));
      const type=source.querySelector('.type')?.textContent || move.type;
      b.append(el('span','arena-move-meta',type+' · '+(requested.maxpp?requested.pp+'/'+requested.maxpp+' uses':'Automatic')));
      const desc=room.battle.dex.text?.get(move)?.shortDesc || move.shortDesc || '';
      if(desc)b.append(el('span','arena-move-description',desc));
      if(b.disabled)b.append(el('small','','Unavailable this turn'));
      grid.append(b);
    }
    controls.append(grid);
    for(const source of native.querySelectorAll('.megaevo-box input')) {
      const label=el('label','arena-mega'), check=el('input');check.type='checkbox';check.checked=source.checked;
      check.onchange=()=>{if(!source.isConnected)return;source.checked=check.checked;source.dispatchEvent(new Event('change',{bubbles:true}));signature='';};
      label.append(check,el('span','',source.closest('label').textContent.trim()));controls.append(label);
    }
    const switches=nativeButtons(native,'.switchmenu [data-cmd^="/switch "]');
    const change=button('Switch Pokémon',()=>{switchOpen=true;signature='';tick();},'arena-switch');
    change.disabled=!switches.some(b=>!b.disabled&&!['true','fade'].includes(b.getAttribute('aria-disabled')));controls.append(change);
    controls.append(el('p','arena-footnote',change.disabled?'No switch available for this Pokémon.':'Choose an action for each Pokémon.'));
    back(native);
  }
  function tick() {
    if(typeof PS==='undefined')return;
    const room=Object.values(PS.rooms).filter(r=>r.id.startsWith('battle-')).at(-1);
    if(!room?.battle)return;
    currentRoom=room;
    const root=document.getElementById('room-'+room.id), native=root?.querySelector('.battle-controls');
    if(!root)return;
    document.body.classList.add('arena-ready');
    document.body.classList.toggle('arena-preview',room.request?.requestType==='team');
    for(const other of document.querySelectorAll('.arena-current'))if(other!==root)other.classList.remove('arena-current');
    root.classList.add('arena-current');
    const decision=room.id+':'+room.request?.rqid+':'+room.choices?.index()+':'+Boolean(room.choices?.current.move);
    if(decision!==lastDecision){lastDecision=decision;switchOpen=false;}
    const key=JSON.stringify([decision,room.choices?.toString(),room.choices?.noCancel,room.battle.atQueueEnd,room.battle.ended,room.battle.turn,switchOpen,
      room.side?.pokemon?.map(p=>[p.name,p.hp,p.maxhp,p.status,p.fainted]),native?.innerHTML]);
    if(key!==signature){signature=key;render(room,native);}
    const log = room.battle.scene?.log?.innerElem;
    const text=log?.textContent || '';
    if(text!==logText){logText=text;historyBody.replaceChildren();for(const child of log?.children||[]) {const line=child.textContent.trim();if(line)historyBody.append(el('p','',line));}}
    syncStage();
    parent.postMessage({type:'jev-battle-phase',turn:room.battle.turn},location.origin);
  }
  setInterval(tick,150);tick();
})();
