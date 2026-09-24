// Dependency-free guard for tracked and non-ignored files. Full history: Gitleaks.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}).split('\0').filter(Boolean))];
const problems = [];
const privatePath = /(^|\/)(?:\.env(?:\..*)?|node_modules|\.runtime|\.arena-data|runs|\.secrets|\.credentials)(\/|$)|\.(?:sqlite(?:-wal|-shm)?|db(?:-wal|-shm)?|pem|key|p12|pfx|bak|backup)$/i;
const assignments = /\b(?:TYPESAFE_API_KEY|OPENAI_API_KEY|GITHUB_TOKEN)[ \t]*["']?[ \t]*[:=][ \t]*["']?([A-Za-z0-9_./+=-]{16,})/g;
const sentinels = {};
for (const file of files) {
  if (!existsSync(new URL('../' + file, import.meta.url))) continue; // staged deletion
  if (privatePath.test(file) && !file.endsWith('/.env.example') && file !== '.env.example') {
    problems.push(file + ': private artifact must not be tracked');
  }
  const data = readFileSync(new URL('../' + file, import.meta.url));
  if (data.includes(0)) continue;
  const text = data.toString('utf8');
  for (const match of text.matchAll(assignments)) {
    if (sentinels[file] !== match[1]) problems.push(file + ': possible literal API credential (value withheld)');
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) problems.push(file + ': private key');
  if (/[A-Z]:[\\/]+Users[\\/]+[^\s"'<>]+/i.test(text)) problems.push(file + ': machine-specific user path');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Public-file check passed (' + files.length + ' files). Run Gitleaks separately for history.');
}
