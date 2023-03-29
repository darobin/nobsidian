#!/usr/bin/env node

import { join } from 'node:path';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const spaceId = 'fb3fbef6-0b34-462f-b235-627e17f7d72d';

const bigIndex = await loadJSON(join(dataDir, 'big-index.json'));

// block types
const blockTypes = new Set();
const calloutTypes = new Set();
const formats = new Set();
const textValues = new Set();
const textTypes = new Set();
const paths = new Set();

Object.values(bigIndex.block).forEach(v => {
  const { type, format, properties } = v.value;
  blockTypes.add(type);
  if (type === 'callout') calloutTypes.add(JSON.stringify(format));
  formats.add(JSON.stringify(format));
  if (properties?.title) {
    textValues.add(JSON.stringify(properties.title));
    properties.title.forEach(n => {
      if (n.length === 1) return; // plain text
      const [, meta] = n;
      meta.forEach(m => textTypes.add(m[0]));
    });
  }
});
await saveJSON(join(dataDir, 'block-types.json'), [...blockTypes]);
await saveJSON(join(dataDir, 'callout-types.json'), [...calloutTypes]);
await saveJSON(join(dataDir, 'formats.json'), [...formats]);

Object.values(bigIndex.collection).forEach(v => {
  const { name } = v.value;
  if (name) {
    textValues.add(JSON.stringify(name));
    name.forEach(n => {
      if (n.length === 1) return; // plain text
      const [, meta] = n;
      meta.forEach(m => textTypes.add(m[0]));
    });
  }
});
Object.values(bigIndex.comment).forEach(v => {
  const { text } = v.value;
  if (text) {
    textValues.add(JSON.stringify(text));
    text.forEach(n => {
      if (n.length === 1) return; // plain text
      const [, meta] = n;
      meta.forEach(m => textTypes.add(m[0]));
    });
  }
});
await saveJSON(join(dataDir, 'text-types.json'), [...textTypes]);
await saveJSON(join(dataDir, 'text-values.json'), [...textValues]);

[...Object.values(bigIndex.collection), ...(Object.values(bigIndex.block).filter(n => n.value.type === 'page' && n.value.properties?.title))]
.filter(n => n.value.space_id === spaceId)
.forEach(root => {
  // console.warn();
  // find parent path, and mkdir
  const parents = [root.value];
  let curNode = root.value;
  while (curNode?.parent_table && curNode.parent_id) {
    const { parent_table: pTable, parent_id: pId } = curNode;
    if (pTable === 'space' || pTable === 'team') break;
    if (!bigIndex[pTable][pId]) console.warn(`NOT FOUND ${pTable}/${pId} for ${curNode.id}`);
    curNode = bigIndex[pTable][pId].value;
    parents.unshift(curNode);
  }
  let lastType;
  let parentPath = join(
    ...(parents
      .map(obj => {
        const { type } = obj;
        lastType = type || 'collection';
        if (type === 'collection_view_page') return;
        if (type === 'page') return textify(obj.properties?.title, bigIndex);
        if (!type && obj.name) return textify(obj.name, bigIndex);
      })
      .filter(Boolean))
  );
  parentPath += (lastType === 'collection') ? '/' : '.md';
  paths.add(parentPath);
});
await saveJSON(join(dataDir, 'all-paths.json'), [...paths]);

function textify (text, bigIndex) {
  return text
    .map(([txt, meta]) => {
      if (!meta || !meta.find(cmd => cmd.length > 1)) return txt;
      if (txt === '⁍') {
        const [cmd, content] = meta[0];
        if (cmd === 'e') {
          return content
            .replace(/\\mathrm\{P\}/g, '𝖯')
            .replace(/\\mathrm\{Q\}/g, '𝖰')
            .replace(/\\implies/g, '⟹')
            .replace(/\\land/g, '∧')
          ;
        }
        else return console.warn(`UKNOWN CMD ${cmd}`);
      }
      if (txt === '‣') {
        const [cmd, id] = meta[0];
        if (cmd === 'p') {
          const node = bigIndex.block[id];
          return textify(node.value?.properties?.title, bigIndex);
        }
        else return console.warn(`UKNOWN CMD ${cmd}`);
      }
    })
    .join('')
  ;
}


// XXX
// things we want to extract:
//  - [x] all block types, including callout types (they get an icon and background in the format)
//  - [x] all text values from block properties.title, collection name, comment text
//  - [x] all text types
//  - [x] all block formats
//  - [ ] all paths & file names (list of parents with title/name)
//  - [ ] a tree of everyting with just type and children (starting from the space, and checking that everything gets touched at least once)
//  - [ ] all properties for collections and their entries, making a nice lookup table
//  - [ ] all attached files should be downloaded as UUID/filename (get-files scritp)
//  - [x] where is the reaction from
// things to do
//  - [ ] download all the files to make them available for simple copying
//  - [ ] check that all the paths are legal on Mac and how to rename
//  - [ ] some of the directories are tables: how can we make these files instead with the special data thing in Obsidian
//  - [ ] check that BHK Interpretation is correct
