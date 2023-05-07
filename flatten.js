
import recursiveReaddirFiles from 'recursive-readdir-files';

const baseDir = '/Users/robin/Documents/Documents - Dawon/Obsidian/Everything/';
const files = (await recursiveReaddirFiles(baseDir))
  .map(({ path, name, ext }) => ({
    name,
    localName: path.replace(baseDir, ''),
    path,
    ext,
  }))
;
console.warn(files);
