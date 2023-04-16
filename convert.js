
import { join, dirname } from 'node:path';
import { mkdir, writeFile, copyFile as cp } from 'node:fs/promises';
import { toMarkdown } from 'mdast-util-to-markdown';
import { frontmatterToMarkdown } from 'mdast-util-frontmatter';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { mathToMarkdown } from 'mdast-util-math';
import { toMarkdown as wikiToMarkdown } from 'mdast-util-wiki-link';
import { stringify } from 'yaml'
import { traceParentPath } from './lib/trace-parents.js';
import { textify } from './lib/textify.js';
import makeRel from './lib/rel.js';
import loadJSON from './lib/load-json.js';

const rel = makeRel(import.meta.url);
const dataDir = rel('data');
const filesDir = join(dataDir, 'files');
const obsidianVault = '/Users/robin/Code/darobin/static-notion-export/Static Notion Import';
const transclusionRoot = 'transclusions';

const bigIndex = await loadJSON(join(dataDir, 'big-index.json'));
const tree = await loadJSON(join(dataDir, 'tree.json'));
const schemata = {};

wrapLists();

for (const page of tree.space.pages) {
  await makePage(page);
}

async function makePage (p, parentCtx) {
  const { id, type, content } = p;
  if (type === 'copy_indicator') return;
  if (type === 'collection_view_page' || type === 'collection_view') return await makeCollection(p.collection);
  if (type === 'page') {
    const ast = root();
    const page = bigIndex.block[id].value;
    const pagePath = join(obsidianVault, p.path);
    if (page.parent_table === 'collection' && page.properties && schemata[page.parent_id]) {
      const obj = {};
      for (const [k, v] of Object.entries(page.properties)) {
        if (k === 'title' || !schemata[page.parent_id][k]?.niceName) continue;
        if (schemata[page.parent_id][k].type === 'file') {
          const fn = v[0]?.[1]?.[0]?.[1]?.replace(/.*\//, '');
          if (fn) {
            const imgPath = await copyFile(page.file_ids, fn, pagePath);
            obj[schemata[page.parent_id][k].niceName] = inlineMD(image(imgPath));
          }
        }
        else if (schemata[page.parent_id][k].type === 'checkbox') {
          const checked = v?.[0]?.[0] === 'Yes';
          obj[schemata[page.parent_id][k].niceName] = checked ? '✅' : '❌';
        }
        else obj[schemata[page.parent_id][k].niceName] = inlineMD(mdText(v));
      }
      ast.children.push(frontmatter(obj));
    }
    const ctx = { fnCount: 0, footnotes: [], pagePath };
    ast.children.push(heading(1, mdText(page.properties?.title || page.name, ctx)));
    if (page.discussions) {
      ast.children.push(paragraph(page.discussions.map(did => makeFootnote(did, ctx))));
    }
    await recurseBlocks(content, ast.children, ctx);
    if (ctx.fnCount) ast.children.push(...ctx.footnotes);
    await mkdir(dirname(pagePath), { recursive: true });
    await writeFile(pagePath, md(ast, id));
    return;
  }
  if (type === 'transclusion_container') {
    const ast = root();
    const tcPath = join(obsidianVault, `${transclusionRoot}/${id}.md`);
    const ctx = { fnCount: 0, footnotes: [], pagePath: tcPath };
    await recurseBlocks(content, ast.children, ctx);
    if (ctx.fnCount) {
      parentCtx.fnCount += ctx.fnCount;
      parentCtx.footnotes.push(...ctx.footnotes);
    }
    await mkdir(dirname(tcPath), { recursive: true });
    await writeFile(tcPath, md(ast, id));
    return;
  }
  console.warn(`Unexpected type in makePage: ${type} (${id})`);
}

async function makeCollection (c) {
  const { id, path, views, name } = c;
  await mkdir(join(obsidianVault, path), { recursive: true });
  const ast = root();
  ast.children.push(heading(1, text(name)));
  ast.children.push(...getCollectionAST(id, views, path));
  await writeFile(join(obsidianVault, path.replace(/\/$/, '') + '.md'), md(ast));
  // now recurse
  await recurseViews(views);
}

function getCollectionAST (id, views, path) {
  const children = [];
  const { schema } = bigIndex.collection[id].value;
  schemata[id] = schema;
  Object.values(schema).forEach(v => {
    v.niceName = niceName(v.name);
  });
  views.forEach(v => {
    const view = bigIndex.collection_view[v.id].value;
    if (view.name) children.push(heading(2, view.name));
    const isTable = !!view.format?.table_properties;
    const props = (view.format?.table_properties || view.format?.list_properties)?.filter(({ visible, property }) => visible && property !== 'title').map(({ property }) => schema[property].niceName);
    if (props) children.push(code('dataview', `${isTable ? `TABLE ${props.join(', ')}` : 'LIST'}\nFROM "${path.replace(/\/$/, '')}"\n`));
  });
  return children;
}

async function recurseViews (views) {
  const seenHere = new Set();
  for (const v of views) {
    if (v.content) {
      for (const item of v.content) {
        if (seenHere.has(item.id)) continue;
        seenHere.add(item.id);
        await makePage(item);
      }
    }
  }
}

// XXX
// - missing some embedded tables… See Projects/Rewilding

function mdText (v = [], ctx) {
  // text can contain \n which we should convert to breaks
  let parts = [];
  v.forEach(([txt, meta]) => {
    const parsed = (txt || '').split(/(\n)/).filter(it => it !== '');
    if (parsed.length <= 1) return parts.push([txt, meta].filter(Boolean));
    parsed.forEach(p => {
      if (p === '\n') parts.push([p, ['BREAK']]);
      else parts.push([p, meta ? JSON.parse(JSON.stringify(meta)) : undefined].filter(Boolean));
    });
  })
  // comments get repeated for each chunk, so we have to remove repetitions
  const seenComment = new Set();
  parts = parts
    .reverse()
    .map(([txt, meta]) => {
      if (typeof txt === 'undefined') return [];
      if (!meta) return [txt];
      const m = meta.find(it => it[0] === 'm');
      if (!m) return [txt, meta];
      if (!seenComment.has(m[1])) {
        seenComment.add(m[1]);
        return [txt, meta];
      }
      return [txt, meta.filter(it => it[0] !== 'm')];
    })
    .reverse()
  ;
  const chunks = parts.map(([txt, meta]) => {
    if (!txt) return false;
    if (!meta) return text(txt);
    if (txt === '‣') {
      const [deco, prm] = meta[0];
      let ret;
      if (deco === 'p') {
        const node = bigIndex.block[prm] || bigIndex.collection[prm];
        const link = traceParentPath(node, bigIndex, true);
        const alias = textify(node.value?.properties?.title || node.value?.name) || link.replace(/^.*\//, '');
        ret = wikiLink(link, (alias || '').replace(/\s+$/, ''));
      }
      if (deco === 'd') return text(prm.start_date);
      if (deco === 'eoi') {
        const url = bigIndex.block[prm]?.value?.format?.original_url;
        if (!url) return;
        ret = link(url, text(url));
      }
      if (meta.length > 1 && meta[1][0] === 'm') {
        const ref = makeFootnote(meta[1][1], ctx);
        return [ret, ref];
      }
      return ret;
  }
    else if (txt === '⁍') {
      const [deco, prm] = meta[0];
      if (deco === 'e') {
        const ret = inlineMath(prm);
        if (meta.length > 1 && meta[1][0] === 'm') {
          const ref = makeFootnote(meta[1][1], ctx);
          return [ret, ref];
        }
        return ret;
      }
    }
    else if (txt === '\n' && meta?.[0] === 'BREAK') {
      return br();
    }
    else {
      let prev = text(txt);
      const seenDeco = new Set();
      meta
        // there's some really weird stuff where notion will repeat the same command plenty of times
        .filter(([deco]) => {
          if (seenDeco.has(deco)) return false;
          seenDeco.add(deco);
          return true;
        })
        // need to make sure code comes first because it can't do text
        .sort(([a], [b]) => {
          if (a === 'c' && b !== 'c') return -1;
          if (a !== 'c' && b === 'c') return 1;
          return 0;
        })
        .forEach(([deco, prm]) => {
          if (deco === 'i') prev = em(prev);
          else if (deco === 'b') prev = strong(prev);
          else if (deco === 'c') prev = inlineCode(txt); // get the text
          else if (deco === 's') prev = strike(prev);
          else if (deco === '_') prev = [html('<u>'), prev, html('</u>')];
          else if (deco === 'h') prev = [html(`<span style="color: ${prm};">`), prev, html('</span>')];
          else if (deco === 'a') prev = link(prm, prev);
          else if (deco === 'm') {
            const ref = makeFootnote(prm, ctx);
            if (txt === '^') prev = [ref];
            else prev = [...(Array.isArray(prev) ? prev : [prev]), ref];
          }
        })
      ;
      return prev;
    }
  }).filter(Boolean);
  const ret = [];
  chunks.forEach(chunk => {
    ret.push(...(Array.isArray(chunk) ? chunk : [chunk]));
  });
  return ret;
}

function makeFootnote (id, ctx) {
  ctx.fnCount++;
  const disc = bigIndex.discussion[id]?.value;
  const children = disc.comments.map(cid => {
    const cmt = bigIndex.comment[cid].value;
    return paragraph(mdText(cmt.text, ctx));
  });
  if (disc.resolved) children.unshift(paragraph(text('#resolved ')));

  const identifier = String(ctx.fnCount);
  ctx.footnotes.push({
    type: 'footnoteDefinition',
    identifier,
    label: identifier,
    children,
  });

  return {
    type: 'footnoteReference',
    identifier,
    label: identifier,
  };
}

async function makeBlock (b, ctx) {
  const { id, type, content } = b;
  const block = (/^nob-/.test(type)) ? {} : bigIndex.block[id].value;
  if (type === 'text') {
    const p = paragraph(mdText(block.properties?.title, ctx));
    if (content) {
      const bq = [paragraph(text('(nobsidianNested::true)'))];
      await recurseBlocks(content, bq, ctx);
      return [p, blockquote(bq)];
    }
    return p;
  }
  if (type === 'header') return heading(1, mdText(block.properties?.title, ctx));
  if (type === 'sub_header') return heading(2, mdText(block.properties?.title, ctx));
  if (type === 'sub_sub_header') return heading(3, mdText(block.properties?.title, ctx));
  if (type === 'divider') return hr();
  if (type === 'quote') return blockquote([paragraph(mdText(block.properties?.title, ctx))]);
  if (type === 'page') {
    await makePage(b);
    const link = traceParentPath(block, bigIndex, true);
    const alias = textify(block.properties?.title) || link.replace(/^.*\//, '');
    return paragraph(wikiLink(link, alias));
  }
  if (type === 'nob-ul' || type === 'nob-ol') {
    const children = [];
    await recurseBlocks(content, children, ctx);
    return list((type === 'nob-ol'), children);
  }
  if (type === 'bulleted_list' || type === 'to_do' || type === 'numbered_list') {
    const children = [paragraph(mdText(block.properties?.title, ctx))];
    if (content) await recurseBlocks(content, children, ctx);
    let checked;
    if (type === 'to_do') checked = block.properties?.checked?.[0]?.[0] === 'Yes';
    return listItem(checked , children);
  }
  if (type === 'table_of_contents' || type === 'alias') return; // we skip
  if (type === 'callout') {
    const { page_icon: icon, block_color: color } = block?.format || {};
    const children = [
      paragraph(text(`(nobsidianCallout::${icon}) (nobsidianCalloutColour::${color})`)),
      paragraph(mdText(block.properties?.title, ctx)),
    ];
    if (content) await recurseBlocks(content, children, ctx);
    return blockquote(children);
  }
  if (type === 'code') {
    const value = block.properties?.title?.[0]?.[0];
    const lang = block.properties?.language?.[0]?.[0]?.toLowerCase();
    return code(lang === 'Markdown' ? 'md' : lang, value);
  }
  // note that this wraps in gathered as a workaround for Obsidian/MathJax newline issue
  if (type === 'equation') return math(`\\begin{gathered}\n${block.properties.title[0][0]}\n\\end{gathered}`);
  if (type === 'tweet' || type === 'video') return paragraph(link(block.properties.source));
  if (type === 'image') {
    const alt = textify(block.properties.caption);
    let imgPath;
    if (block.file_ids) {
      const fn = textify(block.properties.source).replace(/.*\//, '');
      if (!block.file_ids) console.warn(`No file_ids in ${id}`);
      imgPath = await copyFile(block.file_ids, fn, ctx.pagePath);
    }
    else {
      imgPath = textify(block.properties.source);
    }
    return paragraph(image(imgPath, alt));
  }
  if (type === 'pdf' || type === 'file') {
      const fn = textify(block.properties.source).replace(/.*\//, '');
      const title = textify(block.properties.title) || fn;
      const filePath = await copyFile(block.file_ids, fn, ctx.pagePath);
      return paragraph(link(filePath, text(title)));
  }
  // take the content and put it under transclusion/id.md
  if (type === 'transclusion_container') {
    await makePage(b, ctx);
    return paragraph([text('!'), wikiLink(`${transclusionRoot}/${id}`)]);

  }
  if (type === 'transclusion_reference') {
    const ref = block.format?.transclusion_reference_pointer?.id;
    if (!ref) console.warn(`No reference in transclusion.`);
    return paragraph([text('!'), wikiLink(`${transclusionRoot}/${ref}`)]);
  }
  if (type === 'table') {
    const cols = block.format.table_block_column_order;
    const hasHeader = !!block.format.table_block_column_header;
    const rows = [];
    // MD tables have a header row by default, so if we don't expect a header we add an empty line
    if (!hasHeader) rows.push(row(cols.map(() => cell(text('')))));
    content.forEach(({ id: rid }) => {
      const rowProps = bigIndex.block[rid].value.properties;
      rows.push(row(cols.map(col => {
        return cell(
          rowProps[col] ? mdText(rowProps[col]) : text(' ')
        );
      })));
    });
    return table(rows);
  }
  if (type === 'table_row') return;
  if (type === 'column') return;
  if (type === 'column_list') {
    const columns = [];
    for (const col of content) {
      const td = cell([]);
      await recurseBlocks(col.content, td.children, ctx);
      columns.push(td);
    }
    return table(row(columns));
  }
  if (type === 'collection_view') {
    const { id, path, views, name } = b.collection;
    const ret = [
      heading(3, text(name)),
      ...getCollectionAST(id, views, path),
    ];
    await recurseViews(views);
    return ret;
  }
  // XXX
  // - for this, need to create a collection page as if it were a subpage
  //    if (type === 'collection_view_page') return;
  // - Project/Personal: Betterment and Nice Feedback both have trailing space

  console.warn(`Unexpected type in makeBlock: ${type} (${id})`);
}

// we have multiple ids because sometimes there are several, just because — need to find the right one
async function copyFile (ids, fn, parentPath) {
  const targetDir = parentPath.replace(/\.md$/, '');
  await mkdir(targetDir, { recursive: true });
  const relDir = targetDir.replace(/^.*\//, '');
  const filePath = join(relDir, fn)

  let hasCopied = false;
  for (const id of ids) {
    try {
      await cp(join(filesDir, id, fn), join(targetDir, fn));
      hasCopied = true;
    }
    catch (err) {/**/}
  }
  if (!hasCopied) console.warn(`Failed to copy ${fn} for ${ids.join(',')} in ${parentPath}`);
  return filePath;
}

async function recurseBlocks (content, parentChildren, ctx) {
  for (const b of (content || [])) {
    const child = await makeBlock(b, ctx);
    if (child) parentChildren.push(...(Array.isArray(child) ? child : [child]));
  }
}

// things to do
//  - [ ] some of the directories are tables: how can we make these files instead with the special data thing in Obsidian
//  - [ ] check that BHK Interpretation is correct
//  - [ ] pin tweets
//  - [ ] check that we know how to convert every block type and every kind of text
//  - [ ] table_block_* fields are important for table blocks
//  - [ ] use https://github.com/FlorianWoelki/obsidian-icon-folder to add icons manually

function niceName (str) {
  const ret = str.toLowerCase().replace(/\s+(\w)/g, (_,c) => c.toUpperCase()).replace(/[?]/g, '');
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
        extensions: [
          frontmatterToMarkdown(['yaml']),
          gfmToMarkdown(),
          mathToMarkdown(),
          wikiToMarkdown({ aliasDivider: '|' }),
        ],
      })
      // we remove a number of escapes, here trailing spaces
      .replaceAll('&#x20;', ' ')
      .replace(/(\[\[.+?\]\])/g, (_, m) => m.replace(/\\_/g, '_'))
      .replaceAll('\\#resolved', '#resolved')
      .replaceAll(`\\![[${transclusionRoot}`, `![[${transclusionRoot}`)
      // .replace(/^---# /gm, '---\n\n# ')
    ;
  }
  catch (err) {
    console.warn(`Error in ${id}`);
    console.log(JSON.stringify(ast, null, 2));
    console.error(err);
  }
}

function inlineMD (ast) {
  return md(root(ast)).replace(/\n+$/, '');
}

function heading (depth, children) {
  if (typeof children === 'string') children = [text(children)];
  if (!Array.isArray(children)) children = [children];
  return {
    type: 'heading',
    depth,
    children,
  };
}

function typeAndChildren (type, children) {
  if (!children) children = [];
  if (!Array.isArray(children)) children = [children];
  return { type, children };
}

function typeAndValue (type, value) {
  return { type, value };
}

function root (children) { return typeAndChildren('root', children); }
function paragraph (children) { return typeAndChildren('paragraph', children); }
function blockquote (children) { return typeAndChildren('blockquote', children); }
function em (children) { return typeAndChildren('emphasis', children); }
function strong (children) { return typeAndChildren('strong', children); }
function strike (children) { return typeAndChildren('delete', children); }
function table (children) { return typeAndChildren('table', children); }
function row (children) { return typeAndChildren('tableRow', children); }
function cell (children) { return typeAndChildren('tableCell', children); }

function text (value) { return typeAndValue('text', value); }
function inlineCode (value) { return typeAndValue('inlineCode', value); }
function inlineMath (value) { return typeAndValue('inlineMath', value); }
function math (value) { return typeAndValue('math', value); }
function html (value) { return typeAndValue('html', value); }
function frontmatter (value) { return typeAndValue('yaml', stringify(value).replace(/\n+$/, '')); }

function wikiLink (value, alias) {
  return {
    type: 'wikiLink',
    value,
    data: {
      alias,
    },
  };
}

function code (lang, value) {
  return {
    type: 'code',
    lang,
    value,
  };
}

function link (url, children) {
  if (!children) children = [text(url)];
  if (!Array.isArray(children)) children = [children];
  return {
    type: 'link',
    url,
    children,
  };
}

function list (ordered, children) {
  if (!Array.isArray(children)) children = [children];
  return {
    type: 'list',
    ordered,
    children,
  };
}

// checked is true/false if to_do, undefined otherwise
function listItem (checked, children) {
  if (!Array.isArray(children)) children = [children];
  return {
    type: 'listItem',
    checked,
    children,
  };
}

function hr () {
  return { type: 'thematicBreak' };
}

function br () {
  return { type: 'break' };
}

function image (url, alt, title) {
  return {
    type: 'image',
    url,
    alt,
    title,
  };
}

function wrapLists () {
  tree.space.pages.forEach(p => {
        if (p.type === 'copy_indicator') return;
        if (p.type === 'collection_view_page') {
          p.collection.views.forEach(v => {
            v.content.forEach(recurseWrap);
          });
        }
        if (p.type === 'page') recurseWrap(p);
  });
}

function recurseWrap (node) {
  if (!node || !node.content) return;
  const newKids = [];
  let curList;
  let inList;
  node.content.forEach(kid => {
    if (kid.content) kid.content.forEach(recurseWrap);
    if (inList === 'u') {
      if (kid.type === 'bulleted_list' || kid.type === 'to_do') return curList.push(kid);
      // either it's the other kind of list, or it's not and ends the list
      if (kid.type === 'numbered_list') {
        inList = 'o';
        curList = [kid];
        newKids.push({ type: `nob-ol`, content: curList });
      }
      else {
        inList = false;
        newKids.push(kid);
      }
    }
    else if (inList === 'o') {
      if (kid.type === 'numbered_list') return curList.push(kid);
      if (kid.type === 'bulleted_list' || kid.type === 'to_do') {
        inList = 'u';
        curList = [kid];
        newKids.push({ type: `nob-ul`, content: curList });
      }
      else {
        inList = false;
        newKids.push(kid);
      }
    }
    // we are not in a list
    else {
      if (kid.type !== 'bulleted_list' && kid.type !== 'numbered_list' && kid.type !== 'to_do') {
        newKids.push(kid);
        return;
      }
      curList = [kid];
      inList = (kid.type === 'bulleted_list' || kid.type === 'to_do') ? 'u' : 'o';
      newKids.push({ type: `nob-${inList}l`, content: curList });
    }
  });
  node.content = newKids;
}
