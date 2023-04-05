
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { toMarkdown } from 'mdast-util-to-markdown';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const obsidianVault = '/Users/robin/Code/darobin/static-notion-export/Static Notion Import';

const bigIndex = await loadJSON(join(dataDir, 'big-index.json'));
const tree = await loadJSON(join(dataDir, 'tree.json'));
const schemata = {};

for (const page of tree.space.pages) {
  await makePage(page);
}

async function makePage (p) {
  const { id, type } = p;
  if (type === 'copy_indicator') return;
  if (type === 'collection_view_page' || type === 'collection_view') return await makeCollection(p.collection);
  if (type === 'page') {
    const ast = astFromTitle(p.title);
    // XXX
    //  recurse into the blocks
    await writeFile(join(obsidianVault, p.path), md(ast));
    return;
  }
  console.warn(`Unexpected type in makePage: ${type} (${id})`);
}

async function makeCollection (c) {
  const { id, name, path, views } = c;
  await mkdir(join(obsidianVault, path), { recursive: true });
  const ast = astFromTitle(name);
  const { schema } = bigIndex.collection[id].value;
  schemata[id] = schema;
  Object.values(schema).forEach(v => {
    v.niceName = niceName(v.name);
  });
  views.forEach(v => {
    const view = bigIndex.collection_view[v.id].value;
    if (view.name) ast.children.push(heading(2, view.name));
    const isTable = !!view.format?.table_properties;
    const props = (view.format?.table_properties || view.format?.list_properties)?.filter(({ visible, property }) => visible && property !== 'title').map(({ property }) => schema[property].niceName);
    if (props) ast.children.push(code('dataview', `${isTable ? `TABLE ${props.join(', ')}` : 'LIST'}\nFROM "${path.replace(/\/$/, '')}"\n`));
  });
  await writeFile(join(obsidianVault, path, '_.md'), md(ast));
}


// XXX
// - walk:
//    - collections
//    - pages
// - create index for collections, plus a query for each view
// - when there is more than one view, process both but keep track of what each view has processed to not do it twice
// - use the data thing to set data on pages that have a collection as their parent
// - use mdast (with extensions, matching Obsidian syntax) to produce MD
// - blocks that have children, when that's not native MD, use a special callout
// - copy files

// TEXT TYPES
//  - [ ] "p",
//  - [ ] "a",
//  - [ ] "i",
//  - [ ] "b",
//  - [ ] "e",
//  - [ ] "_",
//  - [ ] "d",
//  - [ ] "h",
//  - [ ] "m",
//  - [ ] "c",
//  - [ ] "eoi",
//  - [ ] "s",
//  - [ ] "u"
// BLOCK TYPES
//  - [ ] "page",
//  - [x] "collection_view_page",
//  - [ ] "bulleted_list",
//  - [ ] "to_do",
//  - [x] "collection_view",
//  - [ ] "quote",
//  - [ ] "text",
//  - [ ] "header",
//  - [ ] "numbered_list",
//  - [ ] "image",
//  - [ ] "transclusion_container",
//  - [ ] "callout",
//  - [ ] "tweet",
//  - [x] "copy_indicator",
//  - [ ] "code",
//  - [ ] "table_of_contents",
//  - [ ] "sub_sub_header",
//  - [ ] "sub_header",
//  - [ ] "divider",
//  - [ ] "transclusion_reference",
//  - [ ] "alias",
//  - [ ] "file",
//  - [ ] "equation",
//  - [ ] "external_object_instance",
//  - [ ] "column_list",
//  - [ ] "column",
//  - [ ] "video",
//  - [ ] "table",
//  - [ ] "table_row",
//  - [ ] "pdf"


// things to do
//  - [ ] some of the directories are tables: how can we make these files instead with the special data thing in Obsidian
//  - [ ] check that BHK Interpretation is correct
//  - [ ] pin tweets
//  - [ ] check that we know how to convert every block type and every kind of text
//  - [ ] table_block_* fields are important for table blocks
//  - [ ] use https://github.com/FlorianWoelki/obsidian-icon-folder to add icons manually

function niceName (str) {
  const ret = str.toLowerCase().replace(/\s+(\w)/g, (_,c) => c.toUpperCase());
  if (ret === 'lastModified' || ret === 'lastEditedTime') return 'file.ctime';
  return ret;
}

function md (ast) {
  return toMarkdown(ast, {
    bullet: '-',
    listItemIndent: 'one',
    resourceLink: true,
    rule: '-',
  });
}

// we ignore the title because Obsidian uses the file name for that
function astFromTitle () {
  return {
    type: 'root',
    children: [
      // {
      //   type: 'heading',
      //   depth: 1,
      //   children: [{ type: 'text', value: title }],
      // },
    ],
  };
}

function heading (depth, value) {
  return {
    type: 'heading',
    depth,
    children: [{ type: 'text', value }],
  };
}

function code (lang, value) {
  return {
    type: 'code',
    lang,
    value,
  };
}
