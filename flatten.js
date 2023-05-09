
import recursiveReaddirFiles from 'recursive-readdir-files';
import process from 'node:process';
import { readFile, writeFile, rm, rmdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

const baseDir = '/Users/robin/Documents/Documents - Dawon/Obsidian/Everything/';
const files = (await recursiveReaddirFiles(baseDir, { ignored: /\.obsidian|\.DS_Store/ }))
  .map(({ path, name, ext }) => ({
    name,
    localName: path.replace(baseDir, ''),
    path,
    ext,
  }))
;
const fileMap = {};
files.forEach(({ name, localName }) => {
  if (!fileMap[name]) fileMap[name] = [];
  fileMap[name].push(localName);
});
let count = 0;
Object.entries(fileMap).forEach(([k, v]) => {
  if (v.length > 1) {
    console.log(`${k}: ${v.join('|')}`);
    count++;
  }
});
if (count) {
  console.warn(`Total: ${count}`);
  process.exit(0);
}
const dirs = new Set();
const dir2tag = {
  "": ['#cleanup'],
  "Blogs Ideas — MOVE": ['#cleanup', '#blog'],
  "General Notes": ['#cleanup'],
  "People & Entities": ['#entity'],
  "Rewilding": ['#cleanup', '#rewilding'],
  "Scratchpad": ['#cleanup'],
  "The Tardigrade Whisperer": ['#cleanup', '#fiction'],
  "Admin": ['#cleanup', '#admin'],
  "Blog": ['#blog'],
  "Protocol Labs": ['#pl'],
  "References": ['#reference'],
  "Stuff to Clean Up": ['#cleanup'],
  "Stuff to Clean Up/Recipes ": ['#cleanup'],
  "Ideas": ['#ideas'],
  "Ideas/Acceptable Advertising/Table of Default Positions": ['#ideas'],
  "Ideas/Moods": ['#ideas'],
  "Notions": ['#notions'],
  "Notions/BHK Interpretation/Statement Interpretations": ['#notions'],
  "Notions/LaTeX Symbols": ['#notions'],
  "Projects": ['#projects'],
  "Projects/Climate Emergency ": ['#projects'],
  "Projects/Internet Order": ['#projects'],
  "Projects/New Rewilding": ['#projects', '#rewilding'],
  "Projects/Requirements for a Healthy Ecosystem in Advertising (RHEA)": ['#projects', '#cleanup'],
  "Projects/Nuclear Semiotics/Parts": ['#projects', '#fiction'],
  "Projects/Rewilding": ['#projects', '#rewilding'],
  "Projects/Rewilding/RI_ Parts": ['#cleanup', '#projects', '#rewilding'],
  "Projects/Personal": ['#cleanup', '#projects'],
  "Projects/Personal/Book Buying List": ['#cleanup', '#projects'],
  "Projects/Personal/Betterment ": ['#cleanup', '#projects'],
  "Projects/Personal/Betterment /Wrist fixing": ['#cleanup', '#projects'],
  "Projects/Personal/Betterment": ['#cleanup', '#projects'],
};
const baseOut = baseDir;
for (const { name, localName, path, ext } of files) {
  if (/\.trash|transclusions|\.obsidian/.test(localName)) continue;
  const dir = localName.replace(/[^/]+$/, '').replace(/\/$/, '');
  dirs.add(dir);
  if (ext === 'md') {
    let md = await readFile(path, 'utf-8');
    const tags = dir2tag[dir].join(' ');
    if (/^---\n(?:^.+$\n)+---\n/m.test(md)) {
      md = md.replace(/^(---\n(?:^.+$\n)+---\n)/m, `$1${tags}`);
    }
    else {
      md = `${tags}\n${md}`;
    }
    md = md.replace(/(?<!\\)\[\[(?:[^\]|]+\/)?([^\]|/]+)(\|[^\]]+)?\]\]/g, '[[$1$2]]');
    await rm(path);
    await writeFile(join(baseOut, name), md, 'utf-8');
  }
  else {
    await rename(path, join(baseOut, name));
  }
}
for (const dir of [...dirs]) {
  try {
    await rmdir(join(baseDir, dir));
  }
  catch (err) {
    console.warn(`failed to remove ${dir}`);
  }
}
