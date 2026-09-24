import { createRequire } from 'node:module';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlainSet, PracticeTeams, StatBlock, TeamMember, TeamSheet } from './types.js';

export const labPath = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const runtimePath = resolve(labPath, '.runtime');
export const showdownPath = resolve(runtimePath, 'showdown');
export const clientPath = resolve(runtimePath, 'client');
export const clientPublicPath = resolve(clientPath, 'play.pokemonshowdown.com');
export const formatId = 'gen9championsvgc2026regmc';
const require = createRequire(import.meta.url);

/** Only code at the pinned runtime path can be loaded; never search global packages. */
export async function loadEngine(): Promise<any> {
  const entry = resolve(showdownPath, 'dist/sim/index.js');
  try { await access(entry); } catch {
    throw new Error('Showdown no está preparado. Ejecuta npm run setup-showdown.');
  }
  const lock = JSON.parse(await readFile(resolve(labPath, 'showdown.lock.json'), 'utf8'));
  const revision = (await readFile(resolve(showdownPath, '.codex-pinned-revision'), 'utf8')).trim();
  if (revision !== lock.server.revision) throw new Error('La revisión de Showdown no coincide con showdown.lock.json.');
  return require(entry);
}

/** Preserve public point spreads and base abilities; normalize presentation-only Mega labels. */
export function normalizeSets(engine: any, paste: string): PlainSet[] {
  const imported: any[] | null = engine.Teams.import(paste);
  if (!imported || imported.length !== 6) throw new Error('Cada equipo publicado debe contener exactamente seis Pokémon.');
  return imported.map(raw => {
    const species = engine.Dex.species.get(raw.species);
    if (!species.exists) throw new Error(`Especie desconocida: ${raw.species}`);
    const evs = Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(stat => [stat, raw.evs?.[stat] ?? 0])) as StatBlock;
    const set: PlainSet = {
      name: raw.name || (species.isMega ? species.baseSpecies : species.name),
      species: species.isMega ? species.baseSpecies : species.name,
      ability: raw.ability,
      item: raw.item,
      nature: raw.nature,
      moves: [...raw.moves],
      evs,
      level: 50,
    };
    if (raw.gender) set.gender = raw.gender;
    if (raw.shiny) set.shiny = true;
    return set;
  });
}

export async function loadTeams(): Promise<PracticeTeams> {
  const engine = await loadEngine();
  const fixture = JSON.parse(await readFile(resolve(labPath, 'teams/worlds-2026.json'), 'utf8'));
  const battle = new engine.Battle({ formatid: formatId });
  try {
    const teams: Partial<PracticeTeams> = {};
    for (const side of ['human', 'jev'] as const) {
      const record = fixture[side];
      const source = JSON.parse(await readFile(resolve(labPath, 'teams', record.sourceFile), 'utf8'));
      const sets = normalizeSets(engine, source.paste);
      if (JSON.stringify(sets) !== JSON.stringify(record.sets)) throw new Error(`El equipo ${side} difiere de la fuente pública normalizada.`);
      // Validator mutates its input: keep the published fixture independent of its normalization.
      const problems = engine.TeamValidator.get(formatId).validateTeam(structuredClone(sets));
      if (problems?.length) throw new Error(`Equipo ${side} incompatible con ${formatId}: ${problems.join('; ')}`);
      const packed = engine.Teams.pack(sets);
      if (packed !== record.packed) throw new Error(`El equipo empaquetado ${side} difiere de la configuración publicada.`);
      const members: TeamMember[] = sets.map((set, i) => {
        const species = battle.dex.species.get(set.species);
        const member: TeamMember = {
          id: `${side}-${i + 1}`,
          speciesId: `pokemon:${species.id}`,
          name: set.name,
          types: [...species.types],
          stats: battle.spreadModify(species.baseStats, set),
          set,
        };
        const item = battle.dex.items.get(set.item);
        const megaName = typeof item.megaStone === 'string' ? item.megaStone : item.megaStone?.[species.name];
        if (megaName) {
          const mega = battle.dex.species.get(megaName);
          member.mega = {
            speciesId: `pokemon:${mega.id}`,
            types: [...mega.types],
            abilityId: `ability:${engine.toID(mega.abilities['0'])}`,
            stats: battle.spreadModify(mega.baseStats, set),
          };
        }
        return member;
      });
      const sheet: TeamSheet = { label: record.label, sourceUrl: record.sourceUrl, sets, packed, members };
      teams[side] = sheet;
    }
    return teams as PracticeTeams;
  } finally { battle.destroy(); }
}
