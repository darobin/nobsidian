#!/usr/bin/env node

import { join } from 'node:path';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';
import saveJSON from './lib/save-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');

const bigIndex = await loadJSON(join(dataDir, 'big-index.json'));

// block types
const blockTypes = new Set();
const calloutTypes = new Set();
const formats = new Set();
const textValues = new Set();
const textTypes = new Set();

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


// XXX
// things we want to extract:
//  - [x] all block types, including callout types (they get an icon and background in the format)
//  - [x] all text values from block properties.title, collection name, comment text
//  - [x] all text types
//  - [x] all block formats
//  - [ ] all paths & file names (list of parents with title/name)
//  - [ ] a tree of everyting with just type and children (starting from the space, and checking that everything gets touched at least once)
//  - [ ] all properties for collections and their entries, making a nice lookup table
//  - [ ] all attached files should be downloaded as UUID/filename
//  - [x] where is the reaction from
