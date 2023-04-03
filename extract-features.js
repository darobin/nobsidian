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
const tweets = new Set();

// remove dead branches
const deleteMe = {};
Object.entries(bigIndex.block).forEach(([k, v]) => {
  if (v.value.space_id !== spaceId) {
    delete bigIndex.block[k];
    return;
  }
  let deadAncestor = false;
  ancestryAndSelf(v).forEach(n => {
    let { type = 'collection', id, alive } = n;
    if (type !== 'collection') type = 'block';
    if (!id) {
      console.warn(JSON.stringify(n, null, 2));
    }
    if (alive === false) deadAncestor = true;
    if (deadAncestor) {
      if (!deleteMe[type]) deleteMe[type] = new Set();
      deleteMe[type].add(id);
    }
  });
});
Object.entries(deleteMe).forEach(([type, set]) => {
  console.warn(`Deleting ${[...set].length} from ${type}`);
  [...set].forEach(id => delete bigIndex[type][id]);
  deleteMe[type] = [...set];
});
await saveJSON(join(dataDir, 'deleted-because-dead.json'), deleteMe);

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
  // find parent path, and mkdir
  const parents = ancestryAndSelf(root)
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

const tree = {};
const seenIDs = new Set();
// start with the space
const space = bigIndex.space[spaceId].value;

tree.space = {
  id: space.id,
  type: 'space',
  name: space.name,
  icon: space.icon,
  // we don't use space.pages because pages can have a space root but not be listed there
  pages: Object.keys(bigIndex.block).filter(k => bigIndex.block[k].value?.parent_id === spaceId).map(getBlock),
};
seenIDs.add(space.id);
await saveJSON(join(dataDir, 'tree.json'), tree);
await saveJSON(join(dataDir, 'tweets.json'), [...tweets]);

// XXX still missing one tweet!

// check to see what identifiers we didn't process
[
  'block',
  'collection',
  'discussion',
  'comment',
  'reaction',
].forEach(type => {
  console.warn(`# ${type}`);
  const missing = Object.keys(bigIndex[type])
    .filter(k => {
      if (seenIDs.has(k)) return false;
      if (bigIndex[type][k].value.space_id && bigIndex[type][k].value.space_id !== spaceId) return false;
      return true;
    })
  ;
  missing.forEach(k => console.warn(`. ${k}`));
  console.warn(`${missing.length} missing.`);
});

// XXX
// things we want to extract:
//  - [x] all block types, including callout types (they get an icon and background in the format)
//  - [x] all text values from block properties.title, collection name, comment text
//  - [x] all text types
//  - [x] all block formats
//  - [x] all paths & file names (list of parents with title/name)
//  - [x] a tree of everyting with just type and children (starting from the space, and checking that everything gets touched at least once)
//  - [x] all attached files should be downloaded as UUID/filename (get-files scritp)
//  - [x] where is the reaction from
//  - [ ] all tweets
// things to do
//  - [x] download all the files to make them available for simple copying
//  - [ ] check that all the paths are legal on Mac and how to rename
//  - [ ] some of the directories are tables: how can we make these files instead with the special data thing in Obsidian
//  - [ ] check that BHK Interpretation is correct
//  - [ ] pin tweets
//  - [ ] be careful with alive=true
//  - [ ] check that we know how to convert every block type and every kind of text
//  - [ ] table_block_* fields are important for table blocks

function getBlock (id) {
  seenIDs.add(id);
  if (!bigIndex.block[id]) return console.warn(`Block ${id} not found`);
  const b = bigIndex.block[id].value;
  const block = {
    id: b.id,
    type: b.type,
    content: prune((b.content || []).map(getBlock)),
    discussions: prune((b.discussions || []).map(getDiscussion)),
  };
  if (b.type === 'page') {
    block.icon = b.format?.page_icon;
    block.title = textify(b.properties?.title);
  }
  else if (b.type === 'collection_view_page' || b.type === 'collection_view') {
    block.icon = b.format?.page_icon;
    block.title = textify(b.properties?.title);
    if (b.collection_id) block.collection = getCollection(b.collection_id, b.view_ids);
  }
  else if (b.type === 'table') {
    if (b.collection_id) block.collection = getCollection(b.collection_id);
  }
  else if (b.type === 'image' || b.type === 'file' || b.type === 'video' || b.type === 'pdf') {
    block.source = b.properties?.source?.[0]?.[0];
    block.title = textify(b.properties?.title);
    block.fileIDs = b.file_ids;
  }
  else if (b.type === 'tweet') {
    block.source = b.properties?.source?.[0]?.[0];
    tweets.add(block.source);
  }
  else if (b.type === 'callout') {
    block.icon = b.format?.page_icon;
    block.colour = b.format?.block_color;
    block.title = textify(b.properties?.title);
  }
  else if (b.type === 'transclusion_reference') {
    block.pointer = b.format?.transclusion_reference_pointer?.id;
    block.pointerType = b.format?.transclusion_reference_pointer?.table;
  }
  else if (b.type === 'alias') {
    block.alias = b.format?.alias_pointer;
  }
  else if (b.type === 'column') {
    block.ratio = b.format?.column_ratio;
  }
  else if (b.type === 'external_object_instance') {
    block.source = b.format;
  }
  // "copy_indicator" — not sure what these are, they are parented in the space, but they don't seem useful
  // "alias" — these can point outside the space, be mindful
  return block;
}

// eg. collections
// cq 97e380a5-ab4c-4a9b-a9c0-18d636978581 has kids (it's collection References):
// - 5bacb295-f418-48c5-8fb0-d138b222d4f9
// - 86347cf2-435e-4251-80b0-bf358859ee07 (not alive=tr)
// those two are listed as views by 8b779ab6-c1f8-4351-97ca-783d5452ff8a which is a collection_view_page (child of space) that has 97e… as collection
function getCollection (id, viewIDs) {
  seenIDs.add(id);
  const c = bigIndex.collection[id].value;
  const ret = {
    id: c.id,
    type: 'collection',
    name: textify(c.name),
  };
  let hasQueryView = true;
  (viewIDs || []).forEach(vid => {
    if (!bigIndex.collection_query[id]?.[vid]) hasQueryView = false;
  });
  if (hasQueryView) {
    ret.views = (viewIDs || []).map(vid => {
      seenIDs.add(vid);
      const q = bigIndex.collection_query[id][vid];
      return {
        id: vid,
        type: 'collection_view',
        content: prune((q.collection_group_results?.blockIds || []).map(getBlock)),
      };
    });
  }
  else {
    ret.content = prune(Object.keys(bigIndex.block).filter(k => bigIndex.block[k].value?.parent_id === id)).map(getBlock);
  }
  return ret;
}

function getDiscussion (id) {
  seenIDs.add(id);
  const d = bigIndex.discussion[id].value;
  return {
    id: d.id,
    type: 'discussion',
    comments: prune((d.comments || []).map(getComment)),
  };
}

function getComment (id) {
  seenIDs.add(id);
  const c = bigIndex.comment[id].value;
  return {
    id: c.id,
    type: 'comment',
    reactions: prune((c.reactions || []).map(getReaction)),
  };
}

function getReaction (id) {
  seenIDs.add(id);
  const r = bigIndex.reaction[id].value;
  return {
    id: r.id,
    type: 'reaction',
    icon: r.icon,
  };
}

function textify (text) {
  return (text || [])
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

function prune (arr) {
  if (arr && !arr.length) return undefined;
  return arr;
}

function ancestryAndSelf (root) {
  const parents = [root.value];
  let curNode = root.value;
  while (curNode?.parent_table && curNode.parent_id) {
    const { parent_table: pTable, parent_id: pId } = curNode;
    if (pTable === 'space' || pTable === 'team') break;
    if (!bigIndex[pTable][pId]) console.warn(`NOT FOUND ${pTable}/${pId} for ${curNode.id}`);
    curNode = bigIndex[pTable][pId].value;
    parents.unshift(curNode);
  }
  return parents;
}
