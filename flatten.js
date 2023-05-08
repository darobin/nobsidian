
import recursiveReaddirFiles from 'recursive-readdir-files';

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
console.warn(`Total: ${count}`);
