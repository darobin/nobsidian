#!/usr/bin/env node

import { join } from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';

const bigIndex = {};

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const nodesDir = join(dataDir, 'nodes');
const obsidianDir = join(dataDir, 'obsidian');

await mkdir(obsidianDir, { recursive: true });

const files = await readdir(nodesDir);
for (const file of files) {
  const node = await loadJSON(join(nodesDir, file));
  Object.entries(node).forEach(([k, v]) => {
    if (!bigIndex[k]) bigIndex[k] = {};
    Object.assign(bigIndex[k], v)
  });
  console.warn(`Ok: ${file}`);
}

await saveJSON(join(dataDir, 'big-index.json'), bigIndex);
