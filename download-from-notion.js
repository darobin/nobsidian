#!/usr/bin/env node

import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { NotionAPI } from 'notion-client';
import { getNotionToken } from "./lib/tokens.js";
import { die } from './lib/die.js';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';

const rootWorkspace = 'fb3fbef6-0b34-462f-b235-627e17f7d72d';
const userId = '451b2ff6-52b7-447c-9b94-e1aa9ad753c3';

const need = new Set();
const saved = new Set();

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const nodesDir = join(dataDir, 'nodes');
const needFile = join(dataDir, 'need.json');
const debugFile = join(dataDir, 'debug.json');

const authToken = await getNotionToken();
if (!authToken) die('No token set. First, you need to run: ./set-notion-token.js <token>.');
const nc = new NotionAPI({ authToken });

await mkdir(nodesDir, { recursive: true });

(await readdir(nodesDir))
  .map(fn => fn.toLocaleLowerCase().replace('.json', ''))
  .filter(fn => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(fn))
  .forEach(fn => saved.add(fn))
;

try {
  (await loadJSON(needFile)).forEach(id => need.add(id));
}
catch (err) {/*noop*/}

// if we don't already have the root, this is the first fetch and we need to get it
if (!saved.has(rootWorkspace)) {
  const spaces = await nc.fetch({ endpoint: 'getSpaces' });
  await saveWithId (rootWorkspace, spaces);
  const userData = spaces[userId];
  const spaceViewId = userData.user_root[userId].value.space_views[0]; // don't know if there can be more
  const spaceView = userData.space_view[spaceViewId].value;
  needList(spaceView.bookmarked_pages);
  needList(spaceView.visited_templates);
  needList(spaceView.sidebar_hidden_templates);
  needList(spaceView.private_pages);
  const space = userData.space[rootWorkspace].value;
  needList(space.pages);
  Object.keys(userData.block).forEach(k => {
    needList(k);
    indexBlock(userData.block[k].value);
  });
  Object.keys(userData.collection).forEach(k => {
    needList(k);
    // indexBlock(userData.block[k].value);
    // XXX need to do something here
  });
  await checkPointNeed();
}

// XXX • BETTER APPROACH TO TRY
//  - [ ] get an export of the whole thing
//  - [ ] use that to gather all the identifiers in different structures
//  - [ ] get all the data based on that, making sure that the pages are complete enough



// XXX
//  - [x] get notion token
//  - [ ] load root and save it with a pointer to it
//  - [ ] always load/save the need/got set
//  - [ ] for every identifier, get the fields below and add them to a needs set
//      - XXX these must list children, comments…
//  - [ ] every second, remove an id from the needs set and fetch it, saving it and adding its id to the needs
//  - [ ] make sure to get attachments as well
//  - [ ] make sure that we're not getting paginated out (I think the children IDs are always complete, but not the actual ones)


function indexBlock (block) {
  // XXX
  // view_ids []
  // collection_id
  // content []
}

function needList (list) {
  if (!list) return;
  (Array.isArray(list) ? list : [list])
    .filter(id => !saved.has(id))
    .forEach(id => need.add(id))
  ;
}


async function checkPointNeed () {
  await saveJSON(needFile, need);
}

export async function debug (obj) {
  await saveJSON(debugFile, obj);
}

async function saveWithId (id, obj) {
  await saveJSON(join(nodesDir, `${id}.json`), obj);
}
