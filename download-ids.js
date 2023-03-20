#!/usr/bin/env node

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { NotionAPI } from 'notion-client';
import { getNotionToken } from "./lib/tokens.js";
import { die } from './lib/die.js';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const nodesDir = join(dataDir, 'nodes');
const needFile = join(dataDir, 'need.json');

const authToken = await getNotionToken();
if (!authToken) die('No token set. First, you need to run: ./set-notion-token.js <token>.');
const nc = new NotionAPI({ authToken });

await mkdir(nodesDir, { recursive: true });

const ids = await loadJSON(needFile);

let cnt = 0;
for (const id of ids) {
  cnt++;
  console.warn(`• [${cnt}] ${id}`);
  const data = await nc.getPage(id);
  saveJSON(join(nodesDir, `${id}.json`), data);
}
