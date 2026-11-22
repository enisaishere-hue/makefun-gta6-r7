// Solmar Bay — Sunset Streets: the entry program for gta6-01 Round 7.
// Node 22, standard library only. The game lives in game/ as plain static
// files (index.html + ES modules, no library, no network request); the
// screenshots live in screenshots/. This program hands both in: it copies
// them to /output and writes /output/dossier.json with the vendored
// make.fun library, the summary the judge reads.
//
// The grader mounts /output and runs this program twice into the same
// directory, so the directory itself is never removed — only whatever a
// previous run left inside it. That keeps the second run byte-identical
// to the first. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output every run, without ever deleting the mount point itself.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) {
  rmSync(join(out, entry), { recursive: true, force: true });
}

// The game, then its screenshots.
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, under the scorer's own caps (see the kit's RULES.txt): the
// text is capped at 160 KiB, at most 4 screenshots of 256 KiB each, the
// game at most 993 files and 48 MiB, every game path at most 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
