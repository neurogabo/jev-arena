import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientPath, clientPublicPath, labPath, loadTeams, runtimePath, showdownPath } from '../src/showdown/engine.js';

type Pin = { revision: string; archiveUrl: string; sha256: string };
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((res, rej) => {
    const env = { ...process.env };
    delete env.TYPESAFE_API_KEY;
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
    child.once('error', rej);
    child.once('exit', code => code === 0 ? res() : rej(new Error(`${command} falló (${code}).`)));
  });
}

async function prepareSource(name: string, path: string, pin: Pin) {
  const marker = resolve(path, '.codex-pinned-revision');
  if (await exists(marker)) {
    if ((await readFile(marker, 'utf8')).trim() !== pin.revision) throw new Error(`Revisión distinta en ${path}; no se sobrescribirá.`);
    return;
  }
  if (await exists(path)) throw new Error(`El directorio ${path} existe sin marca de revisión. No se modificará automáticamente.`);
  await mkdir(runtimePath, { recursive: true });
  const archivePath = resolve(runtimePath, `${name}.zip`);
  let archive: Buffer;
  if (await exists(archivePath)) archive = await readFile(archivePath);
  else {
    console.log(`Descargando ${name} ${pin.revision}…`);
    const response = await fetch(pin.archiveUrl, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Descarga de ${name}: HTTP ${response.status}`);
    archive = Buffer.from(await response.arrayBuffer());
    await writeFile(archivePath, archive);
  }
  if (createHash('sha256').update(archive).digest('hex') !== pin.sha256) throw new Error(`SHA256 incorrecto para ${name}.`);
  await mkdir(path, { recursive: true });
  // Windows tar is bsdtar. Linux needs libarchive-tools: GNU tar cannot read ZIP.
  await run(process.platform === 'linux' ? 'bsdtar' : 'tar', ['-xf', archivePath, '-C', path, '--strip-components', '1'], runtimePath);
  await writeFile(marker, `${pin.revision}\n`);
}

async function installAndBuild(path: string, builtFile: string) {
  if (await exists(builtFile)) return;
  // npm's JS entry point avoids shell quoting of Windows paths and inherited command expansion.
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) await run(process.execPath, [npmExecPath, 'ci', '--no-audit', '--no-fund'], path);
  else if (process.platform === 'win32') await run('cmd.exe', ['/d', '/s', '/c', 'npm ci --no-audit --no-fund'], path);
  else await run('npm', ['ci', '--no-audit', '--no-fund'], path);
  await run(process.execPath, ['build'], path);
  if (!(await exists(builtFile))) throw new Error(`Build incompleto: ${builtFile}`);
}

async function buildPinnedClientData(serverRevision: string, clientRevision: string) {
  const marker = resolve(clientPath, '.codex-local-data.json');
  const expected = { serverRevision, clientRevision, generation: 1 };
  if (await exists(marker)) {
    if (JSON.stringify(JSON.parse(await readFile(marker, 'utf8'))) === JSON.stringify(expected)) return;
  }
  const serverCache = resolve(clientPath, 'caches/pokemon-showdown');
  await mkdir(resolve(clientPath, 'caches'), { recursive: true });
  if (await exists(serverCache)) {
    if ((await realpath(serverCache)).toLowerCase() !== (await realpath(showdownPath)).toLowerCase()) {
      throw new Error('El cliente tiene otra fuente de datos; no se sobrescribirá caches/pokemon-showdown.');
    }
  } else await symlink(showdownPath, serverCache, process.platform === 'win32' ? 'junction' : 'dir');
  // Upstream's --no-update prevents git pull and uses our pinned engine for every gameplay table.
  await run(process.execPath, ['build-tools/build-indexes', '--no-update'], clientPath);
  await run(process.execPath, ['build-tools/build-commands'], clientPath);
  const compile = `
    import fs from 'node:fs';
    import * as compiler from './build-tools/compiler.mjs';
    const opts = {...Function('return (' + fs.readFileSync('.babelrc', 'utf8') + ')')(), babelrc: false, incremental: true};
    compiler.compileToDir(['caches/pokemon-showdown/server/chat-formatter.ts', 'caches/pokemon-showdown/sim/teams.ts'], 'play.pokemonshowdown.com/js/server/', opts);
    await compiler.compileToFile(['play.pokemonshowdown.com/src/battle-animations.ts', 'play.pokemonshowdown.com/src/battle-animations-moves.ts'], 'play.pokemonshowdown.com/data/graphics.js', opts);
  `;
  await run(process.execPath, ['--input-type=module', '-e', compile], clientPath);
  // Unlike a full website build this does not require PHP, uploaded sprites or website news.
  await run(process.execPath, ['build-tools/update'], clientPath);
  for (const file of ['pokedex.js', 'moves.js', 'items.js', 'abilities.js', 'typechart.js', 'teambuilder-tables.js', 'text/en.js', 'graphics.js', 'commands.js']) {
    await access(resolve(clientPublicPath, 'data', file));
  }
  await writeFile(marker, JSON.stringify(expected));
}

export async function ensureShowdown(): Promise<void> {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major! < 22 || (major === 22 && minor! < 18)) throw new Error('El Showdown fijado requiere Node.js 22.18 o posterior.');
  const lock = JSON.parse(await readFile(resolve(labPath, 'showdown.lock.json'), 'utf8'));
  await prepareSource('server', showdownPath, lock.server);
  await prepareSource('client', clientPath, lock.client);
  await installAndBuild(showdownPath, resolve(showdownPath, 'dist/sim/index.js'));
  await installAndBuild(clientPath, resolve(clientPublicPath, 'js/client-core.js'));
  await buildPinnedClientData(lock.server.revision, lock.client.revision);
  const teams = await loadTeams();
  console.log(`Showdown listo: ${lock.formatId}. Equipos validados: ${teams.human.sets.length} + ${teams.jev.sets.length}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureShowdown().catch(error => { console.error(error.message); process.exitCode = 1; });
}
