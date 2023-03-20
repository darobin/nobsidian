#!/usr/bin/env node

import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import makeRel from './lib/rel.js';
import saveJSON from './lib/save-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data/');
const exportDir = rel('data/export/markdown');
const idsFile = join(dataDir, 'need.json');

const need = new Set();

(await walk(exportDir))
  .filter(fn => / [a-f0-9]{32}/.test(fn))
  .forEach(fn => {
    const [, id] = fn.match(/ ([a-f0-9]{32})(?:\.\w+)?$/);
    need.add(id);
  })
;

await saveJSON(idsFile, [...need]);

async function walk (dir) {
  const entries = await readdir(dir);
  let ret = [];
  for (const entry of entries) {
    const path = resolve(dir, entry);
    const isDir = (await stat(path)).isDirectory();
    ret = [...ret, ...(isDir ? (await walk(path)) : [entry])];
 }
  return ret;
}
