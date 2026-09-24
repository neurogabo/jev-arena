import { resolveTeamSelection, teamLabel } from '/demo-selection.js';
import { createDecisionExplorer } from '/inside-jev.js';
const $ = id => document.getElementById(id);
const sides = ['human', 'jev'];
const selectors = Object.fromEntries(sides.map(side => [side, $(side + '-team')]));
const game = $('game');
const decisionExplorer = createDecisionExplorer();
let catalog = [], clientReady = false, serverReady = false, loading = true, starting = false, status = {};
let previousBattle = '', startTimer, catalogError = '', bridgeError = '';
function controls() {
  $('play').disabled = !clientReady || !serverReady || !catalog.some(t => t.enabled) || starting || loading;
  $('swap-teams').disabled = loading || starting;
  $('random-teams').disabled = loading || starting || !catalog.some(t => t.enabled);
  for (const selector of Object.values(selectors)) selector.disabled = loading || starting;
  $('retry').hidden = status.state !== 'recoverable-error';
  $('reload').hidden = !catalogError && !bridgeError && serverReady && clientReady;
  $('review-last-battle').hidden = !serverReady || starting || status.state !== 'ended' || !status.battleId;
  if ($('end-match')) $('end-match').hidden = !status.battleId || status.state === 'ended' || $('battle-shell').hidden;
}
function message() {
  if (catalogError || bridgeError) return catalogError || bridgeError;
  if (starting) return 'Preparing your battle…';
  if (!serverReady || !clientReady) return 'Connecting to the arena…';
  if (status.mode !== 'Jev') return 'Test mode — scripted opponent, no API calls.';
  return '';
}
function teamDetails() {
  for (const side of sides) {
    const team = catalog.find(t => t.id === selectors[side].value);
    const random = selectors[side].value === 'random';
    $(side + '-detail').textContent = random ? 'A tournament team, drawn when you play.' : !team ? '' : typeof team.placement === 'string' ? team.placement : 'Masters · Standings #' + team.placement;
    const roster = $(side + '-roster'); roster.replaceChildren();
    for (const species of team?.species || Array(6).fill(null)) {
      const li = document.createElement('li'), wrap = document.createElement('span'), label = document.createElement('span');
      wrap.className = 'sprite-wrap'; label.className = 'species-name';
      if (species) {
        const img = document.createElement('img'); img.alt = ''; img.width = 96; img.height = 96;
        img.src = 'https://play.pokemonshowdown.com/sprites/gen5/' + species.toLowerCase().replace(/[^a-z0-9-]/g, '') + '.png';
        img.onerror = () => { img.remove(); const fallback = document.createElement('span'); fallback.className='random-sprite'; fallback.textContent=species.slice(0,1); wrap.append(fallback); };
        wrap.append(img); label.textContent = species === 'Floette-Eternal' ? 'Floette (Eternal)' : species;
      } else {
        const placeholder = document.createElement('span'); placeholder.className = 'random-sprite'; placeholder.textContent = '?'; placeholder.setAttribute('aria-hidden','true'); wrap.append(placeholder);
        label.textContent = 'Pokémon ' + (roster.children.length + 1);
      }
      li.append(wrap, label); roster.append(li);
    }
    const source = $(side + '-source'); source.hidden = !team;
    if (team) source.href = team.sourceUrl;
    $(side + '-training').textContent = random ? 'Drawn from ' + catalog.filter(t => t.enabled).length + ' validated teams' : team?.reconstructedTraining ? 'Training points reconstructed from the wiki' : 'Published training points';
  }
  try { localStorage.setItem('jev-local-catalog-selection', JSON.stringify(Object.fromEntries(sides.map(side => [side, selectors[side].value])))); } catch {}
}
function showBattle(show) {
  decisionExplorer.visible(show);
  $('lobby').hidden = show; $('battle-shell').hidden = !show; game.hidden = !show;
  $('new-game').hidden = !show;
  document.body.classList.toggle('in-battle', show);
  if (show) game.contentWindow.postMessage({type:'jev-focus-battle'}, location.origin);
}
function begin() {
  if ($('play').disabled) return;
  bridgeError = '';
  try {
    const selected = Object.fromEntries(sides.map(side => [side, resolveTeamSelection(catalog, selectors[side].value)]));
    for (const side of sides) selectors[side].value = selected[side].id;
    teamDetails();
    $('assigned-teams').textContent = 'You: ' + teamLabel(selected.human) + '  /  Jev: ' + teamLabel(selected.jev);
    previousBattle = status.battleId || ''; starting = true; controls(); showBattle(true);
    $('status').textContent = 'Preparing your battle…';
    game.contentWindow.postMessage({type:'jev-local-command',command:'/jevreset ' + selected.human.id + ',' + selected.jev.id},location.origin);
    clearTimeout(startTimer); startTimer = setTimeout(() => {
      if (!starting) return;
      starting = false; bridgeError = 'The battle did not start. Reconnect and try again.'; showBattle(false); $('lobby-status').textContent = message(); controls();
    },20000);
  } catch(error) { bridgeError = error.message; $('lobby-status').textContent = message(); controls(); }
}
$('play').onclick = begin;
for (const select of Object.values(selectors)) select.onchange = teamDetails;
$('swap-teams').onclick = () => { const value = selectors.human.value; selectors.human.value = selectors.jev.value; selectors.jev.value = value; teamDetails(); };
$('random-teams').onclick = () => {
  for (const side of sides) selectors[side].value = resolveTeamSelection(catalog, 'random').id;
  teamDetails();
  $('lobby-status').textContent = 'Random teams selected for you and Jev. Ready when you are.';
};
$('about-open').onclick = () => $('about').showModal();
$('about-close').onclick = () => $('about').close();
$('new-game').onclick = () => { if (status.state === 'ended') showBattle(false); else $('leave-dialog').showModal(); };
$('keep-playing').onclick = () => $('leave-dialog').close();
$('choose-again').onclick = () => { $('leave-dialog').close(); showBattle(false); };
$('retry').onclick = () => game.contentWindow.postMessage({type:'jev-local-command',command:'/jevretry'},location.origin);
$('reload').onclick = () => location.reload();
$('review-last-battle').onclick = () => decisionExplorer.reviewBattle(status.battleId);
window.addEventListener('message',event => {
  if(event.origin !== location.origin || event.source !== game.contentWindow) return;
  if(event.data?.type === 'jev-client-ready') { clientReady=Boolean(event.data.ready); controls(); }
  if(event.data?.type === 'jev-client-error') {
    bridgeError = String(event.data.message || 'Unable to start the battle.');
    if(starting) { starting=false; clearTimeout(startTimer); showBattle(false); }
    $('lobby-status').textContent=message(); controls();
  }
  if(event.data?.type === 'jev-client-home' && (!window.jevPublicArena || (!starting && status.state === 'ended'))) showBattle(false);
  if(event.data?.type === 'jev-public-resume' && window.jevPublicArena) showBattle(true);
  if(event.data?.type === 'jev-review-decisions' && status.state === 'ended' && event.data.battleId === status.battleId) decisionExplorer.reviewBattle(status.battleId);
  if(event.data?.type === 'jev-battle-phase' && !starting && serverReady && !['recoverable-error','invalid-observation','invalid-assignment','disconnected','ended'].includes(status.state)) {
    const turn = Number(event.data.turn);
    const label = Number.isSafeInteger(turn) && turn > 0 ? 'Turn ' + turn : 'Choose your four Pokémon';
    if ($('status').textContent !== label) $('status').textContent = label;
  }
});
async function loadCatalog() {
  const response=await fetch('/api/teams'); if(!response.ok) throw new Error('Unable to load teams. Please reconnect.');
  const data=await response.json(); catalog=data.teams;
  let stored={};try{stored=JSON.parse(localStorage.getItem('jev-local-catalog-selection')||'{}')||{};}catch{}
  for(const side of sides) {
    const select=selectors[side]; select.replaceChildren(new Option('Random team','random'));
    for(const event of ['worlds-2026', 'baltimore-2027', 'other']) {
      const entries=catalog.filter(t => event === 'worlds-2026' ? t.event?.startsWith(event) : event==='other' ? !t.event?.startsWith('worlds-2026') && t.event!=='baltimore-2027' : t.event===event);
      if(!entries.length) continue;
      const group=document.createElement('optgroup');group.label=event==='worlds-2026'?'World Championships 2026':event==='baltimore-2027'?'Baltimore Regional 2027':'Other teams';
      for(const team of entries){const option=new Option(teamLabel(team)+(team.enabled?'':' · unavailable'),team.id);option.disabled=!team.enabled;group.append(option);}
      select.append(group);
    }
    const wanted=stored[side]||(side==='human'?'worlds-takuma':'worlds-vikram');
    select.value=wanted==='random'||catalog.some(t=>t.id===wanted&&t.enabled)?wanted:'random';
  }
  $('catalog-summary').textContent=catalog.filter(t=>t.enabled).length+' teams: all 13 Masters top-cut teams from Worlds 2026, the Seniors champion, and Baltimore 2027’s top ten. Worlds teams are checked for compatibility with Regulation M-C.';
  loading=false;teamDetails();controls();
}
async function poll() {
  try{
    const response=await fetch('/api/status');if(!response.ok)throw new Error(); status=await response.json();
    decisionExplorer.update(status);
    serverReady=!['starting','disconnected'].includes(status.state);
    if(starting && status.battleId && status.battleId!==previousBattle){starting=false;clearTimeout(startTimer);}
    const labels={ready:'Ready to play.', 'assigning-teams':'Preparing your teams…', 'team-preview':'Choose four Pokémon. Your first two will lead.', preparing:'Jev is deciding…', sent:'Jev has chosen. Make your move in the battle below.', ended:'Battle finished. Ready for a rematch?', 'recoverable-error':'Jev could not complete this decision. Use Retry Jev to try again.', 'invalid-observation':'The battle state could not be read safely. Please start a new battle.', 'invalid-assignment':'The teams could not be assigned. Please start a new battle.', disconnected:'Disconnected. Reconnect to continue.'};
    if(starting || ['queued','recoverable-error','invalid-observation','invalid-assignment','disconnected','ended'].includes(status.state)) $('status').textContent=starting?'Preparing your battle…':status.publicArena && status.message ? status.message : labels[status.state];
    $('context-text').textContent=status.contextSummary||'Context will appear after team selection.';
    const closed=status.opponentInformation==='revealed-only';
    $('information-policy').textContent=closed?'Your selected four and unrevealed sets stay hidden from Jev.':'Open-team mode: Jev can see your published sets and selected four.';
    $('about-policy').textContent=closed?'Jev knows its own team and your six species. Your selected four, moves, items, abilities and training stay hidden until the battle reveals information about them.':'This historical mode shares published sets and your selected four with Jev.';
    $('mode-detail').textContent=(status.mode==='Jev'?'Live Jev decisions. ':'Scripted offline test; no Jev inference. ')+(closed?(status.hiddenSetSimulation?'Jev retrieves rules, uses a team brief and battle memory, then shortlists four actions. It compares simulations against plausible opponent sets inferred from the wiki and public reveals. These sets are assumptions, never private team data. Unsupported positions use a decision without simulation.':'V4 retrieves relevant rules, adds a team brief and battle memory, then Jev narrows its choices and makes the final decision. Simulation is disabled for unknown opponent sets in this baseline mode.'):'The active experiment uses the configured context and simulation pipeline.');
  }catch{serverReady=false;$('status').textContent='The server is disconnected. Reconnect to continue.';}
  $('lobby-status').textContent=message();controls();setTimeout(poll,1000);
}
loadCatalog().catch(error=>{catalogError=error.message;loading=false;$('lobby-status').textContent=message();controls();});
poll();
