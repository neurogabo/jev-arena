import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reconstructV6BenchmarkObservation, type DisclosedOpponentSelection } from '../context-v6/observation.js';
import { LogOnlyObserver } from '../showdown/log-only.js';
import { loadEngine } from '../showdown/engine.js';
import type { SimObservation } from './types.js';
import { enrichObservedEffects } from './effects.js';
import { reconstructClosedObservation } from '../showdown/closed-observation.js';

const id = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const protections = new Set(['protect', 'detect', 'endure', 'wideguard', 'quickguard', 'spikyshield',
  'kingsshield', 'banefulbunker', 'silktrap', 'burningbulwark', 'followme', 'ragepowder', 'helpinghand', 'flinch']);

/** A new wrapper, deliberately leaving the frozen V1–V6 observers unchanged. */
export async function reconstructSimObservation(log: readonly string[], options: {
  ourSide?: 'p1' | 'p2'; battleId?: string; disclosedOpponentSelection?: DisclosedOpponentSelection; opponentInformation?: 'revealed-only';
} = {}): Promise<SimObservation> {
  const authorized = new LogOnlyObserver(options);
  authorized.receive(log.join('\n')); // Strict own-request schema; foreign requests/seeds/debug fail here.
  assert.ok(authorized.decision(), 'Simulation requires a current actionable own request.');
  const clean = authorized.showdownLog;
  const retained = new Set(clean);
  for (const line of log.flatMap(chunk => chunk.split(/\r?\n/))) {
    assert.ok(!line.startsWith('|-') || retained.has(line), `Unsupported unrecognized state transition: ${line.split('|')[1]}.`);
  }
  const request = authorized.ownRequest!;
  const changedLines: number[] = [];
  const normalized = clean.map((line, index) => {
    // Champions decorates 20/100 and 50/100 with HP bar color. This suffix is
    // presentation, not a status; preserve the literal condition separately.
    if (!/^\|(?:switch|drag|-damage|-heal|-sethp)\|/.test(line)) return line;
    const result = line.replace(/(\d+\/\d+)[gyr](?=\s|\||$)/g, '$1');
    if (result !== line) changedLines.push(index);
    return result;
  });
  if (options.opponentInformation === 'revealed-only') assert.equal(options.disclosedOpponentSelection, undefined,
    'Closed information policy forbids selected-four disclosure.');
  const reconstructed = options.opponentInformation === 'revealed-only'
    ? await reconstructClosedObservation(normalized, options) : await reconstructV6BenchmarkObservation(normalized, options);
  const input = structuredClone(reconstructed.input);
  const members = input.state.pokemon as Record<string, any>[];
  const find = (ident: string) => {
    const match = /^(p[12])(?:[ab])?: (.+)$/.exec(ident);
    return match ? members.find(mon => mon.side === match[1] && id(mon.name) === id(match[2]!)) : undefined;
  };
  const publicConditions = new Map<string, string>();
  const toxicTicks = new Map<string, number>();
  const toxicKnown = new Set<string>();
  const singleTurns = new Map<string, { name: string; turn: number }[]>();
  const perish = new Map<string, { duration: number; name: string; sinceTurn: number }>();
  const moveAttempts = new Map<string, number>();
  const items = new Map<string, string>();
  const timerEvidence = new Map<string, { sourceId: string; item: string; duration: number }>();
  const engine = await loadEngine();
  for (const line of clean.filter(line => line.startsWith('|showteam|'))) {
    const side = line.split('|')[2]!;
    const sets = engine.Teams.unpack(line.split('|').slice(3).join('|'));
    sets.forEach((set: { item: string }, index: number) => items.set(`${side === request.side!.id ? 'own' : 'foe'}-${index + 1}`, id(set.item ?? '')));
  }
  let lastMove: { actorId: string; move: string } | undefined;
  const unsupportedTransitions = new Set<string>((reconstructed.audit.unsupportedTransitions as string[] | undefined) ?? []);
  let turn = 0;
  for (const line of clean) {
    const [, event, ident = '', value = '', condition = '', ...rest] = line.split('|');
    const mon = find(ident);
    if (event === 'turn') { turn = Number(ident); singleTurns.clear(); }
    if ((event === 'switch' || event === 'drag') && mon) {
      publicConditions.set(mon.id, condition); toxicTicks.set(mon.id, 0); toxicKnown.add(mon.id);
      singleTurns.delete(mon.id);
      perish.delete(mon.id);
      moveAttempts.set(mon.id, 0);
    }
    if (['-damage', '-heal'].includes(event ?? '') && mon) {
      publicConditions.set(mon.id, value);
      if (event === '-damage' && /\btox\b/.test(value) && [condition, ...rest].includes('[from] psn')) {
        toxicTicks.set(mon.id, Math.min(15, (toxicTicks.get(mon.id) ?? 0) + 1));
      }
    }
    if (event === '-sethp') {
      const fields = line.split('|').slice(2);
      for (let index = 0; index + 1 < fields.length; index += 2) {
        const target = find(fields[index]!); if (target) publicConditions.set(target.id, fields[index + 1]!);
      }
    }
    if (event === 'faint' && mon) publicConditions.set(mon.id, '0 fnt');
    if ((event === 'move' || event === 'cant') && mon) moveAttempts.set(mon.id, (moveAttempts.get(mon.id) ?? 0) + 1);
    if (event === 'move' && mon) lastMove = { actorId: mon.id, move: id(value) };
    if ((event === '-item' || event === '-enditem') && mon) items.set(mon.id, event === '-item' ? id(value) : '');
    if (['-weather', '-fieldstart', '-sidestart'].includes(event ?? '') && !line.includes('[upkeep]')) {
      const name = (event === '-sidestart' ? value : ident).replace(/^(?:move|ability):\s*/i, '');
      const normalizedName = id(name);
      const timerKey = `${event === '-sidestart' ? ident.slice(0, 2) : 'field'}:${normalizedName}`;
      timerEvidence.delete(timerKey);
      const actor = line.split('|').find(part => part.startsWith('[of] '))?.slice(5);
      const sourceId = actor ? find(actor)?.id : lastMove?.move === normalizedName ? lastMove.actorId : undefined;
      if (sourceId && items.has(sourceId)) {
        const item = items.get(sourceId)!;
        const rock: Record<string, string> = { raindance: 'damprock', sunnyday: 'heatrock', sandstorm: 'smoothrock', snow: 'icyrock', snowscape: 'icyrock', hail: 'icyrock' };
        const extended = event === '-weather' ? rock[normalizedName] === item : normalizedName.endsWith('terrain')
          ? item === 'terrainextender' : ['reflect', 'lightscreen', 'auroraveil'].includes(normalizedName) && item === 'lightclay';
        timerEvidence.set(timerKey,
          { sourceId, item, duration: extended ? 8 : normalizedName === 'tailwind' ? 4 : 5 });
      }
    }
    if (event === '-status' && mon && value === 'tox') {
      toxicTicks.set(mon.id, 0); toxicKnown.add(mon.id);
    }
    if (event === '-start' && mon && /^perish[0-3]$/.test(value)) {
      perish.set(mon.id, { duration: Number(value.at(-1)) + ([condition, ...rest].includes('[silent]') ? 1 : 0), name: value, sinceTurn: turn });
    }
    if (event === '-end' && mon && /^perish(?:song|[0-3])$/i.test(value)) perish.delete(mon.id);
    if (event === '-singleturn' && mon) {
      const effect = value.replace(/^move: /, '');
      singleTurns.set(mon.id, [...(singleTurns.get(mon.id) ?? []), { name: effect, turn }]);
      if (!protections.has(id(effect))) unsupportedTransitions.add(`singleturn:${effect}`);
    }
    if (['-singlemove', '-prepare', '-waiting', '-combine'].includes(event ?? '')) {
      unsupportedTransitions.add(`${event}:${value}`);
    }
    // These changes have no faithful representation in the old observer.
    if (event === '-activate' && /(?:skillswap|mummy|lingeringaroma|wandering spirit|leppaberry|spite|eeriespell|grudge)/i.test(id(value))) {
      unsupportedTransitions.add(`${event}:${value}`);
    }
  }
  const ourSide = request.side!.id;
  for (const mon of members) {
    if (mon.side === ourSide) {
      const own = request.side!.pokemon.find(entry => entry.ident === `${ourSide}: ${mon.name}`)!;
      mon.simObservedCondition = own.condition;
    } else mon.simObservedCondition = publicConditions.get(mon.id) ?? null;
    mon.simToxicStage = mon.status === 'tox' && toxicKnown.has(mon.id) ? toxicTicks.get(mon.id) ?? 0 : null;
    mon.simPerishDuration = perish.get(mon.id)?.duration ?? null;
    mon.simMoveAttempts = moveAttempts.get(mon.id) ?? 0;
    mon.firstActionOpportunity = mon.simMoveAttempts === 0;
    mon.effects = mon.effects.filter((effect: { name: string }) => !/^perish[0-3]$/.test(effect.name));
    if (perish.has(mon.id)) {
      const effect = perish.get(mon.id)!;
      mon.effects.push({ name: effect.name, sinceTurn: effect.sinceTurn, remainingTurns: effect.duration });
    }
    mon.simSingleTurnEffects = (singleTurns.get(mon.id) ?? []).map(effect => effect.name);
    for (const effect of singleTurns.get(mon.id) ?? []) {
      if (!mon.effects.some((prior: { name: string }) => id(prior.name) === id(effect.name))) {
        mon.effects.push({ name: effect.name, sinceTurn: turn, remainingTurns: 1 });
      }
    }
  }
  for (const effect of input.state.field as Record<string, any>[]) {
    const timer = timerEvidence.get(`field:${id(effect.name.replace(/^(?:move|weather):\s*/i, ''))}`);
    if (timer) effect.simTimerEvidence = timer;
  }
  for (const [side, effects] of Object.entries(input.state.sideConditions as Record<string, Record<string, any>[]>)) {
    for (const effect of effects) {
      const timer = timerEvidence.get(`${side}:${id(effect.name.replace(/^move:\s*/i, ''))}`);
      if (timer) effect.simTimerEvidence = timer;
    }
  }
  enrichObservedEffects(input.state, request, clean);
  input.key = hash({ state: input.state, candidates: input.candidates, log: clean });
  return { input, request, log: clean, audit: { ...reconstructed.audit,
    schemaVersion: 'sim-observation-v2', logDigest: hash(clean), normalizedHpColorLines: changedLines,
    colorNormalization: 'Only the legacy replay copy is normalized; original authorized log and displayed HP suffixes are retained.',
    unsupportedTransitions: [...unsupportedTransitions],
    currentTurnSingleEffects: [...singleTurns].map(([actorId, effects]) => ({ actorId, effects })),
    currentRequestSource: 'Last authorized own request only; all unknown request fields are rejected.',
    observationDigest: hash(input.state),
  } };
}
