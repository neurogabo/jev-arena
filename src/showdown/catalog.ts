import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { formatId, labPath, loadEngine, loadTeams, normalizeSets } from './engine.js';
import { assignTeams } from './team-assignment.js';
import type { PlainSet, PracticeTeams, TeamMember, TeamSheet } from './types.js';

export type CatalogEntry = {
  id: string; label: string; player?: string; event?: string; placement?: number | string;
  sourceUrl: string; sourceFormat: string; reconstructedTraining: boolean;
  species: string[]; provenance?: unknown; sheet?: TeamSheet; error?: string;
};
const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value);
const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
type ReadText = (path: string) => Promise<string>;
const readTextFile: ReadText = path => readFile(path, 'utf8');
const normalizedLF = (text: string) => text.replace(/\r\n?/g, '\n');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Git may change line endings. Historical hashes can be LF or CRLF, never different content. */
function matchesTextHash(text: string, expected: unknown): boolean {
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const lf = normalizedLF(text);
  return sha256(lf) === expected || sha256(lf.replace(/\n/g, '\r\n')) === expected;
}

async function readSource(readText: ReadText, path: string, label: string): Promise<string> {
  try { return await readText(path); }
  catch { throw new Error(`No se pudo leer ${label}.`); }
}

function parseJson(text: string, label: string): any {
  try { return JSON.parse(text); }
  catch { throw new Error(`JSON inválido en ${label}.`); }
}

function verify(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** The only permitted change to a public OTS is its individually documented training allocation. */
async function verifiedTournamentSets(engine: any, record: any, readText: ReadText): Promise<PlainSet[]> {
  verify(typeof record.sourceFile === 'string' && /^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.json$/.test(record.sourceFile), 'Ruta de fuente pública inválida.');
  const source = parseJson(await readSource(readText, resolve(labPath, 'teams', record.sourceFile), 'la fuente pública'), 'la fuente pública');
  verify(source?.sourceType === 'public-open-team-sheet' && record.provenance?.sourceType === source.sourceType, 'Tipo de fuente pública incompatible.');
  verify(source.sourceUrl === record.sourceUrl && source.player === record.player && source.placement === record.placement, 'La identidad del equipo no coincide con la fuente pública.');
  verify([formatId, 'gen9championsvgc2026regmb'].includes(record.sourceFormat) && source.sourceFormat === record.sourceFormat, 'Unsupported or mismatched source regulation.');
  verify(typeof source.paste === 'string' && matchesTextHash(source.paste, source.pasteSha256)
    && source.pasteSha256 === record.provenance?.sourcePasteSha256, 'El hash de la lista pública no coincide.');
  // These frozen OTS contain exactly identity/item, ability, nature and moves. Do not let a
  // parser silently discard extra private fields or accept explicit zero/default training.
  const blocks = normalizedLF(source.paste).trim().split(/\n\s*\n/);
  verify(blocks.length === 6 && blocks.every(block => {
    const lines = block.split('\n');
    return lines.length === 7 && /^[^@\r\n]+ @ [^@\r\n]+$/.test(lines[0]!)
      && /^Ability: [A-Za-z0-9 -]+$/.test(lines[1]!) && /^[A-Za-z]+ Nature$/.test(lines[2]!)
      && lines.slice(3).every(line => /^- [A-Za-z0-9 '-]+$/.test(line));
  }), 'La lista pública contiene campos ausentes o no permitidos.');
  const sets = normalizeSets(engine, source.paste);
  verify(typeof source.rawTeamSheetHtml === 'string', 'Falta la captura de la lista pública.');
  const decode = (text: string) => text.replace(/&amp;/g, '&').replace(/&#039;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const publicFields = [...source.rawTeamSheetHtml.matchAll(/<div class="pkmn" data-id="([^"]+)">([\s\S]*?)(?=<div class="pkmn"|<div class="teamlist-options">)/g)].map(match => {
    const body = match[2]!;
    const field = (name: string) => decode(body.match(new RegExp(`<div class="${name}">([^<]*)</div>`))?.[1]?.trim() ?? '');
    const moveList = body.match(/<ul class="moves">([\s\S]*?)<\/ul>/)?.[1] ?? '';
    return { species: engine.Dex.species.get(match[1]).name, item: field('item'), ability: field('ability').replace(/^Ability: /, ''),
      nature: field('nature').replace(/ Nature$/, ''), moves: [...moveList.matchAll(/<li>([^<]+)<\/li>/g)].map(move => decode(move[1]!)) };
  });
  verify(isDeepStrictEqual(publicFields, sets.map(({ species, item, ability, nature, moves }) => ({ species, item, ability, nature, moves }))),
    'La transcripción OTS no coincide con la captura pública.');
  const training = record.provenance?.training;
  verify(record.provenance?.reconstructedTraining === true && Array.isArray(training) && training.length === 6,
    'Cada Pokémon necesita una reconstrucción de entrenamiento documentada.');
  verify(new Set(training.map((entry: any) => entry?.slot)).size === 6
    && training.every((entry: any) => Number.isInteger(entry?.slot) && entry.slot >= 1 && entry.slot <= 6),
  'Los slots de reconstrucción deben ser únicos y completos.');
  for (const [index, set] of sets.entries()) {
    const entry = training.find((candidate: any) => candidate.slot === index + 1);
    verify(entry?.reconstructed === true && entry.species === set.species && typeof entry.reason === 'string' && entry.reason.trim(),
      'La reconstrucción no identifica correctamente al Pokémon.');
    const item = engine.Dex.items.get(set.item);
    const mega = typeof item.megaStone === 'string' ? item.megaStone : item.megaStone?.[set.species];
    const species = engine.Dex.species.get(mega || set.species);
    verify(entry.wikiFile === `docs/wiki/pokemon/${species.id}.md`, 'La ficha citada no corresponde a la especie o su Mega.');
    const wikiText = await readSource(readText, resolve(labPath, entry.wikiFile), 'la ficha del wiki');
    verify(matchesTextHash(wikiText, entry.wikiSha256), 'El contenido de la ficha del wiki cambió; revisa la reconstrucción.');
    verify(typeof entry.wikiAnchor === 'string' && /^build-[1-9]\d*$/.test(entry.wikiAnchor), 'Referencia de build inválida.');
    const buildNumber = Number(entry.wikiAnchor.slice(6));
    const build = [...wikiText.matchAll(/### Build (\d+)([\s\S]*?)(?=### Build |## Battle interpretation|$)/g)]
      .find(match => Number(match[1]) === buildNumber)?.[2];
    verify(build, 'La build citada no existe en el wiki.');
    const points = build.match(/\| Allocated SP \|([^\r\n]+)/)?.[1]?.split('|').map(value => value.trim()).filter(Boolean).map(Number);
    verify(points?.length === 6 && points.every(point => Number.isInteger(point) && point >= 0 && point <= 32)
      && points.reduce((total, point) => total + point, 0) <= 66, 'La build citada contiene puntos incompatibles.');
    const allocated = Object.fromEntries(stats.map((stat, slot) => [stat, points[slot]!])) as PlainSet['evs'];
    verify(isDeepStrictEqual(entry.allocatedStatPoints, allocated), 'Los puntos reconstruidos difieren de la build citada.');
    set.evs = allocated;
  }
  verify(isDeepStrictEqual(record.sets, sets), 'Los sets difieren de la lista pública más los puntos documentados.');
  verify(typeof record.packed === 'string' && record.packed === engine.Teams.pack(sets), 'El equipo empaquetado no coincide con los sets verificados.');
  return sets;
}

/** Validation and exact stats are local. The decision pipeline receives the player stream, never this catalog. */
export function sheetFromSets(engine: any, label: string, sourceUrl: string, sets: PlainSet[]): TeamSheet {
  if (sets.length !== 6) throw new Error('Cada equipo debe contener seis Pokémon.');
  const problems = engine.TeamValidator.get(formatId).validateTeam(structuredClone(sets));
  if (problems?.length) throw new Error(problems.join('; '));
  const battle = new engine.Battle({ formatid: formatId });
  try {
    const members: TeamMember[] = sets.map((set, index) => {
      const species = battle.dex.species.get(set.species);
      const member: TeamMember = { id: `catalog-${index + 1}`, speciesId: `pokemon:${species.id}`,
        name: set.name || species.name, types: [...species.types], stats: battle.spreadModify(species.baseStats, set), set: structuredClone(set) };
      const item = battle.dex.items.get(set.item);
      const megaName = typeof item.megaStone === 'string' ? item.megaStone : item.megaStone?.[species.name];
      if (megaName) {
        const mega = battle.dex.species.get(megaName);
        member.mega = { speciesId: `pokemon:${mega.id}`, types: [...mega.types],
          abilityId: `ability:${engine.toID(mega.abilities['0'])}`, stats: battle.spreadModify(mega.baseStats, set) };
      }
      return member;
    });
    return { label, sourceUrl, sets: structuredClone(sets), packed: engine.Teams.pack(sets), members };
  } finally { battle.destroy(); }
}

export async function loadTeamCatalog({ readText = readTextFile }: { readText?: ReadText } = {}): Promise<CatalogEntry[]> {
  const [engine, original] = await Promise.all([loadEngine(), loadTeams()]);
  const entries: CatalogEntry[] = [
    { id: 'worlds-vikram', label: original.human.label, sourceUrl: original.human.sourceUrl,
      player: 'Vikram Thiagarajan', event: 'worlds-2026-seniors', placement: 'Seniors champion',
      sourceFormat: 'gen9championsvgc2026regmb', reconstructedTraining: false,
      species: original.human.sets.map(s => s.species), sheet: original.human },
    { id: 'worlds-takuma', label: original.jev.label, sourceUrl: original.jev.sourceUrl,
      player: 'Takuma Yamazaki', event: 'worlds-2026-masters', placement: 'Masters champion',
      sourceFormat: 'gen9championsvgc2026regmb', reconstructedTraining: false,
      species: original.jev.sets.map(s => s.species), sheet: original.jev },
  ];
  const data = parseJson(await readSource(readText, resolve(labPath, 'teams/tournament-catalog.json'), 'el catálogo'), 'el catálogo');
  if (data.schemaVersion !== 1 || data.formatId !== formatId || !Array.isArray(data.teams)) throw new Error('Catálogo de equipos incompatible.');
  for (const [index, raw] of data.teams.entries()) {
    const record = raw ?? {};
    const identityValid = validId(record.id) && !entries.some(entry => entry.id === record.id)
      && data.teams.filter((candidate: any) => candidate?.id === record.id).length === 1;
    const entry: CatalogEntry = { id: identityValid ? record.id : `invalid-team-${index + 1}`,
      label: typeof record.label === 'string' ? record.label : `Equipo ${index + 1}`,
      player: typeof record.player === 'string' ? record.player : undefined,
      event: typeof record.event === 'string' ? record.event : undefined,
      placement: typeof record.placement === 'number' || typeof record.placement === 'string' ? record.placement : undefined,
      sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : '',
      sourceFormat: typeof record.sourceFormat === 'string' ? record.sourceFormat : '',
      reconstructedTraining: record.provenance?.reconstructedTraining === true,
      species: Array.isArray(record.sets) ? record.sets.map((s: any) => s?.species).filter((s: unknown): s is string => typeof s === 'string') : [],
      provenance: record.provenance };
    try {
      verify(identityValid, 'Identidad de equipo inválida o repetida.');
      verify(typeof record.label === 'string' && typeof record.sourceUrl === 'string' && /^https:\/\//.test(record.sourceUrl), 'Procedencia de equipo inválida.');
      const sets = await verifiedTournamentSets(engine, record, readText);
      entry.sheet = sheetFromSets(engine, record.label, record.sourceUrl, sets);
    }
    catch (error) { entry.error = `Incompatible con M-C: ${error instanceof Error ? error.message : 'equipo inválido'}`; }
    entries.push(entry);
  }
  return entries;
}

export function assignCatalogTeams(catalog: CatalogEntry[], selection: string): PracticeTeams {
  const legacy = selection === 'standard' ? ['worlds-vikram', 'worlds-takuma']
    : selection === 'swapped' ? ['worlds-takuma', 'worlds-vikram'] : selection.split(',');
  if (legacy.length !== 2 || !legacy.every(validId)) throw new Error('Elige dos equipos del catálogo.');
  const [human, jev] = legacy.map(id => catalog.find(entry => entry.id === id));
  if (!human?.sheet || !jev?.sheet) throw new Error(human?.error ?? jev?.error ?? 'Equipo desconocido.');
  // structuredClone preserves shared references. Split mirror sheets before assignTeams
  // so assigning Jev's member IDs cannot also rewrite the human side.
  return assignTeams({ human: structuredClone(human.sheet), jev: structuredClone(jev.sheet) });
}

/** No trained stats, packed private teams or runtime paths are served by the catalog endpoint. */
export function publicCatalog(catalog: CatalogEntry[]) {
  return { formatId, teams: catalog.map(entry => ({
    id: entry.id, label: entry.label, player: entry.player, event: entry.event, placement: entry.placement,
    sourceUrl: entry.sourceUrl, sourceFormat: entry.sourceFormat, reconstructedTraining: entry.reconstructedTraining,
    species: [...entry.species], error: entry.error, enabled: Boolean(entry.sheet),
  })) };
}
