const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const button = (text, fn, cls = 'text-button accent') => { const node = el('button', cls, text); node.type = 'button'; node.onclick = fn; return node; };
const paragraph = text => el('p', 'review-muted', text);
const percent = value => Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'Not scored';
const json = value => JSON.stringify(value, null, 2);
const prettyId = value => String(value || 'Unknown').replace(/^[a-z]+:/, '');
const escapeRE = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function reviewTimeline(decisions) {
  const counts = new Map();
  return decisions.map(d => {
    const occurrence = (counts.get(d.label) || 0) + 1; counts.set(d.label, occurrence);
    const turn = d.label.match(/^Turn (\d+)/)?.[1];
    const replacement = d.phase === 'force-switch' || /Replacement/.test(d.label);
    return { id: d.id, label: d.label + (occurrence > 1 ? ` · ${occurrence}` : ''),
      marker: turn || 'Start', caption: replacement ? `Replace${occurrence > 1 ? ` ${occurrence}` : ''}` : turn ? 'Turn' : 'Team', replacement };
  });
}
export function reviewSpecies(d, pokemon) {
  const rule = (d.rules || '').split('\n').find(line => line.startsWith(`${pokemon.name} (`));
  const name = rule?.match(/^[^(]+\(([^)]+)\);/)?.[1];
  const readable = name => name.replace(/^(.+)-Mega(?:-?([XY]))?$/i, (_, base, variant) => `Mega ${base}${variant ? ` ${variant.toUpperCase()}` : ''}`).replace(/^(.+)-Hisui$/, 'Hisuian $1').replace(/^Floette-?Eternal$/i, 'Floette (Eternal)');
  if (name) return readable(name);
  const species = pokemon.species || pokemon.name || 'Pokémon';
  if (species.toLowerCase().replace(/[^a-z0-9]/g, '') === pokemon.name?.toLowerCase().replace(/[^a-z0-9]/g, '')) return readable(pokemon.name);
  return readable(species.replace(/(?<!-)mega([xy])?$/i, '-Mega$1').replace(/(?<!-)hisui$/i, '-Hisui')
    .replace(/(^|-)([a-z])/g, (_, start, letter) => start + letter.toUpperCase()));
}
export function friendlyReviewText(d, value) {
  let text = String(value || '').replace(/p[12][ab]?: /g, '');
  for (const p of [...(d.position || [])].sort((a, b) => b.name.length - a.name.length)) {
    text = text.replace(new RegExp(`(^|[^A-Za-z])${escapeRE(p.name)}(?=$|[^A-Za-z])`, 'g'), (_, before) => before + reviewSpecies(d, p));
  }
  return text.replace(/(\d+)\/(\d+) HP/g, (_, hp, max) => `${Number(max) ? Math.round(Number(hp) / Number(max) * 100) : 0}% HP`)
    .replace(/\d+\.\d+%/g, n => `${Math.round(parseFloat(n))}%`).replace(/0 fnt HP/g, '0% HP')
    .replace(/RainDance/g, 'rain').replace(/SunnyDay/g, 'sunshine').replace(/Sandstorm/g, 'a sandstorm')
    .replace(/ -> /g, ' → ').replace(/^Trainer won the battle\.$/, 'You won the battle.')
    .replace(/^JevLocal won the battle\.$/, 'Jev won the battle.')
    .replace(/^-sideend · (.+?) · move: (.+)$/, '$2 ended on $1’s side.')
    .replace(/^-sidestart · (.+?) · move: (.+)$/, '$2 began on $1’s side.')
    .replace(/Trainer’s side/g, 'your side').replace(/JevLocal’s side/g, 'Jev’s side');
}
export function reviewActions(d, description) {
  return String(description || '').split('; ').map(action => {
    const plain = action.replace(/p[12][ab]?: /g, '');
    const [actor, ...rest] = plain.split(': '), command = rest.join(': ');
    const pokemon = (d.position || []).find(p => p.name === actor && p.side === 'Jev');
    const mega = command.endsWith(' (mega)');
    const [move, target] = command.replace(/ \(mega\)$/, '').split(' -> ');
    return { actor: friendlyReviewText(d, actor), species: pokemon?.species || '',
      move: move === 'pass' ? 'No action' : friendlyReviewText(d, move || actor), mega,
      detail: move === 'pass' ? (pokemon?.fainted ? 'Already knocked out' : 'No action available')
        : target ? ({ allAdjacentFoes: 'Targets both opponents', allAdjacent: 'Hits everyone nearby', allySide: 'Affects Jev’s side', allyTeam: 'Affects Jev’s team', foeSide: 'Affects your side', self: 'Targets itself', all: 'Affects the whole field' }[target]
          || `Target: ${friendlyReviewText(d, target)}`) : move === 'Protect' ? 'Protects itself this turn' : '',
      inactive: move === 'pass' };
  });
}
export function reviewHighlights(d, values, limit = 3) {
  const cleaned = [...new Set(values.map(line => friendlyReviewText(d, line)))].filter(line =>
    line && !/^Turn \d+ began/.test(line) && !line.startsWith('-') && !/resisted the hit|was super effective|HP\.$/.test(line));
  const important = cleaned.filter(line => /knocked out|won the battle|revealed|became|ended|Mega Evolved|weather|Weather/i.test(line));
  return (important.length ? important : cleaned).slice(-limit);
}
export function reviewSimulationLines(d, action) {
  const h = action?.highlights;
  if (!h?.hp?.length || d.simulation.status !== 'available') return [];
  const active = h.hp.filter(p => d.position.some(actor => actor.active && actor.name === p.name && actor.side === p.side));
  return active.filter(p => p.min < 100).slice(0, 3).map(p =>
    `${friendlyReviewText(d, p.name)}: ${Math.round(p.min)}${p.min === p.max ? '' : `–${Math.round(p.max)}`}% HP left`);
}
function actionTitle(description, tag = 'h3') {
  const title = el(tag);
  for (const action of String(description || 'Choice recorded').split('; ')) {
    let label = action.replace(/p[12][ab]?: /g, '').replace(/ -> /g, ' → ').replace(/allAdjacentFoes/g, 'both opponents').replace(/allAdjacent/g, 'all nearby Pokémon');
    if (label.endsWith(' (mega)')) label = label.slice(0, -7).replace(':', ' (Mega):');
    title.append(el('span', 'review-action-line', label));
  }
  return title;
}
function disclosure(title, content) { const d = el('details'); d.append(el('summary', '', title), content); return d; }
function lines(values, max) { const ul = el('ul', 'review-facts'); for (const value of max ? values.slice(-max) : values) ul.append(el('li', '', value)); return ul; }
function bar(label, value) {
  const box = el('div', 'review-score'); box.append(el('span', '', label), el('strong', '', percent(value)));
  if (Number.isFinite(value)) { const meter = el('div', 'review-meter'); const fill = el('span'); fill.style.width = `${Math.max(0, Math.min(100, value * 100))}%`; meter.append(fill); box.append(meter); }
  return box;
}

export function createDecisionExplorer() {
  const $ = id => document.getElementById(id);
  const panel = $('inside-jev'), panelBody = $('inside-content'), dialog = $('review-dialog'), dialogBody = $('review-content');
  let status = {}, visible = false, teaching = false, index = null, detail = null, selectedId = '', selectedBattle = '';
  let generation = 0, signature = '', busy = false, pollTimer;
  function query(extra = {}) { return new URLSearchParams({ battle: selectedBattle || status.battleId || '', teaching: teaching ? '1' : '0', ...extra }); }
  async function get(extra) {
    const response = await fetch(`/api/decisions?${query(extra)}`);
    if (!response.ok) throw new Error('This decision is not available yet.');
    return response.json();
  }
  function tag(text, cls = '') { return el('span', `review-tag ${cls}`, text); }
  function moveCards(d, description) {
    if (d.phase === 'team-preview') {
      const box = el('div', 'review-team-choice');
      const text = friendlyReviewText(d, description).replace('Leads:', 'Starts with:').replace('reserves in order:', 'On the bench:');
      for (const line of text.split('; ')) box.append(el('p', '', line));
      return box;
    }
    const box = el('div', 'review-move-list');
    for (const move of reviewActions(d, description)) {
      if (move.inactive) { box.append(el('p', 'review-pass', `${move.actor}: ${move.detail.toLowerCase()}.`)); continue; }
      const card = el('div', 'review-move-row');
      if (move.species) {
        const img = el('img'); img.alt = ''; img.width = 52; img.height = 52;
        const sprite = move.species.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/(?<!-)mega([xy])?$/, '-mega$1').replace(/(?<!-)hisui$/, '-hisui');
        img.src = `https://play.pokemonshowdown.com/sprites/gen5/${sprite}.png`;
        img.onerror = () => { img.hidden = true; }; card.append(img);
      }
      const copy = el('div'); copy.append(el('span', 'review-actor', move.actor + (move.mega ? ' · Mega Evolution' : '')), el('strong', 'review-move-name', move.move));
      if (move.detail) copy.append(el('span', 'review-target', move.detail));
      card.append(copy); box.append(card);
    }
    return box;
  }
  function section(title, facts, empty) {
    const box = el('section', 'review-story-section'); box.append(el('h3', '', title));
    box.append(facts.length ? lines(facts) : paragraph(empty)); return box;
  }
  function simulationSummary(d, action) {
    const box = el('div', 'review-simple-sim');
    if (d.phase === 'team-preview') return box;
    if (d.simulation.status !== 'available') { box.append(paragraph('No simulation was available for this choice.')); return box; }
    const facts = reviewSimulationLines(d, action);
    box.append(el('h4', '', 'In hypothetical simulations'), facts.length ? lines(facts) : paragraph('See the recorded results in the detailed evidence.'));
    return box;
  }
  function story(d) {
    const box = el('div', 'review-story');
    const choice = el('section', 'review-story-choice'); choice.append(el('h3', '', d.mode === 'Jev' ? 'Jev’s choice' : 'Scripted test choice'), moveCards(d, d.choice.description));
    if (Number.isFinite(d.choice.probability)) choice.append(paragraph(`${percent(d.choice.probability)} final preference`));
    if (d.simulation.status === 'available') choice.append(simulationSummary(d, d.actions.find(action => action.chosen)));
    box.append(choice, section('What Jev saw', reviewHighlights(d, d.observed, 2), d.phase === 'team-preview' ? 'Both teams were visible at team preview.' : 'The recorded position is available under Data & exact inputs.'));
    box.append(section('What happened next', reviewHighlights(d, d.outcome, 3), 'The full battle events are in the detailed evidence.'));
    return box;
  }
  function suppliedRules(d) {
    const moves = reviewActions(d, d.choice.description).map(a => a.move);
    const relevant = (d.rules || '').split('\n').filter(line => moves.some(move => line.startsWith(`${move}:`)));
    const box = el('div');
    box.append(paragraph('These rules were supplied to Jev. They do not tell us which rule determined its choice.'));
    for (const rule of relevant.slice(0, 2)) {
      const [name, ...rest] = rule.split(':'); const item = el('div', 'review-rule');
      item.append(el('strong', '', name), paragraph(rest.join(':'))); box.append(item);
    }
    if (!relevant.length) box.append(paragraph('The complete context is available under Data & exact inputs.'));
    return disclosure('Rules behind the moves', box);
  }
  function exactInputs(d) {
    const box = el('div');
    box.append(paragraph('The actual model, state and questions sent at this step. No new model call is made. “You” in these inputs means Jev.'));
    const select = el('select'); select.setAttribute('aria-label', 'Model request');
    for (const request of d.requests) select.add(new Option(`${request.stage} · ${request.id}`, request.id));
    select.value = d.finalRequest || d.requests.at(-1)?.id || '';
    const pre = el('pre', 'review-code', 'Choose “Load input” to inspect the full request.');
    let loadId = 0;
    const load = button('Load input', async () => {
      const token = ++loadId, oldGeneration = generation;
      pre.textContent = 'Loading the recorded input…';
      try { const data = await get({ decision: d.id, request: select.value }); if (token === loadId && oldGeneration === generation) pre.textContent = json(data); }
      catch (error) { if (token === loadId) pre.textContent = error.message; }
    });
    load.disabled = !d.requests.length;
    select.onchange = () => { loadId++; pre.textContent = 'Choose “Load input” to inspect this request.'; };
    box.append(select, load, pre); return disclosure('Exact model inputs', box);
  }
  function context(d) {
    const box = el('div', 'review-context');
    box.append(el('h3', '', 'What Jev received'));
    const facts = el('div');
    facts.append(tag('Observed'), lines(d.observed.length ? d.observed : ['Team preview. The full visible information is in the recorded input below.'], 5));
    if (d.observed.length > 5) facts.append(disclosure('More recent observations', lines(d.observed)));
    box.append(facts);
    const rules = el('pre', 'review-prose', d.rules || 'No V4 rule text was delivered for this decision. Inspect the exact input for its available context.');
    box.append(disclosure('Rules and position supplied · V4', rules));
    if (d.teamBrief) {
      const resources = d.teamBrief.resources || [];
      const resourcesBox = el('div');
      const names = Object.fromEntries(d.position.map(p => [p.id, p.name]));
      resourcesBox.append(lines(resources.map(r => `${names[r.actor] || r.actor}: ${r.text}`)));
      if (d.teamBrief.links?.length) resourcesBox.append(paragraph('Team relationships are Jev hypotheses, not confirmed active effects.'), el('pre', 'review-code', json(d.teamBrief.links)));
      box.append(disclosure('Jev’s team brief', resourcesBox));
    }
    if (d.memoryChanges.length) box.append(disclosure('Battle memory updates', el('pre', 'review-code', json(d.memoryChanges))));
    const assumptions = el('div');
    assumptions.append(paragraph('Possible opponent sets and unknown values used by the simulator. These were not revealed in the battle.'));
    for (const world of d.simulation.assumptions) assumptions.append(disclosure(world.id, lines(world.assumptions || [])));
    if (d.simulation.assumptions.length) box.append(disclosure('Simulation assumptions', assumptions));
    if (d.simulation.brief) {
      box.append(disclosure('Exact simulation brief delivered', el('pre', 'review-code', json(d.simulation.brief))));
    }
    box.append(exactInputs(d)); return box;
  }
  function outcome(d) {
    const box = el('section', 'review-outcome'); box.append(el('h3', '', 'What actually happened'));
    box.append(lines(d.outcome.length ? d.outcome : ['No public result was recorded.']));
    box.append(paragraph('Public events after submission, through the next turn or battle end. Simulation branches can stop earlier, at a replacement.'));
    box.append(disclosure('Public Showdown log', el('pre', 'review-code', d.outcomeLog.join('\n')))); return box;
  }
  function simulationNote(d) {
    const box = el('div', 'review-sim-note');
    if (d.simulation.status !== 'available') {
      box.append(tag('No simulation evidence', 'amber'), paragraph(d.phase === 'team-preview' ? 'Team selection uses its own decision process.' : 'Jev made this choice using the other available context.'));
      if (d.simulation.reasons.length) box.append(disclosure('Why it was unavailable', lines(d.simulation.reasons)));
    } else {
      const c = d.simulation.coverage || {};
      box.append(tag('Hypothetical outcomes', 'amber'), paragraph(`${c.simulatedBranches ?? '—'} resolved branches · ${c.hypothesisCount ?? '—'} hypotheses`), paragraph(`Failed: ${c.failedBranches ?? 0} · Omitted: ${c.omittedBranches ?? 0}. Tested branches are not win probabilities.`));
    }
    return box;
  }
  function cards(d) {
    const grid = el('div', 'review-card-grid');
    for (const action of d.actions.filter(a => !a.chosen).sort((a, b) => (b.finalProbability ?? -1) - (a.finalProbability ?? -1))) {
      const card = el('article', 'review-card');
      const top = el('div', 'review-card-top'); top.append(tag('Alternative', 'neutral'));
      top.append(el('span', 'review-preference', percent(action.finalProbability))); card.append(top);
      card.append(moveCards(d, action.description));
      if (d.simulation.status === 'available') card.append(simulationSummary(d, action));
      grid.append(card);
    }
    return grid;
  }
  function position(d) {
    const box = el('div', 'review-position');
    for (const side of ['You', 'Jev']) {
      const group = el('section'); group.append(el('h3', '', side));
      for (const p of d.position.filter(p => p.side === side && p.active)) {
        const pokemon = el('div', 'review-pokemon');
        const hp = p.hp?.exact ? `${p.hp.exact.current}/${p.hp.exact.max} HP` : p.hp?.percent !== null && p.hp?.percent !== undefined ? `${p.hp.percent}% HP` : 'HP unknown';
        pokemon.append(el('strong', '', reviewSpecies(d, p)), el('span', '', friendlyReviewText(d, `${hp}${p.status ? ` · ${p.status}` : ''}${p.fainted ? ' · Fainted' : ''}`)));
        const facts = [`Moves: ${(p.moves || []).map(prettyId).join(', ') || 'Unknown'}`, `Ability: ${prettyId(p.ability)}`, `Item: ${p.item?.status === 'none' ? 'None' : prettyId(p.item?.cardId)}`];
        pokemon.append(disclosure('Known details', lines(facts))); group.append(pokemon);
      }
      box.append(group);
    }
    if (!d.position.length) box.append(paragraph('No structured position is available. The original input is preserved below.'));
    return box;
  }
  function selectors() {
    const wrap = el('nav', 'review-timeline'); wrap.setAttribute('aria-label', 'Battle timeline');
    const strip = el('ol', 'review-timeline-strip');
    for (const item of reviewTimeline(index?.decisions || [])) {
      const li = el('li', 'review-timeline-step');
      const point = button('', () => selectDecision(item.id, true), 'review-timeline-point');
      point.dataset.decision = item.id; point.setAttribute('aria-label', item.label);
      if (item.id === selectedId) point.setAttribute('aria-current', 'step');
      point.append(el('span', `review-timeline-dot${item.replacement ? ' replacement' : ''}`, item.marker), el('span', 'review-timeline-caption', item.caption));
      li.append(point); strip.append(li);
    }
    if (!strip.children.length) wrap.append(paragraph('The timeline will appear after a decision resolves.'));
    else wrap.append(strip);
    return wrap;
  }
  function revealTimeline(root, focus = false) {
    const strip = root.querySelector('.review-timeline-strip');
    const current = strip?.querySelector('[aria-current="step"]');
    if (!current) return;
    strip.scrollLeft += current.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - current.offsetWidth) / 2;
    if (focus) current.focus({ preventScroll: true });
  }
  function turnReview(d) {
    const box = el('div', 'review-unified');
    const label = index?.decisions.find(item => item.id === d.id)?.label || 'Decision';
    box.append(el('h3', 'review-turn-title', label), paragraph('Preference scores are not the chance of winning.'));
    box.append(story(d));
    if (d.actions.some(a => !a.chosen)) {
      const alternatives = el('section', 'review-alternatives'); alternatives.append(el('h3', '', 'Other options Jev considered'), cards(d)); box.append(alternatives);
    }
    box.append(suppliedRules(d), advanced(d)); return box;
  }
  function advanced(d) {
    const box = el('div', 'review-advanced-body');
    box.append(paragraph('Recorded evidence, not a generated account of Jev’s thoughts.'));
    box.append(paragraph(`${d.originalCount} legal options · ${d.elapsedMs == null ? 'Timing unavailable' : `${(d.elapsedMs / 1000).toFixed(1)} seconds to decide`}. Provider confidence: ${percent(d.choice.confidence)}; this is not a measure of correctness.`));
    const scores = el('div');
    scores.append(paragraph('Each score belongs to its own menu. Initial and final percentages are not directly comparable or chances of winning.'));
    for (const action of d.actions) {
      scores.append(actionTitle(friendlyReviewText(d, action.description), 'h4'));
      scores.append(bar(d.initial ? `Initial comparison · ${d.initial.offeredIds.length} options` : 'Initial · no common distribution', action.initialProbability), bar(`Final · ${d.finalCount} options`, action.finalProbability));
    }
    box.append(disclosure('All preference scores', scores), simulationNote(d), context(d), outcome(d));
    box.append(disclosure('Position before the choice', position(d)));
    if ((index?.battles.length || 0) > 1) {
      const games = el('div'), select = el('select'); select.setAttribute('aria-label', 'Battle to review');
      index.battles.forEach((battle, i) => select.add(new Option(`Game ${i + 1}${battle.ended ? ' · Finished' : ' · Playing'}`, battle.id)));
      select.value = index.battle.id;
      select.onchange = () => { selectedBattle = select.value; generation++; selectedId = ''; detail = null; signature = ''; refresh(true); };
      games.append(select); box.append(disclosure('Earlier games', games));
    }
    return disclosure('Data & exact inputs', box);
  }
  function renderPanel() {
    panelBody.replaceChildren();
    if (!index?.battle) { panelBody.append(paragraph('Play a battle to explore Jev’s decisions here.')); return; }
    if (index.battle.mode !== 'Jev') panelBody.append(tag('Offline test', 'amber'));
    if (index.locked) { panelBody.append(el('h3', '', 'See the story behind each turn'), paragraph(window.jevPublicArena
      ? 'Finish the battle to explore Jev’s choices, context, and simulations. The review stays private to your browser.'
      : 'Turn on live insights above to follow along. Otherwise, the review opens after the game.')); return; }
    if (!detail) { panelBody.append(paragraph('The first decision will appear after it resolves in the battle.')); return; }
    panelBody.append(selectors(), button('Expand review', () => openDialog(), 'text-button accent'), turnReview(detail));
    revealTimeline(panelBody);
  }
  function renderDialog() {
    if (!dialog.open) return;
    $('review-title').textContent = 'Inside Jev';
    dialogBody.replaceChildren();
    if (index?.battle?.ended) dialogBody.append(el('p', 'review-result', friendlyReviewText(detail || {}, index.battle.result)));
    dialogBody.append(selectors());
    if (!detail || index?.locked) { dialogBody.append(paragraph('No resolved decisions are available in this mode yet.')); return; }
    const d = detail;
    if (d.mode !== 'Jev') dialogBody.append(tag('Offline test · no Jev inference', 'amber'));
    dialogBody.append(turnReview(d));
    revealTimeline(dialogBody);
  }
  function openDialog() { if (!dialog.open) dialog.showModal(); renderDialog(); }
  async function reviewBattle(battleId = status.battleId) {
    generation++; selectedBattle = battleId || ''; selectedId = ''; detail = null; index = null; signature = '';
    openDialog(); dialogBody.replaceChildren(paragraph('Loading the battle review…'));
    dialog.scrollTop = 0;
    await refresh(true, true);
  }
  async function selectDecision(id, userSelected = false) {
    selectedId = id; const token = ++generation; detail = null;
    try { const data = await get({ decision: id }); if (token !== generation) return; detail = data; renderPanel(); renderDialog();
      if (userSelected) { const root = dialog.open ? dialogBody : panelBody; (dialog.open ? dialog : panel).scrollTop = 0; revealTimeline(root, true); }
    }
    catch (error) { if (token === generation) { panelBody.replaceChildren(paragraph(error.message)); dialogBody.replaceChildren(paragraph(error.message)); } }
  }
  async function refresh(force = false, fromStart = false) {
    if (busy && !force) return;
    busy = true; const token = generation;
    try {
      const data = await get({}); if (token !== generation) return;
      const followLatest = !selectedId || (!dialog.open && selectedId === index?.decisions?.at(-1)?.id);
      index = data; $('inside-open').hidden = !visible && !data.battles.length;
      const nextSignature = json({ battle: data.battle, battles: data.battles, decisions: data.decisions, locked: data.locked });
      if (force || nextSignature !== signature) {
        signature = nextSignature;
        if (fromStart || followLatest || !data.decisions.some(d => d.id === selectedId)) selectedId = (fromStart ? data.decisions[0] : data.decisions.at(-1))?.id || '';
        if (selectedId) await selectDecision(selectedId); else { detail = null; renderPanel(); renderDialog(); }
      }
    } catch { const message = 'Decision review is disconnected. Your battle controls remain available.'; panelBody.replaceChildren(paragraph(message)); if (dialog.open) dialogBody.replaceChildren(paragraph(message)); }
    finally { busy = false; }
  }
  $('inside-open').onclick = () => {
    if (!visible || status.state === 'ended') { openDialog(); refresh(true); return; }
    panel.hidden = !panel.hidden; $('inside-open').setAttribute('aria-expanded', String(!panel.hidden));
    $('battle-workspace').classList.toggle('with-review', !panel.hidden);
    if (!panel.hidden) { $('inside-title').focus(); refresh(true); }
  };
  $('inside-close').onclick = () => { panel.hidden = true; $('battle-workspace').classList.remove('with-review'); $('inside-open').setAttribute('aria-expanded', 'false'); $('inside-open').focus(); };
  $('review-close').onclick = () => dialog.close();
  $('teaching-mode').onchange = () => { teaching = $('teaching-mode').checked; generation++; detail = null; selectedId = ''; signature = ''; renderPanel(); refresh(true); };
  return {
    reviewBattle,
    visible(show) { visible = show; $('battle-workspace').hidden = !show; if (!show) { panel.hidden = true; $('battle-workspace').classList.remove('with-review'); $('inside-open').setAttribute('aria-expanded', 'false'); } },
    update(next) {
      if (status.battleId !== next.battleId) { generation++; selectedBattle = ''; selectedId = ''; detail = null; signature = ''; }
      status = next; $('inside-open').hidden = !status.battleId && !index?.battles?.length;
      clearTimeout(pollTimer); pollTimer = setTimeout(() => refresh(), 50);
    },
  };
}
