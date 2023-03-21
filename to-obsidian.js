#!/usr/bin/env node

import { join } from 'node:path';
import { mkdir, readdir } from 'node:fs/promises';
import { die } from './lib/die.js';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const nodesDir = join(dataDir, 'nodes');
const obsidianDir = join(dataDir, 'obsidian');

await mkdir(obsidianDir, { recursive: true });

const files = await readdir(nodesDir);
for (const file of files) {
  const id = file.replace(/\.json$/, '');
  const node = await loadJSON(join(nodesDir, file));
  await generateObsidian(id, node);
  console.warn(`Ok: ${id}`);
}

async function generateObsidian (id, node) {
  const root = (node.block[id] || node.collection[id] || node.collection_view[id])?.value;
  if (!root) die(`Could not find value for ${id}`);

  // find parent path, and mkdir
  const parents = [];
  let curNode = root;
  while (curNode?.parent_table && curNode.parent_id) {
    const { parent_table: pTable, parent_id: pId } = curNode;
    if (pTable === 'space') break;
    curNode = node[pTable][pId].value;
    parents.unshift(curNode);
  }
  const parentPath = join(
    obsidianDir,
    parents
      .map(obj => {
        const { type } = obj;
        if (type === 'page') return obj.properties?.title?.[0]?.[0]; // XXX this is probably wrong, there may be markup
        // collections
        if (!type && obj.name) return obj.name?.[0]?.[0]; // XXX likely wrong too
        if (type === 'collection_view_page') return;
      })
      .filter(Boolean)
  );

  // XXX
  // extract all the interesting features from all files so that we can index things and test that we have it right

  // - make file name
}

function notionToPlainText (no, node) {
  return no
    .map(it => {
      if (it.length === 1) return it[0];
      const [txt, meta] = it;
      // XXX
      // - check that all the meta are understood, but the formatting ones all just return plain text anyway
      // - for the other ones, generate what can be (link or math)
      // - systematically report on what couldn't be matched
      if (meta.find(m => m[0] === 'm')) return txt; // just return the text for commented stuff
    })
    .join('')
  ;
}

// XXX TODO
//  - [ ] we can work entirely in bigIndex!
//  - [ ] keep in mind that blocks can have both title AND content
//  - [ ] comments need to potentially have reactions? they also need to be resolved. Is there a comments plugin that we would work with?


// [
//   [
//     "The same idea is also brought up in "
//   ],
//   [
//     "‣",
//     [
//       [
//         "p",
//         "b9afc468-4854-4888-b94d-961d802add16",
//         "fb3fbef6-0b34-462f-b235-627e17f7d72d"
//       ]
//     ]
//   ],
//   [
//     " when "
//   ],
//   [
//     "‣",
//     [
//       [
//         "p",
//         "e81f2af0-7675-4d44-9c8e-53e2fc772efc",
//         "fb3fbef6-0b34-462f-b235-627e17f7d72d"
//       ]
//     ]
//   ],
//   [
//     " describes "
//   ],
//   [
//     "‣",
//     [
//       [
//         "p",
//         "ffd56561-6677-4b3f-9a53-f0d879bdd9e2",
//         "fb3fbef6-0b34-462f-b235-627e17f7d72d"
//       ]
//     ]
//   ],
//   [
//     "'s view that slave morality has won over master morality — the meek inherited the Earth — because the weak had to be clever to survive whereas the masters were strong enough to remain stupid."
//   ]
// ]
