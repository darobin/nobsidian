
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { toMarkdown } from 'mdast-util-to-markdown';
import { frontmatterToMarkdown } from 'mdast-util-frontmatter';
import { stringify } from 'yaml'
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
  const { id, type, content } = p;
  if (type === 'copy_indicator') return;
  if (type === 'collection_view_page' || type === 'collection_view') return await makeCollection(p.collection);
  if (type === 'page') {
    // we ignore the title because Obsidian uses the file name for that
    const ast = root();
    const page = bigIndex.block[id].value;
    // XXX HERE
    // the output is kind of there, but broken
    // after that, do mdText()
    if (page.parent_table === 'collection' && page.properties && schemata[page.parent_id]) {
      const obj = {};
      Object
        .entries(page.properties)
        .map(([k, v]) => {
          if (k === 'title' || !schemata[page.parent_id][k]?.niceName) return false;
          obj[schemata[page.parent_id][k].niceName] = md(root(mdText(v))).replace(/\n+$/, '');
        })
      ;
      ast.children.push(frontmatter(obj));
    }
    for (const b of (content || [])) {
      const child = await makeBlock(b);
      if (child) ast.children.push(child);
    }
    await writeFile(join(obsidianVault, p.path), md(ast, id));
    return;
  }
  console.warn(`Unexpected type in makePage: ${type} (${id})`);
}

async function makeCollection (c) {
  const { id, path, views } = c;
  await mkdir(join(obsidianVault, path), { recursive: true });
  // we ignore the title because Obsidian uses the file name for that
  const ast = root();
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
  // now recurse
  const seenHere = new Set();
  for (const v of views) {
    for (const item of v.content) {
      if (seenHere.has(item.id)) continue;
      seenHere.add(item.id);
      await makePage(item);
    }
  }
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
// * indirection
//  - [ ] "p": internal link [ "‣", [ [ "p", "206e9f49-65c1-4c75-87de-ac2fe661d496", "fb3fbef6-0b34-462f-b235-627e17f7d72d" ] ] ],
//  - [ ] "e": embedded math inline [ "⁍", [ [ "e", "\\mathit{x}" ] ] ]
//  - [ ] "d": date [ "‣", [ [ "d", { "type": "date", "start_date": "2021-08-14" } ] ] ]
//  - [ ] "eoi": embedded object [ "‣", [ [ "eoi", "c452d50b-02cd-4a43-a51e-269c8fc496c2" ] ] ]
// * decoration, these form lists like [ "The Separation of Platforms and Commerce", [ [ "i" ], [ "a", "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3180174" ] ] ]
//  - [ ] "a": URL link [ "https://twitter.com/schock/status/1524840701749501958", [ [ "a", "https://twitter.com/schock/status/1524840701749501958" ] ] ]
//  - [ ] "i": italics
//  - [ ] "b": bold
//  - [ ] "_": underline
//  - [ ] "h": text color [ " on the first machines.", [ [ "h", "red" ] ] ],
//  - [ ] "m": comment [ "^", [ [ "m", "a1d53b4f-184e-4346-9431-431224c6e298" ] ] ],
//  - [ ] "c": code [ "Nihilism and Technology", [ [ "c" ] ] ]
//  - [ ] "s": strikethrough
function mdText (v = []) {
  return v.map(([txt, meta]) => {
    if (!txt) return false;
    if (!meta) return text(txt);
    // XXX
    //  - for "decoration" meta, pile them deeper in order to nest them as children with eventually the text in there
    //  - for "indirection" meta, links and such, generate the text and create the right structure
  }).filter(Boolean);
}

function text (value) {
  return { type: 'text', value };
}

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
async function makeBlock (b) {
  const { id, type, content } = b;
  const block = bigIndex.block[id].value;
  if (type === 'text') {
    // XXX
    // if content, what do we do here?
    // if (content) console.warn(`Text ${id} has content.`);
    return paragraph(mdText(block.properties?.title));
  }

  // console.warn(`Unexpected type in makeBlock: ${type} (${id})`);
}

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

function md (ast, id) {
  try {
    return toMarkdown(ast, {
      bullet: '-',
      listItemIndent: 'one',
      resourceLink: true,
      rule: '-',
      extensions: [frontmatterToMarkdown(['yaml'])],
    });
  }
  catch (err) {
    console.warn(`Error in ${id}`);
    console.error(err);
  }
}

function root (children = []) {
  return {
    type: 'root',
    children,
  };
}

function heading (depth, value) {
  return {
    type: 'heading',
    depth,
    children: [{ type: 'text', value }],
  };
}

function paragraph (children) {
  return {
    type: 'paragraph',
    children,
  };
}

function code (lang, value) {
  return {
    type: 'code',
    lang,
    value,
  };
}

function frontmatter (data) {
  return {
    type: 'yaml',
    value: stringify(data).replace(/\n+$/, ''),
  }
}
