// Ember Reef v2 — entry program (Node 22, standard library only).
//
// Hands the game in: copies game/ and screenshots/ from beside this file
// into the output directory (/output on the grader, or MAKEFUN_OUTPUT_DIR
// anywhere else) and writes /output/dossier.json with buildDossier from
// the vendored make.fun library. Runs twice must write the same bytes:
// the output directory is cleared first, then copied fresh, and the
// dossier is built from exactly what was copied.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

// clearOutput removes any previous run's files so the two grader runs
// start from the same empty directory and write identical bytes.
function clearOutput(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

// copyTree copies one directory tree (game/ or screenshots/) verbatim.
function copyTree(from, to) {
  if (!existsSync(from)) throw new Error(`missing input directory: ${from}`);
  cpSync(from, to, { recursive: true });
}

// countFiles walks a directory tree and counts the plain files in it, so
// the run can report exactly what it handed in.
function countFiles(dir) {
  let total = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) total += countFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

function main() {
  clearOutput(outputDir);
  copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
  copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
  const gameFiles = countFiles(join(outputDir, 'game'));
  const shotFiles = countFiles(join(outputDir, 'screenshots'));
  const dossier = buildDossier(outputDir, dossierCaps);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`ember-reef-v2: wrote ${outputDir} (${gameFiles} game files, ${shotFiles} screenshots, dossier ${dossier.length} bytes)`);
}

main();
