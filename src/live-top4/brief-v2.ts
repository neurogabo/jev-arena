import assert from 'node:assert/strict';
import { buildConsequenceBrief, type ConsequenceBrief } from './brief.js';
import type { ConsequenceReport, SimBranch, SimObservation, SimPosition } from '../sim-v1/types.js';

/** V2 expands named evidence; callers must additionally enforce their complete request budget. */
export const MAX_CONSEQUENCE_BRIEF_V2_BYTES = 40_000;

type Outcome = 'ownWin' | 'ownLoss' | 'continues' | 'terminalUnknown';
type Roster = { own: string[]; opponent: string[]; named: Map<string, { name: string; fainted: boolean }> };
type SafeResponse = ConsequenceBrief['actions'][number]['responses'][number];

function publicText(value: unknown): string {
  assert.ok(typeof value === 'string' && value.length <= 512 && !/[\r\n\0]/.test(value), 'Malformed public brief text.');
  return value;
}

/** Read only identified participants and already-observed faint/name information. */
function rosterFrom(observation: SimObservation): Roster {
  const state = observation.input.state;
  const ids = (value: unknown): string[] => {
    if (value === undefined || value === null) return [];
    assert.ok(Array.isArray(value) && value.length <= 6, 'Malformed identified participant roster.');
    const result = value.map(publicText);
    assert.equal(new Set(result).size, result.length, 'Duplicate identified participant.');
    return result;
  };
  const own = ids(state.ownSelectedIds), opponent = ids(state.opponentSelectedIds);
  assert.ok(!own.some(id => opponent.includes(id)), 'Participant appears on both sides.');
  const selected = new Set([...own, ...opponent]);
  const named: Roster['named'] = new Map();
  assert.ok(Array.isArray(state.pokemon), 'Observed participant names are required.');
  for (const value of state.pokemon) {
    const pokemon = value as Record<string, unknown>;
    if (!selected.has(pokemon.id as string)) continue;
    const id = publicText(pokemon.id);
    assert.ok(!named.has(id), 'Duplicate observed participant.');
    named.set(id, { name: publicText(pokemon.name), fainted: pokemon.fainted === true });
  }
  return { own, opponent, named };
}

/** A terminal flag alone, absent actors, or zero HP on both sides never identifies a winner. */
function classify(position: SimPosition, roster: Roster): Outcome {
  assert.ok(typeof position.battleEnded === 'boolean' && typeof position.pendingReplacement === 'boolean',
    'Malformed public terminal or replacement flag.');
  assert.ok(position.pokemon.every(p => typeof p.fainted === 'boolean' && typeof p.active === 'boolean'),
    'Malformed public faint or activity flag.');
  if (position.battleEnded !== true) return 'continues';
  if (position.pokemon.some(p => !(p.side === 'own' ? roster.own : roster.opponent).includes(p.id))) return 'terminalUnknown';
  const complete = (ids: string[], side: 'own' | 'opponent') => ids.length > 0 && ids.every(id =>
    roster.named.has(id) && position.pokemon.some(p => p.id === id && p.side === side));
  const own = position.pokemon.filter(p => roster.own.includes(p.id) && p.side === 'own');
  const foe = position.pokemon.filter(p => roster.opponent.includes(p.id) && p.side === 'opponent');
  const alive = (pokemon: typeof own[number]) => pokemon.fainted === false && pokemon.hpPercent > 0;
  const dead = (pokemon: typeof own[number]) => pokemon.fainted === true && pokemon.hpPercent === 0;
  if (!complete(roster.own, 'own')) return 'terminalUnknown';
  if (complete(roster.opponent, 'opponent') && own.some(alive) && foe.every(dead)) return 'ownWin';
  if (own.every(dead) && foe.some(alive)) return 'ownLoss';
  return 'terminalUnknown';
}

function outcomes(branches: SimBranch[], roster: Roster, omitted = 0, hypothetical?: Map<string, Roster>) {
  const counts = { ownWin: 0, ownLoss: 0, continues: 0, terminalUnknown: 0, unresolved: 0, omitted };
  for (const branch of branches) {
    if (branch.status !== 'simulated' || !branch.position) counts.unresolved++;
    else counts[classify(branch.position, hypothetical?.get(branch.hypothesisId) ?? roster)]++;
  }
  const labels: Record<Outcome, string> = { ownWin: 'your side wins', ownLoss: 'your side loses',
    continues: 'battle continues', terminalUnknown: 'battle ends but winner is unresolved' };
  const parts = (Object.keys(labels) as Outcome[]).filter(key => counts[key]).map(key => `${labels[key]} in ${counts[key]}`);
  const summary = `In resolved tested branches: ${parts.join('; ') || 'none resolved'}.` +
    (counts.unresolved || omitted ? ` UNKNOWN: ${counts.unresolved} failed and ${omitted} omitted branches.` : '');
  return { summary, ...counts };
}

function inResponse(branch: SimBranch, response: SafeResponse) {
  return branch.opponentAction === response.opponentCommand && (branch.horizon ?? 'unknown') === response.horizon &&
    (branch.replacementTiming ?? null) === response.replacementTiming;
}

const interval = (values: [number, number]) => values[0] === values[1] ? `${values[0]}` : `${values[0]}..${values[1]}`;

/** V2 changes evidence presentation only: no new simulations, ranking, probabilities or recommendations. */
export function buildConsequenceBriefV2(report: ConsequenceReport, observation: SimObservation) {
  const safe = buildConsequenceBrief(report);
  const roster = rosterFrom(observation);
  const hypothetical = new Map<string, Roster>();
  for (const [key, members] of Object.entries(report.hypothesisRosters ?? {})) {
    assert.ok(report.assumptions.some(h => h.id === key) && members.length === 8 && new Set(members.map(m => m.id)).size === 8,
      'Malformed hypothetical roster.');
    const own = members.filter(m => m.side === 'own').map(m => publicText(m.id));
    const opponent = members.filter(m => m.side === 'opponent').map(m => publicText(m.id));
    assert.ok(own.length === 4 && opponent.length === 4 && own.every(id => roster.own.includes(id)), 'Hypothetical roster changed own participants.');
    hypothetical.set(key, { own, opponent, named: new Map(members.map(m => [m.id, { name: publicText(m.name), fainted: m.initiallyFainted }])) });
  }
  const declaredHypotheses = [...new Set(report.assumptions.map(hypothesis => publicText(hypothesis.id)))];
  const actor = (id: string) => {
    const info = safe.actors[id];
    assert.ok(info, 'Public endpoint references an unknown actor.');
    return `${info.side === 'own' ? 'Your' : 'Opponent'} ${info.name} [${id}]`;
  };
  const allBranches = report.actions.flatMap(action => action.branches);
  const resolved = allBranches.filter(branch => branch.status === 'simulated');
  // A missing actor is never treated as fainted. New faints and any possible revival stay visible.
  const omittedUnchanged = new Set([...roster.named].filter(([id, initial]) => initial.fainted && resolved.length > 0 &&
    allBranches.length === resolved.length && !report.actions.some(action => action.omittedBranches > 0) &&
    resolved.every(branch => branch.position!.pokemon.some(p => p.id === id && p.fainted && p.hpPercent === 0)) &&
    safe.pokemonStates.filter(p => p.actor === id).every(p => p.status.every(status => status === null) &&
      Object.keys(p.boosts).length === 0 && p.forms.length === 1 && p.forms[0] === initial.name))
    .map(([id]) => id));
  const actions = safe.actions.map((action, index) => {
    const source = report.actions[index]!;
    const candidate = observation.input.candidates.find(value => value.id === action.id);
    assert.ok(candidate && candidate.command === action.command && candidate.description === source.description,
      'Brief action must exactly match the authorized native menu.');
    const commonEffects = action.responses.length && action.responses.every(response => response.resolved > 0)
      ? action.responses[0]!.effects.everyResolved.filter(index => action.responses.every(response => response.effects.everyResolved.includes(index))) : [];
    const commonSomeEffects = action.responses.length && action.responses.every(response => response.resolved > 0)
      ? action.responses[0]!.effects.someResolved.filter(index => action.responses.every(response => response.effects.someResolved.includes(index))) : [];
    const responses = action.responses.map(response => {
      const branches = source.branches.filter(branch => inResponse(branch, response));
      const { summary: _summary, omitted: _omitted, ...allResponseOutcomes } = outcomes(branches, roster, 0, hypothetical);
      const responseOutcomes = Object.fromEntries(Object.entries(allResponseOutcomes).filter(([, count]) => count > 0));
      const singleOutcome = (['ownWin', 'ownLoss', 'continues', 'terminalUnknown'] as Outcome[]).filter(key => allResponseOutcomes[key] > 0).length === 1;
      const field = response.field === null ? null : safe.fields[response.field]!;
      const patterns = new Map<string, { outcome?: Outcome; battleEnded?: boolean; pendingReplacement?: boolean;
        faintedAtEnd: string[]; present?: string[]; count: number }>();
      const variablePresence = response.pokemon.some(index => safe.pokemonStates[index]!.present !== 'all');
      for (const branch of branches.filter(branch => branch.status === 'simulated')) {
        const position = branch.position!;
        const visible = position.pokemon.filter(p => !omittedUnchanged.has(p.id));
        const pattern = { ...(!singleOutcome ? { outcome: classify(position, hypothetical.get(branch.hypothesisId) ?? roster) } : {}),
          ...(field?.battleEnded === 'some' ? { battleEnded: position.battleEnded } : {}),
          ...(field?.pendingReplacement === 'some' ? { pendingReplacement: position.pendingReplacement } : {}),
          faintedAtEnd: visible.filter(p => p.fainted).map(p => actor(p.id) +
            (roster.named.get(p.id)?.fainted === false ? ' (newly fainted)' : '')).sort(),
          ...(variablePresence ? { present: visible.map(p => actor(p.id)).sort() } : {}) };
        const signature = JSON.stringify(pattern), previous = patterns.get(signature);
        if (previous) previous.count++;
        else patterns.set(signature, { ...pattern, count: 1 });
      }
      return {
        opponentCommand: response.opponentCommand, horizon: response.horizon, replacementTiming: response.replacementTiming,
        testedOutcomes: responseOutcomes,
        hypotheses: response.hypotheses.length === declaredHypotheses.length && declaredHypotheses.every(id => response.hypotheses.includes(id))
          ? 'all declared hypotheses' : response.hypotheses,
        resolved: response.resolved,
        ...(response.failed ? { failed: response.failed, failedByHypothesis: response.failedByHypothesis } : {}),
        pokemon: response.pokemon.map(index => safe.pokemonStates[index]!).filter(p => !omittedUnchanged.has(p.actor)).map(p =>
          `${actor(p.actor)}: ${interval(p.hpPercent)}% HP` +
          (p.fainted !== 'none' ? `; fainted ${p.fainted}` : '') +
          (p.active !== 'all' ? `; active ${p.active}` : '') +
          (p.present !== 'all' ? `; present ${p.present}` : '') +
          (p.status.length === 1 && p.status[0] === null ? '' : `; status ${p.status.map(status => status ?? 'none').join(' / ')}`) +
          (p.forms.length === 1 && p.forms[0] === safe.actors[p.actor]!.name ? '' : `; form ${p.forms.join(' / ')}`) +
          (Object.keys(p.boosts).length ? `; boosts ${Object.entries(p.boosts).map(([stat, values]) => `${stat} ${interval(values)}`).join(', ')}` : '') +
          (safe.actors[p.actor]!.aliases ? `; observed aliases ${safe.actors[p.actor]!.aliases!.join(' / ')}` : '')),
        field,
        effects: {
          everyResolved: response.effects.everyResolved.filter(index => !commonEffects.includes(index)).map(index => safe.publicEffects[index]!.join(' | ')),
          someResolved: response.effects.someResolved.filter(index => !commonSomeEffects.includes(index)).map(index => safe.publicEffects[index]!.join(' | ')),
        },
        jointOutcomePatterns: [...patterns.values()], unprojectedEvents: response.unprojectedEvents,
      };
    });
    const commonPokemon = responses.length && responses.every(response => response.resolved > 0)
      ? responses[0]!.pokemon.filter(line => responses.every(response => response.pokemon.includes(line))) : [];
    return { id: action.id, command: action.command, description: publicText(source.description),
      testedOutcomes: outcomes(source.branches, roster, action.omittedBranches, hypothetical),
      status: action.status, omittedBranches: action.omittedBranches,
      pokemonMarginalsSharedByEveryResponse: commonPokemon,
      effectsInEveryResolvedBranch: commonEffects.map(index => safe.publicEffects[index]!.join(' | ')),
      effectsInSomeResolvedBranchesOfEachResponse: commonSomeEffects.map(index => safe.publicEffects[index]!.join(' | ')),
      responses: responses.map(response => ({ ...response, pokemon: response.pokemon.filter(line => !commonPokemon.includes(line)) })) };
  });
  const sharedEvidence: Record<string, string> = {};
  const brief = {
    schemaVersion: 2 as const, method: 'conditional-consequence-brief-v2' as const,
    conditional: 'These are conditional outcomes in tested hypothetical branches, NOT win probabilities, guarantees or known future events. No action is ranked or recommended.',
    ...(report.inference ? { opponentHypotheses: report.inference,
      conditionalRosterPolicy: 'Terminal outcomes refer only to the four participants assumed in that hypothesis. Unseen participants and sets remain unknown in the actual battle. A simulated entry is not a real revelation.' } : {}),
    ...(report.inference ? { sharedEvidence } : {}),
    actions,
    interpretation: {
      uncertainty: report.inference ? 'Up to six wiki-derived set/roster hypotheses conditioned on public reveals, with sampled HP/timer endpoints. Unrevealed sets, training, PP and participants remain assumptions. No set frequency or win probability is claimed.' : safe.interpretation.uncertainty,
      outcomes: 'Own win requires battleEnded plus a witnessed own survivor and every identified opponent participant present and fainted. Own loss requires every identified own participant present and fainted plus a witnessed opponent survivor. Both sides fainted, incomplete required rosters or missing winner evidence remain terminalUnknown. Continues means the branch endpoint was not terminal, not safety.',
      ranges: safe.interpretation.ranges + ' Actor lines use a number for a singleton range, a..b for a range. Unless marked otherwise, the named actor is present, active and not fainted in every resolved branch; status is none, form equals its name, boosts are zero. pokemonMarginalsSharedByEveryResponse belong to EACH response, together with its additional pokemon lines. Missing outcome/failure counts mean zero; omitted branches are assigned only at action level.',
      effects: 'Named public Showdown effects show occurrence, NOT order, multiplicity or causation. Action effectsInEveryResolvedBranch apply throughout; effectsInSomeResolvedBranchesOfEachResponse occur in SOME resolved branches of EACH response, never guaranteed. Each response lists additional everyResolved/someResolved effects. enditem means item lost; [eat] means consumed. Marginal states/effects may come from different branches. Only jointOutcomePatterns preserve KO/visibility/terminal/replacement co-occurrence. Constant pattern flags inherit their response field; a single response outcome applies to every pattern. Pattern present is included only when visibility varies; otherwise all listed endpoint actors are present throughout. Newly fainted labels compare against the authorized observation.',
      horizon: 'next-decision stops at the next request; replacement-entry covers switches/entry effects only, never hidden pending attacks. Pending replacement is not a completed turn.',
      omittedRows: 'Repeated endpoint rows are omitted only for observed already-fainted actors present and still fainted in every resolved branch, with no failed/omitted branches, status or boosts. Their names remain in omittedUnchangedFainted; include these constant faints alongside each joint pattern. They remain part of the terminal classifier. Newly fainted actors and possible revivals are always retained.',
      detailedAssumptionsIncluded: false as const,
    },
    coverage: safe.coverage,
    declaredHypotheses,
    omittedUnchangedFainted: [...omittedUnchanged].map(actor),
    warnings: [...safe.warnings],
  };
  if (!roster.own.length || (!roster.opponent.length && !hypothetical.size)) brief.warnings.push('A complete identified participant roster is unavailable; terminal winner claims are restricted.');
  // Hidden builds create many identical named HP/effect lines across worlds.
  // Intern only repeated detailed evidence, losslessly. The primary action
  // descriptions, outcome summaries and joint KO patterns stay plain English.
  if (report.inference && Buffer.byteLength(JSON.stringify(brief), 'utf8') > MAX_CONSEQUENCE_BRIEF_V2_BYTES) {
    const rows = actions.flatMap(action => [action.pokemonMarginalsSharedByEveryResponse,
      action.effectsInEveryResolvedBranch, action.effectsInSomeResolvedBranchesOfEachResponse,
      ...action.responses.flatMap(response => [response.pokemon, response.effects.everyResolved, response.effects.someResolved])]);
    const counts = new Map<string, number>();
    for (const row of rows) for (const text of row) counts.set(text, (counts.get(text) ?? 0) + 1);
    for (const [text, count] of counts) if (count > 1 && text.length > 40) {
      const key = `evidence${Object.keys(sharedEvidence).length + 1}`;
      sharedEvidence[key] = text;
      for (const row of rows) for (let i = 0; i < row.length; i++) if (row[i] === text) row[i] = `[see ${key}]`;
    }
    brief.warnings.push('Detailed [see evidenceN] references expand exactly to sharedEvidence[evidenceN]. No result, rule, hypothesis or action was removed. Primary outcomes and joint KO patterns remain uncompressed.');
  }
  const bytes = Buffer.byteLength(JSON.stringify(brief), 'utf8');
  assert.ok(bytes <= MAX_CONSEQUENCE_BRIEF_V2_BYTES,
    `Consequence brief V2 exceeds its byte budget (${bytes} > ${MAX_CONSEQUENCE_BRIEF_V2_BYTES}); no threats were silently truncated. Use explicit fallback.`);
  return brief;
}

export type ConsequenceBriefV2 = ReturnType<typeof buildConsequenceBriefV2>;
