
import { join } from 'node:path';
import { ancestryAndSelf } from "./ancestry.js";
import { textify } from "./textify.js";

export function traceParentPath (root, bigIndex, noTrail = false) {
  const parents = ancestryAndSelf(root, bigIndex)
  let lastType;
  // console.warn(`* ${parents.length} depth: ${JSON.stringify(parents.map(p => p.id))}`);
  let parentPath = join(
    ...(parents
      .map(obj => {
        const { type } = obj;
        lastType = type || 'collection';
        if (type === 'collection_view_page') return;
        if (type === 'page') return sanitiseFileName(textify(obj.properties?.title, bigIndex));
        if (!type && obj.name) return sanitiseFileName(textify(obj.name, bigIndex));
      })
      .filter(Boolean))
  );
  if (!noTrail) parentPath += (lastType === 'collection') ? '/' : '.md';
  return parentPath;
}

export function sanitiseFileName (str) {
  if (/[\\]/.test(str)) console.warn(str);
  return str
    .replace(/[:/\\?]/g, '_')
    // .replace(/:/g, '：') // full-width colon
    // .replace(/\//g, '／') // full-width solidus
  ;
}
